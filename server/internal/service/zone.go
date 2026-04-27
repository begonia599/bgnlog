package service

import (
	"blog-server/internal/model"
	"blog-server/internal/pkg"
	"blog-server/internal/repository"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/begonia599/myplatform/sdk"
)

// AccessDecision is the result of evaluating a user against a zone's rules.
//
// Status values:
//   - allowed         — at least one rule passed (or zone is public, or no rules)
//   - denied          — user is logged-in but failed every rule
//   - need_link       — Discord account is not linked at all
//   - need_reauth     — Discord token revoked / no stored token / required scopes missing
//   - error           — transient upstream failure, caller may retry
//
// MissingScopes is non-empty for need_reauth: it tells the frontend which extra
// scopes to request when re-authorizing.
type AccessDecision struct {
	Status        string   `json:"status"`
	Reason        string   `json:"reason,omitempty"`
	MissingScopes []string `json:"missing_scopes,omitempty"`
	// EvaluatedAt is the moment we ran the check (or pulled from cache).
	EvaluatedAt time.Time `json:"evaluated_at"`
}

const (
	AccessStatusAllowed    = "allowed"
	AccessStatusDenied     = "denied"
	AccessStatusNeedLink   = "need_link"
	AccessStatusNeedReauth = "need_reauth"
	AccessStatusError      = "error"

	scopeDiscordIdentify    = "identify"
	scopeDiscordGuilds      = "guilds"
	scopeDiscordGuildsRead  = "guilds.members.read"
	scopeDiscordConnections = "connections"

	zoneAccessCacheTTL = 5 * time.Minute
)

var (
	ErrZoneNotFound = errors.New("zone not found")
	ErrInvalidRule  = errors.New("invalid zone rule")
	ErrNoUserToken  = errors.New("user token is required")
)

type ZoneService struct {
	repo    *repository.ZoneRepository
	discord *pkg.DiscordClient

	// platform is the shared SDK client (admin-tokenless). For per-user calls
	// we wrap it via WithToken so the request flows under the caller's JWT.
	platform *sdk.Client

	cache *zoneAccessCache
}

func NewZoneService(repo *repository.ZoneRepository, platform *sdk.Client) *ZoneService {
	return &ZoneService{
		repo:     repo,
		discord:  pkg.NewDiscordClient(),
		platform: platform,
		cache:    newZoneAccessCache(),
	}
}

// --- CRUD ---

func (s *ZoneService) ListSummary() ([]model.Zone, error) {
	return s.repo.ListSummary()
}

func (s *ZoneService) ListWithRules() ([]model.Zone, error) {
	return s.repo.List()
}

func (s *ZoneService) GetBySlug(slug string) (*model.Zone, error) {
	z, err := s.repo.GetBySlug(slug)
	if err != nil {
		return nil, err
	}
	return z, nil
}

func (s *ZoneService) GetByID(id uint) (*model.Zone, error) {
	return s.repo.GetByID(id)
}

type CreateZoneInput struct {
	Slug          string
	Name          string
	Description   string
	CoverImageURL string
	Visibility    string
	RuleLogic     string
	SortOrder     int
}

func (s *ZoneService) Create(ownerID uint, in CreateZoneInput) (*model.Zone, error) {
	if in.Slug == "" || in.Name == "" {
		return nil, errors.New("slug and name are required")
	}
	if in.Visibility == "" {
		in.Visibility = model.ZoneVisibilityGated
	}
	if in.Visibility != model.ZoneVisibilityPublic && in.Visibility != model.ZoneVisibilityGated {
		return nil, errors.New("invalid visibility")
	}
	rl := in.RuleLogic
	if rl == "" {
		rl = model.ZoneRuleLogicOR
	}
	if rl != model.ZoneRuleLogicOR && rl != model.ZoneRuleLogicAND {
		return nil, errors.New("invalid rule_logic")
	}
	z := &model.Zone{
		Slug:          in.Slug,
		Name:          in.Name,
		Description:   in.Description,
		CoverImageURL: in.CoverImageURL,
		Visibility:    in.Visibility,
		RuleLogic:     rl,
		SortOrder:     in.SortOrder,
		OwnerID:       ownerID,
	}
	if err := s.repo.Create(z); err != nil {
		return nil, err
	}
	return z, nil
}

