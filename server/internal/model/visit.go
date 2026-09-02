package model

import "time"

// SiteVisitDaily aggregates site visits per calendar day (site-local time,
// UTC+8). One row per day; the lifetime total shown by the stats widget is
// the sum of Count over all rows.
type SiteVisitDaily struct {
	Day       string    `gorm:"primaryKey;size:10" json:"day"` // YYYY-MM-DD
	Count     int64     `gorm:"not null;default:0" json:"count"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName avoids GORM's default pluralisation ("site_visit_dailies").
func (SiteVisitDaily) TableName() string { return "site_visits_daily" }
