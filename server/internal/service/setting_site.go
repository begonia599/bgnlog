package service

import (
	"errors"
	"fmt"
	"time"
)

// ErrInvalidSetting is returned when an admin submits a malformed setting value.
var ErrInvalidSetting = errors.New("invalid setting")

// SiteInfoSettings is the admin-editable site metadata that is not part of
// the hero section.
type SiteInfoSettings struct {
	// LaunchedAt is the day the site went live, YYYY-MM-DD (site-local).
	// Drives the "已运行" counter in the stats widget.
	LaunchedAt string `json:"launched_at"`
	// IsDefault reports whether LaunchedAt is the built-in fallback rather
	// than a stored value.
	IsDefault bool `json:"is_default"`
}

// GetSiteInfo returns the stored launch date or the default.
func (s *SettingService) GetSiteInfo() (*SiteInfoSettings, error) {
	m, err := s.repo.GetMultiple([]string{SettingKeySiteLaunchedAt})
	if err != nil {
		return nil, err
	}
	if v := m[SettingKeySiteLaunchedAt]; v != "" {
		if _, perr := time.ParseInLocation("2006-01-02", v, siteTZ); perr == nil {
			return &SiteInfoSettings{LaunchedAt: v}, nil
		}
	}
	return &SiteInfoSettings{LaunchedAt: DefaultSiteLaunchedAt.Format("2006-01-02"), IsDefault: true}, nil
}

// UpdateSiteInfo stores the launch date. An empty value clears the override so
// the default applies again; anything else must be YYYY-MM-DD and not in the
// future.
func (s *SettingService) UpdateSiteInfo(in *SiteInfoSettings) error {
	v := in.LaunchedAt
	if v != "" {
		t, err := time.ParseInLocation("2006-01-02", v, siteTZ)
		if err != nil {
			return fmt.Errorf("%w: launched_at must be YYYY-MM-DD", ErrInvalidSetting)
		}
		if t.After(time.Now().In(siteTZ)) {
			return fmt.Errorf("%w: launched_at cannot be in the future", ErrInvalidSetting)
		}
	}
	return s.repo.SetMultiple(map[string]string{SettingKeySiteLaunchedAt: v})
}