type UpdateZoneInput struct {
	Name          *string
	Description   *string
	CoverImageURL *string
	Visibility    *string
	RuleLogic     *string
	SortOrder     *int
}

func (s *ZoneService) Update(id uint, in UpdateZoneInput) (*model.Zone, error) {
	z, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if in.Name != nil {
		z.Name = *in.Name
	}
	if in.Description != nil {
		z.Description = *in.Description
	}
	if in.CoverImageURL != nil {
		z.CoverImageURL = *in.CoverImageURL
	}
	if in.Visibility != nil {
		v := *in.Visibility
		if v != model.ZoneVisibilityPublic && v != model.ZoneVisibilityGated {
			return nil, errors.New("invalid visibility")
		}
		z.Visibility = v
	}
	if in.RuleLogic != nil {
		rl := *in.RuleLogic
		if rl != model.ZoneRuleLogicOR && rl != model.ZoneRuleLogicAND {
			return nil, errors.New("invalid rule_logic")
		}
		z.RuleLogic = rl
	}
	if in.SortOrder != nil {
		z.SortOrder = *in.SortOrder
	}
	if err := s.repo.Update(z); err != nil {
		return nil, err
	}
	// Mutating zone could change gating semantics — drop cache for safety.
	s.cache.invalidateZone(z.ID)
	return z, nil
}

func (s *ZoneService) Delete(id uint) error {
	s.cache.invalidateZone(id)
	return s.repo.Delete(id)
}

// --- rules ---

type AddRuleInput struct {
	Kind        string
	GuildID     string
	RoleID      string
	Value       int
	ValueStr    string
	Description string
	Label       string
}

func (s *ZoneService) AddRule(zoneID uint, in AddRuleInput) (*model.ZoneRule, error) {
	if _, err := s.repo.GetByID(zoneID); err != nil {
		return nil, ErrZoneNotFound
	}
	switch in.Kind {
	case model.ZoneRuleDiscordGuildMember:
		if in.GuildID == "" {
			return nil, fmt.Errorf("%w: guild_id required", ErrInvalidRule)
		}
	case model.ZoneRuleDiscordGuildRole:
		if in.GuildID == "" || in.RoleID == "" {
			return nil, fmt.Errorf("%w: guild_id and role_id required", ErrInvalidRule)
		}
	case model.ZoneRuleDiscordGuildBoost:
		if in.GuildID == "" {
			return nil, fmt.Errorf("%w: guild_id required", ErrInvalidRule)
		}
	case model.ZoneRuleDiscordGuildJoinDays:
		if in.GuildID == "" || in.Value <= 0 {
			return nil, fmt.Errorf("%w: guild_id and value (days) required", ErrInvalidRule)
		}
	case model.ZoneRuleDiscordAccountAge:
		if in.Value <= 0 {
			return nil, fmt.Errorf("%w: value (days) required", ErrInvalidRule)
		}
	case model.ZoneRuleDiscordConnection:
		if in.ValueStr == "" {
			return nil, fmt.Errorf("%w: value_str (connection type) required", ErrInvalidRule)
		}
	default:
		return nil, fmt.Errorf("%w: unsupported kind %q", ErrInvalidRule, in.Kind)
	}
	rule := &model.ZoneRule{
		ZoneID:      zoneID,
		Kind:        in.Kind,
		GuildID:     in.GuildID,
		RoleID:      in.RoleID,
		Value:       in.Value,
		ValueStr:    in.ValueStr,
		Description: in.Description,
		Label:       in.Label,
	}
	if err := s.repo.AddRule(rule); err != nil {
		return nil, err
	}
	s.cache.invalidateZone(zoneID)
	return rule, nil
}

func (s *ZoneService) DeleteRule(zoneID, ruleID uint) error {
	if err := s.repo.DeleteRule(zoneID, ruleID); err != nil {
		return err
	}
	s.cache.invalidateZone(zoneID)
	return nil
}

// --- access evaluation ---

