package service

import (
	"blog-server/internal/model"
	"blog-server/internal/repository"
	"errors"
	"fmt"
	"hash/fnv"
	"time"
)

var (
	ErrPostNotFound    = errors.New("zone post not found")
	ErrCommentNotFound = errors.New("zone comment not found")
	ErrNotPostOwner    = errors.New("you are not the owner of this post")
	ErrNotCommentOwner = errors.New("you are not the owner of this comment")
)

type ZonePostService struct {
	repo     *repository.ZonePostRepository
	zoneRepo *repository.ZoneRepository
}

func NewZonePostService(repo *repository.ZonePostRepository, zoneRepo *repository.ZoneRepository) *ZonePostService {
	return &ZonePostService{repo: repo, zoneRepo: zoneRepo}
}

// --- anonymous identity ---

// anonAlias produces a stable, short alias like "匿名用户#A3F2" for a given
// (zoneID, userID) pair. The same person always gets the same alias inside the
// same zone but a different one in another zone.
func anonAlias(zoneID, userID uint) string {
	h := fnv.New32a()
	_, _ = fmt.Fprintf(h, "%d:%d", zoneID, userID)
	return fmt.Sprintf("匿名用户#%04X", h.Sum32()%0x10000)
}

// --- post author response ---

// PostResponse is the public-facing representation of a ZonePost.
// Anonymous posts replace the author info with an alias.
type PostResponse struct {
	ID           uint      `json:"id"`
	ZoneID       uint      `json:"zone_id"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	IsAnonymous  bool      `json:"is_anonymous"`
	IsPinned     bool      `json:"is_pinned"`
	Status       string    `json:"status"`
	CommentCount int       `json:"comment_count"`
	AuthorName   string    `json:"author_name"`
	AuthorAvatar string    `json:"author_avatar"`
	IsOwner      bool      `json:"is_owner"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func toPostResponse(p *model.ZonePost, viewerID uint) PostResponse {
	r := PostResponse{
		ID:           p.ID,
		ZoneID:       p.ZoneID,
		Title:        p.Title,
		Content:      p.Content,
		IsAnonymous:  p.IsAnonymous,
		IsPinned:     p.IsPinned,
		Status:       p.Status,
		CommentCount: p.CommentCount,
		IsOwner:      p.UserID == viewerID,
		CreatedAt:    p.CreatedAt,
		UpdatedAt:    p.UpdatedAt,
	}
	if p.IsAnonymous {
		r.AuthorName = anonAlias(p.ZoneID, p.UserID)
		r.AuthorAvatar = ""
	} else {
		r.AuthorName = p.AuthorName
		r.AuthorAvatar = p.AuthorAvatar
	}
	return r
}

// CommentResponse is the public-facing representation of a ZoneComment.
type CommentResponse struct {
	ID           uint      `json:"id"`
	PostID       uint      `json:"post_id"`
	ParentID     *uint     `json:"parent_id,omitempty"`
	Content      string    `json:"content"`
	IsAnonymous  bool      `json:"is_anonymous"`
	AuthorName   string    `json:"author_name"`
	AuthorAvatar string    `json:"author_avatar"`
	IsOwner      bool      `json:"is_owner"`
	CreatedAt    time.Time `json:"created_at"`
}

func toCommentResponse(c *model.ZoneComment, zoneID, viewerID uint) CommentResponse {
	r := CommentResponse{
		ID:          c.ID,
		PostID:      c.PostID,
		ParentID:    c.ParentID,
		Content:     c.Content,
		IsAnonymous: c.IsAnonymous,
		IsOwner:     c.UserID == viewerID,
		CreatedAt:   c.CreatedAt,
	}
	if c.IsAnonymous {
		r.AuthorName = anonAlias(zoneID, c.UserID)
		r.AuthorAvatar = ""
	} else {
		r.AuthorName = c.AuthorName
		r.AuthorAvatar = c.AuthorAvatar
	}
	return r
}

// --- posts ---

type CreatePostInput struct {
	ZoneID       uint
	UserID       uint
	Title        string
	Content      string
	IsAnonymous  bool
	AuthorName   string
	AuthorAvatar string
}

func (s *ZonePostService) CreatePost(in CreatePostInput) (*PostResponse, error) {
	if in.Title == "" || in.Content == "" {
		return nil, errors.New("title and content are required")
	}
	p := &model.ZonePost{
		ZoneID:       in.ZoneID,
		UserID:       in.UserID,
		Title:        in.Title,
		Content:      in.Content,
		IsAnonymous:  in.IsAnonymous,
		Status:       model.ZonePostStatusOpen,
		AuthorName:   in.AuthorName,
		AuthorAvatar: in.AuthorAvatar,
	}
	if err := s.repo.Create(p); err != nil {
		return nil, err
	}
	resp := toPostResponse(p, in.UserID)
	return &resp, nil
}

type ListPostsResult struct {
	Posts []PostResponse `json:"posts"`
	Total int64          `json:"total"`
	Page  int            `json:"page"`
	Size  int            `json:"size"`
}

func (s *ZonePostService) ListPosts(zoneID uint, viewerID uint, page, pageSize int) (*ListPostsResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}
	posts, total, err := s.repo.ListByZone(zoneID, page, pageSize)
	if err != nil {
		return nil, err
	}
	out := make([]PostResponse, len(posts))
	for i := range posts {
		out[i] = toPostResponse(&posts[i], viewerID)
	}
	return &ListPostsResult{Posts: out, Total: total, Page: page, Size: pageSize}, nil
}

