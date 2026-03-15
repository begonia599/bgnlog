package model

import "time"

// SiteSetting stores key-value pairs for site configuration.
type SiteSetting struct {
	ID        uint      `gorm:"primaryKey" json:"-"`
	Key       string    `gorm:"uniqueIndex;size:100;not null" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}