// CheckAccess decides whether the given user can access the given zone.
// userToken is the user's blog/core JWT (used to fetch their stored Discord
// access_token from core).
//
// Caching: result is cached for 5 minutes per (zone, user) so we don't hammer
// Discord on every page view; admin mutations invalidate per-zone, and we
// also invalidate per-user when their Discord link state changes (handled in
// auth handler — TODO once we wire it).
func (s *ZoneService) CheckAccess(z *model.Zone, userID uint, userToken string) AccessDecision {
	// Public zones always pass.
	if z.Visibility == model.ZoneVisibilityPublic {
		return AccessDecision{Status: AccessStatusAllowed, Reason: "public", EvaluatedAt: time.Now()}
	}
	// Gated but no rules — degenerate "any logged-in user" case.
	if len(z.Rules) == 0 {
		return AccessDecision{Status: AccessStatusAllowed, Reason: "no_rules", EvaluatedAt: time.Now()}
	}

	if cached, ok := s.cache.get(z.ID, userID); ok {
		return cached
	}

	decision := s.evaluate(z, userToken)
	s.cache.put(z.ID, userID, decision)
	return decision
}

func (s *ZoneService) evaluate(z *model.Zone, userToken string) AccessDecision {
	now := time.Now()

	required := requiredDiscordScopes(z.Rules)

	// Pull the user's Discord access token from core.
	scoped := s.platform.WithToken(userToken)
	tok, err := scoped.Auth.GetOAuthToken("discord")
	if err != nil {
		var apiErr *sdk.APIError
		if errors.As(err, &apiErr) {
			switch apiErr.StatusCode {
			case 404:
				return AccessDecision{
					Status:        AccessStatusNeedLink,
					Reason:        "discord_not_linked",
					MissingScopes: required,
					EvaluatedAt:   now,
				}
			case 401, 410:
				return AccessDecision{
					Status:        AccessStatusNeedReauth,
					Reason:        "token_unavailable",
					MissingScopes: required,
					EvaluatedAt:   now,
				}
			}
		}
		return AccessDecision{Status: AccessStatusError, Reason: err.Error(), EvaluatedAt: now}
	}

	// Verify all required scopes were granted.
	have := scopeSet(tok.Scopes)
	var missing []string
	for _, sc := range required {
		if !have[sc] {
			missing = append(missing, sc)
		}
	}
	if len(missing) > 0 {
		return AccessDecision{
			Status:        AccessStatusNeedReauth,
			Reason:        "missing_scopes",
			MissingScopes: required,
			EvaluatedAt:   now,
		}
	}

	// ── Lazy-loaded Discord data ──
	// Each resource is fetched at most once, regardless of how many rules use it.

	var guildsMap map[string]bool
	guildsLoaded := false
	getGuilds := func() (map[string]bool, error) {
		if !guildsLoaded {
			gs, err := s.discord.ListUserGuilds(tok.AccessToken)
			if err != nil {
				return nil, err
			}
			guildsMap = make(map[string]bool, len(gs))
			for _, g := range gs {
				guildsMap[g.ID] = true
			}
			guildsLoaded = true
		}
		return guildsMap, nil
	}

	memberCache := map[string]*pkg.DiscordGuildMember{} // guildID → member (nil = not found)
	getMember := func(guildID string) (*pkg.DiscordGuildMember, error) {
		if m, ok := memberCache[guildID]; ok {
			return m, nil
		}
		m, found, err := s.discord.GetGuildMember(tok.AccessToken, guildID)
		if err != nil {
			return nil, err
		}
		if !found {
			memberCache[guildID] = nil
			return nil, nil
		}
		memberCache[guildID] = m
		return m, nil
	}

	var connections []pkg.DiscordConnection
	connectionsLoaded := false
	getConnections := func() ([]pkg.DiscordConnection, error) {
		if !connectionsLoaded {
			c, err := s.discord.ListConnections(tok.AccessToken)
			if err != nil {
				return nil, err
			}
			connections = c
			connectionsLoaded = true
		}
		return connections, nil
	}

	var discordUser *pkg.DiscordUser
	discordUserLoaded := false
	getUser := func() (*pkg.DiscordUser, error) {
		if !discordUserLoaded {
			u, err := s.discord.GetCurrentUser(tok.AccessToken)
			if err != nil {
				return nil, err
			}
			discordUser = u
			discordUserLoaded = true
		}
		return discordUser, nil
	}

	// ── Evaluate each rule ──
	isAND := z.RuleLogic == model.ZoneRuleLogicAND
	results := make([]bool, 0, len(z.Rules))

	for _, rule := range z.Rules {
		passed, evalErr := s.evaluateRule(rule, getGuilds, getMember, getConnections, getUser, now)
		if evalErr != nil {
			return AccessDecision{Status: AccessStatusError, Reason: evalErr.Error(), EvaluatedAt: now}
		}
		results = append(results, passed)

		// Short-circuit for OR: first pass → allowed
		if !isAND && passed {
			return AccessDecision{Status: AccessStatusAllowed, Reason: "rule_" + fmt.Sprint(rule.ID), EvaluatedAt: now}
		}
		// Short-circuit for AND: first fail → denied
		if isAND && !passed {
			return AccessDecision{Status: AccessStatusDenied, Reason: "rule_" + fmt.Sprint(rule.ID) + "_failed", EvaluatedAt: now}
		}
	}

	if isAND {
		// All passed (didn't short-circuit)
		return AccessDecision{Status: AccessStatusAllowed, Reason: "all_rules_passed", EvaluatedAt: now}
	}
	// OR: none passed
	return AccessDecision{Status: AccessStatusDenied, Reason: "no_rule_matched", EvaluatedAt: now}
}

