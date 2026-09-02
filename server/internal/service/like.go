package service

import (
	"errors"

	"blog-server/internal/model"
)

// ErrLikeTargetNotFound is returned when the slug does not resolve to a
// published article. Drafts are reported as not found so they do not leak.
var ErrLikeTargetNotFound = errors.New("article not found")

// LikeStore is the persistence LikeService needs (repository.LikeRepository).
type LikeStore interface {
	Toggle(articleID, userID uint) (bool, error)
	Count(articleID uint) (int64, error)
	CountByArticleIDs(ids []uint) (map[uint]int64, error)
	LikedByUser(ids []uint, userID uint) (map[uint]bool, error)
}

// ArticleLookup resolves slugs (repository.ArticleRepository).
type ArticleLookup interface {
	GetBySlug(slug string) (*model.Article, error)
}

// LikeState is the response of a toggle.
type LikeState struct {
	Liked     bool  `json:"liked"`
	LikeCount int64 `json:"like_count"`
}

type LikeService struct {
	likes    LikeStore
	articles ArticleLookup
}

func NewLikeService(likes LikeStore, articles ArticleLookup) *LikeService {
	return &LikeService{likes: likes, articles: articles}
}

// Toggle likes or unlikes the published article identified by slug on behalf
// of userID and returns the new state.
func (s *LikeService) Toggle(slug string, userID uint) (*LikeState, error) {
	a, err := s.articles.GetBySlug(slug)
	if err != nil || a.Status != "published" {
		return nil, ErrLikeTargetNotFound
	}
	liked, err := s.likes.Toggle(a.ID, userID)
	if err != nil {
		return nil, err
	}
	count, err := s.likes.Count(a.ID)
	if err != nil {
		return nil, err
	}
	return &LikeState{Liked: liked, LikeCount: count}, nil
}

// Decorate fills LikeCount and Liked on the given articles for viewerID
// (0 = anonymous, Liked stays false). One query per field regardless of how
// many articles are passed.
func (s *LikeService) Decorate(viewerID uint, articles ...*model.Article) error {
	if len(articles) == 0 {
		return nil
	}
	ids := make([]uint, 0, len(articles))
	for _, a := range articles {
		ids = append(ids, a.ID)
	}
	counts, err := s.likes.CountByArticleIDs(ids)
	if err != nil {
		return err
	}
	liked := map[uint]bool{}
	if viewerID != 0 {
		if liked, err = s.likes.LikedByUser(ids, viewerID); err != nil {
			return err
		}
	}
	for _, a := range articles {
		a.LikeCount = counts[a.ID]
		a.Liked = liked[a.ID]
	}
	return nil
}
