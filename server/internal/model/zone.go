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

	// Sort order on the listing page; smaller comes first.
	SortOrder int `gorm:"default:0" json:"sort_order"`

	Rules []ZoneRule `gorm:"foreignKey:ZoneID;constraint:OnDelete:CASCADE" json:"rules,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ZoneRule is a single access predicate. A user passes a zone gate if any of
// the zone's rules evaluate to true. Rule kinds:
//
//   - discord_guild_member : user must be a member of GuildID
//   - discord_guild_role   : user must hold RoleID inside GuildID
//
// Future: github_org_member, github_team_member, etc. — the kind is a string
// so we don't need a schema change to add providers.
type ZoneRule struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	ZoneID uint   `gorm:"index;not null" json:"zone_id"`
	Kind   string `gorm:"size:32;not null" json:"kind"`

	// For discord_guild_member / discord_guild_role:
	GuildID string `gorm:"size:64" json:"guild_id,omitempty"`
	RoleID  string `gorm:"size:64" json:"role_id,omitempty"`

	// Free-form note shown to admin in the rule list (e.g. "VIP role").
	Label string `gorm:"size:128" json:"label,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

const (
	ZoneVisibilityPublic = "public"
	ZoneVisibilityGated  = "gated"

	ZoneRuleDiscordGuildMember = "discord_guild_member"
	ZoneRuleDiscordGuildRole   = "discord_guild_role"
)
