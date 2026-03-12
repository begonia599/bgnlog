package model

import "time"

type Comment struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	ArticleID uint       `gorm:"not null;index" json:"article_id"`
	Article   *Article   `gorm:"foreignKey:ArticleID" json:"-"`
	ParentID  *uint      `gorm:"index" json:"parent_id"`
	UserID    uint       `gorm:"not null" json:"user_id"`
	Username  string     `gorm:"size:100;not null" json:"username"`
	AvatarURL string     `gorm:"size:500" json:"avatar_url"`
	Content   string     `gorm:"type:text;not null" json:"content"`
	Children  []*Comment `gorm:"-" json:"children,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}
