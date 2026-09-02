package model

import "time"

// ArticleLike records that a logged-in user liked an article. One row per
// (article, user); toggling a like deletes the row. Counts are derived with
// COUNT(*) rather than stored on articles, so no migration of the
// SQL-managed articles table is needed.
type ArticleLike struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ArticleID uint      `gorm:"not null;uniqueIndex:idx_article_likes_article_user" json:"article_id"`
	UserID    uint      `gorm:"not null;uniqueIndex:idx_article_likes_article_user" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (ArticleLike) TableName() string { return "article_likes" }
