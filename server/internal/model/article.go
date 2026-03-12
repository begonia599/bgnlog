package model

import "time"

type Article struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	Title         string     `gorm:"size:255;not null" json:"title"`
	Slug          string     `gorm:"size:255;uniqueIndex;not null" json:"slug"`
	Content       string     `gorm:"type:text" json:"content"`
	Excerpt       string     `gorm:"size:500" json:"excerpt"`
	CoverImageURL string     `gorm:"size:500" json:"cover_image_url"`
	CoverFileID   *uint      `json:"cover_file_id"`
	Status        string     `gorm:"size:20;default:draft;not null;index" json:"status"` // draft | published
	AuthorID      uint       `gorm:"not null;index" json:"author_id"`
	AuthorName    string     `gorm:"size:100;not null" json:"author_name"`
	CategoryID    *uint      `gorm:"index" json:"category_id"`
	Category      *Category  `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Tags          []Tag      `gorm:"many2many:article_tags" json:"tags,omitempty"`
	ViewCount     int        `gorm:"default:0" json:"view_count"`
	PublishedAt   *time.Time `gorm:"index" json:"published_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}
