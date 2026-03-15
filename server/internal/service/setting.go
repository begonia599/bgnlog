package service

import "blog-server/internal/repository"

var heroKeys = []string{"hero_title", "hero_subtitle", "hero_avatar_url", "hero_nickname", "hero_bio", "discord_user_id"}

type SettingService struct {
	repo *repository.SettingRepository
}

func NewSettingService(repo *repository.SettingRepository) *SettingService {
	return &SettingService{repo: repo}
}

// HeroSettings represents the hero section configuration.
type HeroSettings struct {
	Title        string `json:"hero_title"`
	Subtitle     string `json:"hero_subtitle"`
	AvatarURL    string `json:"hero_avatar_url"`
	Nickname     string `json:"hero_nickname"`
	Bio          string `json:"hero_bio"`
	DiscordID    string `json:"discord_user_id"`
}

// GetHeroSettings returns the hero section settings.
func (s *SettingService) GetHeroSettings() (*HeroSettings, error) {
	m, err := s.repo.GetMultiple(heroKeys)
	if err != nil {
		return nil, err
	}
	return &HeroSettings{
		Title:     m["hero_title"],
		Subtitle:  m["hero_subtitle"],
		AvatarURL: m["hero_avatar_url"],
		Nickname:  m["hero_nickname"],
		Bio:       m["hero_bio"],
		DiscordID: m["discord_user_id"],
	}, nil
}

// UpdateHeroSettings updates the hero section settings.
func (s *SettingService) UpdateHeroSettings(h *HeroSettings) error {
	pairs := map[string]string{}
	if h.Title != "" {
		pairs["hero_title"] = h.Title
	}
	if h.Subtitle != "" {
		pairs["hero_subtitle"] = h.Subtitle
	}
	if h.AvatarURL != "" {
		pairs["hero_avatar_url"] = h.AvatarURL
	}
	if len(pairs) == 0 {
		return nil
	}
	return s.repo.SetMultiple(pairs)
}