func (s *ZonePostService) GetPost(postID, viewerID uint) (*PostResponse, error) {
	p, err := s.repo.GetByID(postID)
	if err != nil {
		return nil, ErrPostNotFound
	}
	resp := toPostResponse(p, viewerID)
	return &resp, nil
}

func (s *ZonePostService) UpdatePostStatus(postID, userID uint, status string, isAdmin bool) error {
	p, err := s.repo.GetByID(postID)
	if err != nil {
		return ErrPostNotFound
	}
	if p.UserID != userID && !isAdmin {
		return ErrNotPostOwner
	}
	switch status {
	case model.ZonePostStatusOpen, model.ZonePostStatusClosed, model.ZonePostStatusResolved:
	default:
		return errors.New("invalid status")
	}
	p.Status = status
	return s.repo.Update(p)
}

func (s *ZonePostService) TogglePin(postID uint, pinned bool) error {
	p, err := s.repo.GetByID(postID)
	if err != nil {
		return ErrPostNotFound
	}
	p.IsPinned = pinned
	return s.repo.Update(p)
}

func (s *ZonePostService) DeletePost(postID, userID uint, isAdmin bool) error {
	p, err := s.repo.GetByID(postID)
	if err != nil {
		return ErrPostNotFound
	}
	if p.UserID != userID && !isAdmin {
		return ErrNotPostOwner
	}
	return s.repo.Delete(postID)
}

// --- comments ---

type CreateCommentInput struct {
	PostID       uint
	UserID       uint
	Content      string
	ParentID     *uint
	IsAnonymous  bool
	AuthorName   string
	AuthorAvatar string
}

func (s *ZonePostService) CreateComment(in CreateCommentInput) (*CommentResponse, error) {
	if in.Content == "" {
		return nil, errors.New("content is required")
	}
	post, err := s.repo.GetByID(in.PostID)
	if err != nil {
		return nil, ErrPostNotFound
	}
	c := &model.ZoneComment{
		PostID:       in.PostID,
		UserID:       in.UserID,
		Content:      in.Content,
		ParentID:     in.ParentID,
		IsAnonymous:  in.IsAnonymous,
		AuthorName:   in.AuthorName,
		AuthorAvatar: in.AuthorAvatar,
	}
	if err := s.repo.CreateComment(c); err != nil {
		return nil, err
	}
	_ = s.repo.IncrementCommentCount(in.PostID)
	resp := toCommentResponse(c, post.ZoneID, in.UserID)
	return &resp, nil
}

func (s *ZonePostService) ListComments(postID, viewerID uint) ([]CommentResponse, error) {
	post, err := s.repo.GetByID(postID)
	if err != nil {
		return nil, ErrPostNotFound
	}
	comments, err := s.repo.ListComments(postID)
	if err != nil {
		return nil, err
	}
	out := make([]CommentResponse, len(comments))
	for i := range comments {
		out[i] = toCommentResponse(&comments[i], post.ZoneID, viewerID)
	}
	return out, nil
}

func (s *ZonePostService) DeleteComment(commentID, userID uint, isAdmin bool) error {
	c, err := s.repo.GetComment(commentID)
	if err != nil {
		return ErrCommentNotFound
	}
	if c.UserID != userID && !isAdmin {
		return ErrNotCommentOwner
	}
	if err := s.repo.DeleteComment(commentID); err != nil {
		return err
	}
	_ = s.repo.DecrementCommentCount(c.PostID)
	return nil
}
