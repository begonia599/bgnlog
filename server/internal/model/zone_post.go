package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// StringSlice is a []string stored as JSON in the database.
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal(s)
	return string(b), err
}

func (s *StringSlice) Scan(src any) error {
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, s)
	case string:
		return json.Unmarshal([]byte(v), s)
	case nil:
		*s = nil
		return nil
	default:
		return fmt.Errorf("unsupported type: %T", src)
	}
}

// ZonePost is a user-created post inside a Zone — feedback, question, or
// discussion. Authors can choose to post anonymously; in that case the API
// response omits the real identity and shows a stable per-zone anonymous alias.
type ZonePost struct {
	ID     uint `gorm:"primaryKey" json:"id"`
	ZoneID uint `gorm:"index;not null" json:"zone_id"`
	UserID uint `gorm:"index;not null" json:"-"` // hidden from JSON; exposed as author_*

	Title   string      `gorm:"size:256;not null" json:"title"`
	Content string      `gorm:"type:text;not null" json:"content"`
	Images  StringSlice `gorm:"type:text" json:"images"` // JSON array of image URLs

	// Anonymous: when true the API never reveals UserID / real name.
	IsAnonymous bool `gorm:"default:false;not null" json:"is_anonymous"`

	// Pinned: admin can pin important posts to the top.
	IsPinned bool `gorm:"default:false;not null" json:"is_pinned"`

	// Status tag — open / closed / resolved — lets the author or admin mark
	// the lifecycle of a feedback thread.
	Status string `gorm:"size:16;not null;default:open" json:"status"`

	CommentCount int `gorm:"default:0;not null" json:"comment_count"`

	// Denormalized author info (filled at creation time so we don't need a
	// join for listing). Hidden when is_anonymous is true.
	AuthorName   string `gorm:"size:100;not null" json:"-"`
	AuthorAvatar string `gorm:"size:500" json:"-"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

const (
	ZonePostStatusOpen     = "open"
	ZonePostStatusClosed   = "closed"
	ZonePostStatusResolved = "resolved"
)

// ZoneComment is a reply on a ZonePost. Like posts, individual comments can be
// anonymous (independently of whether the parent post was anonymous).
type ZoneComment struct {
	ID     uint `gorm:"primaryKey" json:"id"`
	PostID uint `gorm:"index;not null" json:"post_id"`
	UserID uint `gorm:"index;not null" json:"-"`

	Content string `gorm:"type:text;not null" json:"content"`

	// ParentID allows one level of nesting (reply-to-comment).
	ParentID *uint `gorm:"index" json:"parent_id,omitempty"`

	IsAnonymous bool `gorm:"default:false;not null" json:"is_anonymous"`

	// Denormalized author info.
	AuthorName   string `gorm:"size:100;not null" json:"-"`
	AuthorAvatar string `gorm:"size:500" json:"-"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