// evaluateRule checks a single rule. Returns (passed, error).
func (s *ZoneService) evaluateRule(
	rule model.ZoneRule,
	getGuilds func() (map[string]bool, error),
	getMember func(string) (*pkg.DiscordGuildMember, error),
	getConnections func() ([]pkg.DiscordConnection, error),
	getUser func() (*pkg.DiscordUser, error),
	now time.Time,
) (bool, error) {
	switch rule.Kind {
	case model.ZoneRuleDiscordGuildMember:
		gs, err := getGuilds()
		if err != nil {
			return false, err
		}
		return gs[rule.GuildID], nil

	case model.ZoneRuleDiscordGuildRole:
		gs, err := getGuilds()
		if err != nil {
			return false, err
		}
		if !gs[rule.GuildID] {
			return false, nil
		}
		m, err := getMember(rule.GuildID)
		if err != nil {
			return false, err
		}
		if m == nil {
			return false, nil
		}
		for _, r := range m.Roles {
			if r == rule.RoleID {
				return true, nil
			}
		}
		return false, nil

	case model.ZoneRuleDiscordGuildBoost:
		gs, err := getGuilds()
		if err != nil {
			return false, err
		}
		if !gs[rule.GuildID] {
			return false, nil
		}
		m, err := getMember(rule.GuildID)
		if err != nil {
			return false, err
		}
		if m == nil {
			return false, nil
		}
		return m.PremiumSince != nil, nil

	case model.ZoneRuleDiscordGuildJoinDays:
		gs, err := getGuilds()
		if err != nil {
			return false, err
		}
		if !gs[rule.GuildID] {
			return false, nil
		}
		m, err := getMember(rule.GuildID)
		if err != nil {
			return false, err
		}
		if m == nil || m.JoinedAt == "" {
			return false, nil
		}
		joinedAt, parseErr := time.Parse(time.RFC3339, m.JoinedAt)
		if parseErr != nil {
			return false, nil
		}
		daysSinceJoin := int(now.Sub(joinedAt).Hours() / 24)
		return daysSinceJoin >= rule.Value, nil

	case model.ZoneRuleDiscordAccountAge:
		u, err := getUser()
		if err != nil {
			return false, err
		}
		created := discordSnowflakeTime(u.ID)
		daysSinceCreation := int(now.Sub(created).Hours() / 24)
		return daysSinceCreation >= rule.Value, nil

	case model.ZoneRuleDiscordConnection:
		conns, err := getConnections()
		if err != nil {
			return false, err
		}
		for _, c := range conns {
			if strings.EqualFold(c.Type, rule.ValueStr) && c.Verified {
				return true, nil
			}
		}
		return false, nil
	}
	return false, nil
}

// discordSnowflakeTime extracts the creation timestamp from a Discord snowflake ID.
func discordSnowflakeTime(id string) time.Time {
	const discordEpoch = 1420070400000 // ms
	n, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		return time.Time{}
	}
	ms := (n >> 22) + discordEpoch
	return time.UnixMilli(ms)
}

