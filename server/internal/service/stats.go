package service

import (
	"sync"
	"time"
)

// SettingKeySiteLaunchedAt is the site_settings key holding the day the site
// went live (YYYY-MM-DD, site-local). Empty/missing falls back to
// DefaultSiteLaunchedAt.
const SettingKeySiteLaunchedAt = "site_launched_at"

// siteTZ is the calendar used for "today" and for interpreting the launch
// date. Fixed offset rather than a named zone so behaviour does not depend on
// the container having tzdata.
var siteTZ = time.FixedZone("UTC+8", 8*3600)

// DefaultSiteLaunchedAt is the first commit / first deploy of the blog.
var DefaultSiteLaunchedAt = time.Date(2026, 3, 12, 0, 0, 0, 0, siteTZ)

// visitDedupWindow: the same visitor key is counted at most once per window,
// so refreshes and in-app navigation do not inflate the count. The frontend
// additionally pings only once per browser session.
const visitDedupWindow = 30 * time.Minute

// maxSeenEntries bounds the in-memory dedup map before a prune pass.
const maxSeenEntries = 10000

// VisitStore is the persistence needed by StatsService (implemented by
// repository.VisitRepository).
type VisitStore interface {
	Increment(day string) error
	Total() (int64, error)
	CountForDay(day string) (int64, error)
}

// SettingReader is the subset of repository.SettingRepository StatsService uses.
type SettingReader interface {
	GetMultiple(keys []string) (map[string]string, error)
}

// SiteStats is what the frontend widget renders.
type SiteStats struct {
	LaunchedAt  time.Time `json:"launched_at"`
	TotalVisits int64     `json:"total_visits"`
	TodayVisits int64     `json:"today_visits"`
}

type StatsService struct {
	visits   VisitStore
	settings SettingReader
	now      func() time.Time

	mu   sync.Mutex
	seen map[string]time.Time // visitor key → last counted
}

func NewStatsService(visits VisitStore, settings SettingReader) *StatsService {
	return &StatsService{
		visits:   visits,
		settings: settings,
		now:      time.Now,
		seen:     make(map[string]time.Time),
	}
}

// RecordVisit counts one visit for visitorKey unless the same key was already
// counted within visitDedupWindow. Returns whether it was counted.
func (s *StatsService) RecordVisit(visitorKey string) (bool, error) {
	now := s.now()

	s.mu.Lock()
	if last, ok := s.seen[visitorKey]; ok && now.Sub(last) < visitDedupWindow {
		s.mu.Unlock()
		return false, nil
	}
	s.seen[visitorKey] = now
	if len(s.seen) > maxSeenEntries {
		s.pruneLocked(now)
	}
	s.mu.Unlock()

	if err := s.visits.Increment(dayOf(now)); err != nil {
		return false, err
	}
	return true, nil
}

// pruneLocked drops expired dedup entries; caller holds s.mu.
func (s *StatsService) pruneLocked(now time.Time) {
	for k, t := range s.seen {
		if now.Sub(t) >= visitDedupWindow {
			delete(s.seen, k)
		}
	}
}

// GetSiteStats returns launch date plus lifetime and today's visit counts.
func (s *StatsService) GetSiteStats() (*SiteStats, error) {
	launched, err := s.LaunchedAt()
	if err != nil {
		return nil, err
	}
	total, err := s.visits.Total()
	if err != nil {
		return nil, err
	}
	today, err := s.visits.CountForDay(dayOf(s.now()))
	if err != nil {
		return nil, err
	}
	return &SiteStats{LaunchedAt: launched, TotalVisits: total, TodayVisits: today}, nil
}

// LaunchedAt reads the configured launch day, falling back to the default when
// unset or malformed.
func (s *StatsService) LaunchedAt() (time.Time, error) {
	m, err := s.settings.GetMultiple([]string{SettingKeySiteLaunchedAt})
	if err != nil {
		return time.Time{}, err
	}
	if v := m[SettingKeySiteLaunchedAt]; v != "" {
		if t, perr := time.ParseInLocation("2006-01-02", v, siteTZ); perr == nil {
			return t, nil
		}
	}
	return DefaultSiteLaunchedAt, nil
}

// dayOf formats t as a site-local calendar day.
func dayOf(t time.Time) string {
	return t.In(siteTZ).Format("2006-01-02")
}
