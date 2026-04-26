package service

import (
	"blog-server/internal/model"
	"blog-server/internal/pkg"
	"blog-server/internal/repository"
	"errors"
	"fmt"
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

	scopeDiscordIdentify   = "identify"
	scopeDiscordGuilds     = "guilds"
	scopeDiscordGuildsRead = "guilds.members.read"

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
	z := &model.Zone{
		Slug:          in.Slug,
		Name:          in.Name,
		Description:   in.Description,
		CoverImageURL: in.CoverImageURL,
		Visibility:    in.Visibility,
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
	Kind    string
	GuildID string
	RoleID  string
	Label   string
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
	default:
		return nil, fmt.Errorf("%w: unsupported kind %q", ErrInvalidRule, in.Kind)
	}
	rule := &model.ZoneRule{
		ZoneID:  zoneID,
		Kind:    in.Kind,
		GuildID: in.GuildID,
		RoleID:  in.RoleID,
		Label:   in.Label,
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

	// Compute the union of scopes required by all rules so we can request
	// them all at once during re-auth, rather than dripping the user through
	// multiple consent screens.
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

	// Verify all required scopes were granted; if not, ask for re-auth with
	// the missing ones (the UI can deep-link straight to provider consent).
	have := scopeSet(tok.Scopes)
	var missing []string
	for _, s := range required {
		if !have[s] {
			missing = append(missing, s)
		}
	}
	if len(missing) > 0 {
		return AccessDecision{
			Status:        AccessStatusNeedReauth,
			Reason:        "missing_scopes",
			MissingScopes: required, // ask for the full set so we don't churn
			EvaluatedAt:   now,
		}
	}

	// Evaluate rules with OR semantics. We fetch the guild list once and
	// reuse it for every rule that needs it; per-guild member calls are
	// only made when a role rule needs them.
	var guilds []pkg.DiscordGuild
	guildsLoaded := false
	guildSet := func() (map[string]bool, error) {
		if !guildsLoaded {
			gs, err := s.discord.ListUserGuilds(tok.AccessToken)
			if err != nil {
				return nil, err
			}
			guilds = gs
			guildsLoaded = true
		}
		set := make(map[string]bool, len(guilds))
		for _, g := range guilds {
			set[g.ID] = true
		}
		return set, nil
	}

	for _, rule := range z.Rules {
		switch rule.Kind {
		case model.ZoneRuleDiscordGuildMember:
			set, err := guildSet()
			if err != nil {
				return AccessDecision{Status: AccessStatusError, Reason: err.Error(), EvaluatedAt: now}
			}
			if set[rule.GuildID] {
				return AccessDecision{Status: AccessStatusAllowed, Reason: "rule_" + fmt.Sprint(rule.ID), EvaluatedAt: now}
			}
		case model.ZoneRuleDiscordGuildRole:
			set, err := guildSet()
			if err != nil {
				return AccessDecision{Status: AccessStatusError, Reason: err.Error(), EvaluatedAt: now}
			}
			// Optimization: if the user isn't even in that guild, the role
			// check is guaranteed to fail — skip the API call.
			if !set[rule.GuildID] {
				continue
			}
			member, found, err := s.discord.GetGuildMember(tok.AccessToken, rule.GuildID)
			if err != nil {
				return AccessDecision{Status: AccessStatusError, Reason: err.Error(), EvaluatedAt: now}
			}
			if !found {
				continue
			}
			for _, r := range member.Roles {
				if r == rule.RoleID {
					return AccessDecision{Status: AccessStatusAllowed, Reason: "rule_" + fmt.Sprint(rule.ID), EvaluatedAt: now}
				}
			}
		}
	}

	return AccessDecision{Status: AccessStatusDenied, Reason: "no_rule_matched", EvaluatedAt: now}
}

// InvalidateUser drops all cached access decisions for a user — call after
// they (re-)bind / unlink Discord so the next zone check goes upstream.
func (s *ZoneService) InvalidateUser(userID uint) {
	s.cache.invalidateUser(userID)
}

func requiredDiscordScopes(rules []model.ZoneRule) []string {
	needGuilds := false
	needGuildsRead := false
	for _, r := range rules {
		switch r.Kind {
		case model.ZoneRuleDiscordGuildMember:
			needGuilds = true
		case model.ZoneRuleDiscordGuildRole:
			needGuilds = true
			needGuildsRead = true
		}
	}
	out := []string{scopeDiscordIdentify}
	if needGuilds {
		out = append(out, scopeDiscordGuilds)
	}
	if needGuildsRead {
		out = append(out, scopeDiscordGuildsRead)
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
	// Errors are not cached — they're usually transient and we want a retry
	// to actually hit upstream. Need_reauth IS cached briefly so we don't
	// spam core with refresh attempts on a revoked token.
	if d.Status == AccessStatusError {
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
	client := s.platform.WithToken(userToken)
	resp, err := client.Auth.OAuthBindAuthorize("discord", redirectURI, scopeDiscordGuilds, scopeDiscordGuildsRead)
	if err != nil {
		return "", fmt.Errorf("oauth bind authorize: %w", err)
	}
	return resp.AuthURL, nil
}
