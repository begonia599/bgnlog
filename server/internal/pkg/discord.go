package pkg

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// DiscordClient is a tiny HTTP client for the Discord OAuth2 user-API surface
// the zone gate needs. It deliberately stays narrow so we can extend it as
// new rule kinds are added without dragging in a heavy SDK.
type DiscordClient struct {
	http *http.Client
}

func NewDiscordClient() *DiscordClient {
	return &DiscordClient{
		http: &http.Client{Timeout: 10 * time.Second},
	}
}

// DiscordGuild is a minimal projection of the /users/@me/guilds entries.
type DiscordGuild struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// DiscordGuildMember is the subset of /users/@me/guilds/{guild_id}/member we use.
type DiscordGuildMember struct {
	Roles []string `json:"roles"`
	// Nick, JoinedAt, etc. — currently unused.
}

const discordAPI = "https://discord.com/api/v10"

// ListUserGuilds returns the guilds the user is a member of (requires the
// `guilds` OAuth scope).
func (d *DiscordClient) ListUserGuilds(accessToken string) ([]DiscordGuild, error) {
	req, _ := http.NewRequest(http.MethodGet, discordAPI+"/users/@me/guilds", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := d.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("discord: list guilds: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("discord: list guilds: status %d", resp.StatusCode)
	}
	var out []DiscordGuild
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("discord: decode guilds: %w", err)
	}
	return out, nil
}

// GetGuildMember returns the user's member object inside the given guild
// (requires the `guilds.members.read` OAuth scope). If the user is not in
// the guild, Discord returns 404 — we surface that via found=false rather
// than as an error so callers can distinguish "not a member" from "API broke".
func (d *DiscordClient) GetGuildMember(accessToken, guildID string) (member *DiscordGuildMember, found bool, err error) {
	url := fmt.Sprintf("%s/users/@me/guilds/%s/member", discordAPI, guildID)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := d.http.Do(req)
	if err != nil {
		return nil, false, fmt.Errorf("discord: get member: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, false, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, false, fmt.Errorf("discord: get member: status %d", resp.StatusCode)
	}
	var out DiscordGuildMember
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, false, fmt.Errorf("discord: decode member: %w", err)
	}
	return &out, true, nil
}
