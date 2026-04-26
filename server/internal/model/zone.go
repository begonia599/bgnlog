package model

import "time"

// Zone is an admin-curated, gated section of the site (e.g. a project area or
// custom community). Visibility metadata is always public so the listing page
// can render zone cards; actual content access is gated by ZoneRule on top of
// Discord OAuth authorization.
//
// MVP: a zone has zero or more rules. The zone is accessible if the user
// satisfies AT LEAST ONE rule (OR logic). A zone with no rules is
// effectively "public for any logged-in user".
type Zone struct {
	ID            uint   `gorm:"primaryKey" json:"id"`
	Slug          string `gorm:"size:64;uniqueIndex;not null" json:"slug"`
	Name          string `gorm:"size:128;not null" json:"name"`
	Description   string `gorm:"size:1000" json:"description"`
	CoverImageURL string `gorm:"size:500" json:"cover_image_url"`
	OwnerID       uint   `gorm:"index;not null" json:"owner_id"`

	// Visibility:
	//   public  — anyone can see content, no gating
	//   gated   — content requires passing access rules
	Visibility string `gorm:"size:16;not null;default:gated;index" json:"visibility"`

	// RuleLogic controls how multiple rules combine:
	//   or  (default) — pass if ANY rule matches
	//   and           — pass only if ALL rules match
	RuleLogic string `gorm:"size:4;not null;default:or" json:"rule_logic"`

	// Sort order on the listing page; smaller comes first.
	SortOrder int `gorm:"default:0" json:"sort_order"`

	Rules []ZoneRule `gorm:"foreignKey:ZoneID;constraint:OnDelete:CASCADE" json:"rules,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ZoneRule is a single access predicate.
//
// Rule kinds:
//
//   - discord_guild_member    : user must be a member of GuildID
//   - discord_guild_role      : user must hold RoleID inside GuildID
//   - discord_guild_boost     : user must be boosting GuildID (premium_since != nil)
//   - discord_guild_join_days : user must have been in GuildID for >= Value days
//   - discord_account_age     : Discord account must be >= Value days old
//   - discord_connection      : user must have a linked connection of type Value (e.g. "steam", "twitch")
type ZoneRule struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	ZoneID uint   `gorm:"index;not null" json:"zone_id"`
	Kind   string `gorm:"size:32;not null" json:"kind"`

	// For guild-related rules:
	GuildID string `gorm:"size:64" json:"guild_id,omitempty"`
	RoleID  string `gorm:"size:64" json:"role_id,omitempty"`

	// Generic numeric parameter (days for join_days/account_age).
	Value int `gorm:"default:0" json:"value,omitempty"`

	// Generic string parameter (connection type for discord_connection, etc.).
	ValueStr string `gorm:"size:64" json:"value_str,omitempty"`

	// Human-readable description shown to both admin and end-users
	// (e.g. "加入 XXX 服务器 30 天以上").
	Description string `gorm:"size:256" json:"description,omitempty"`

	// Free-form admin-only note.
	Label string `gorm:"size:128" json:"label,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

const (
	ZoneVisibilityPublic = "public"
	ZoneVisibilityGated  = "gated"

	ZoneRuleDiscordGuildMember   = "discord_guild_member"
	ZoneRuleDiscordGuildRole     = "discord_guild_role"
	ZoneRuleDiscordGuildBoost    = "discord_guild_boost"
	ZoneRuleDiscordGuildJoinDays = "discord_guild_join_days"
	ZoneRuleDiscordAccountAge    = "discord_account_age"
	ZoneRuleDiscordConnection    = "discord_connection"

	// RuleLogic — stored on Zone.
	ZoneRuleLogicOR  = "or"
	ZoneRuleLogicAND = "and"
)