// InvalidateUser drops all cached access decisions for a user — call after
// they (re-)bind / unlink Discord so the next zone check goes upstream.
func (s *ZoneService) InvalidateUser(userID uint) {
	s.cache.invalidateUser(userID)
}

func requiredDiscordScopes(rules []model.ZoneRule) []string {
	needGuilds := false
	needGuildsRead := false
	needConnections := false
	for _, r := range rules {
		switch r.Kind {
		case model.ZoneRuleDiscordGuildMember:
			needGuilds = true
		case model.ZoneRuleDiscordGuildRole, model.ZoneRuleDiscordGuildBoost, model.ZoneRuleDiscordGuildJoinDays:
			needGuilds = true
			needGuildsRead = true
		case model.ZoneRuleDiscordAccountAge:
			// only needs identify (always requested)
		case model.ZoneRuleDiscordConnection:
			needConnections = true
		}
	}
	out := []string{scopeDiscordIdentify}
	if needGuilds {
		out = append(out, scopeDiscordGuilds)
	}
	if needGuildsRead {
		out = append(out, scopeDiscordGuildsRead)
	}
	if needConnections {
		out = append(out, scopeDiscordConnections)
	}
	return out
}

func scopeSet(scopes []string) map[string]bool {
	out := make(map[string]bool, len(scopes))
	for _, s := range scopes {
		out[strings.TrimSpace(s)] = true
	}
	return out
}

// --- in-memory cache ---

type zoneAccessCacheKey struct {
	zoneID uint
	userID uint
}

type zoneAccessCacheEntry struct {
	decision  AccessDecision
	expiresAt time.Time
}

type zoneAccessCache struct {
	mu sync.Mutex
	m  map[zoneAccessCacheKey]zoneAccessCacheEntry
}

func newZoneAccessCache() *zoneAccessCache {
	return &zoneAccessCache{m: make(map[zoneAccessCacheKey]zoneAccessCacheEntry)}
}

func (c *zoneAccessCache) get(zoneID, userID uint) (AccessDecision, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.m[zoneAccessCacheKey{zoneID, userID}]
	if !ok {
		return AccessDecision{}, false
	}
	if time.Now().After(e.expiresAt) {
		delete(c.m, zoneAccessCacheKey{zoneID, userID})
		return AccessDecision{}, false
	}
	return e.decision, true
}

func (c *zoneAccessCache) put(zoneID, userID uint, d AccessDecision) {
	// Don't cache transitional or error states — the user may resolve them
	// quickly (e.g. by re-authorizing Discord) and stale cache would block.
	switch d.Status {
	case AccessStatusError, AccessStatusNeedReauth, AccessStatusNeedLink:
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.m[zoneAccessCacheKey{zoneID, userID}] = zoneAccessCacheEntry{
		decision:  d,
		expiresAt: time.Now().Add(zoneAccessCacheTTL),
	}
}

func (c *zoneAccessCache) invalidateZone(zoneID uint) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for k := range c.m {
		if k.zoneID == zoneID {
			delete(c.m, k)
		}
	}
}

func (c *zoneAccessCache) invalidateUser(userID uint) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for k := range c.m {
		if k.userID == userID {
			delete(c.m, k)
		}
	}
}

// RequestReauth asks the core platform for a Discord re-authorization URL
// that includes the extra scopes needed for zone gating (guilds,
// guilds.members.read).
//
// redirectURI is where the user returns after authorizing — typically the
// frontend's /oauth/callback with zone context in the query string.
func (s *ZoneService) RequestReauth(userToken, redirectURI string) (string, error) {
	if userToken == "" {
		return "", ErrNoUserToken
	}
	// Only request scopes that are actually needed by existing zone rules.
	zones, err := s.repo.List()
	if err != nil {
		return "", fmt.Errorf("list zones for scopes: %w", err)
	}
	var allRules []model.ZoneRule
	for _, z := range zones {
		allRules = append(allRules, z.Rules...)
	}
	extraScopes := requiredDiscordScopes(allRules)
	client := s.platform.WithToken(userToken)
	resp, err := client.Auth.OAuthBindAuthorize("discord", redirectURI, extraScopes...)
	if err != nil {
		return "", fmt.Errorf("oauth bind authorize: %w", err)
	}
	return resp.AuthURL, nil
}
