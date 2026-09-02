package service

import (
	"errors"
	"testing"

	"blog-server/internal/model"
)

type fakeLikeStore struct {
	likes map[uint]map[uint]bool // articleID → userID → liked
}

func (f *fakeLikeStore) set(articleID, userID uint) map[uint]bool {
	if f.likes == nil {
		f.likes = map[uint]map[uint]bool{}
	}
	if f.likes[articleID] == nil {
		f.likes[articleID] = map[uint]bool{}
	}
	return f.likes[articleID]
}
func (f *fakeLikeStore) Toggle(articleID, userID uint) (bool, error) {
	m := f.set(articleID, userID)
	if m[userID] {
		delete(m, userID)
		return false, nil
	}
	m[userID] = true
	return true, nil
}
func (f *fakeLikeStore) Count(articleID uint) (int64, error) {
	return int64(len(f.likes[articleID])), nil
}
func (f *fakeLikeStore) CountByArticleIDs(ids []uint) (map[uint]int64, error) {
	out := map[uint]int64{}
	for _, id := range ids {
		if n := len(f.likes[id]); n > 0 {
			out[id] = int64(n)
		}
	}
	return out, nil
}
func (f *fakeLikeStore) LikedByUser(ids []uint, userID uint) (map[uint]bool, error) {
	out := map[uint]bool{}
	for _, id := range ids {
		if f.likes[id][userID] {
			out[id] = true
		}
	}
	return out, nil
}

type fakeArticles map[string]*model.Article

func (f fakeArticles) GetBySlug(slug string) (*model.Article, error) {
	if a, ok := f[slug]; ok {
		return a, nil
	}
	return nil, errors.New("not found")
}

func TestLikeToggle_FlipsAndCounts(t *testing.T) {
	store := &fakeLikeStore{}
	svc := NewLikeService(store, fakeArticles{
		"hello": {ID: 1, Status: "published"},
		"draft": {ID: 2, Status: "draft"},
	})

	st, err := svc.Toggle("hello", 7)
	if err != nil || !st.Liked || st.LikeCount != 1 {
		t.Fatalf("first toggle: want liked/1, got %+v err=%v", st, err)
	}
	svc.Toggle("hello", 8)
	st, _ = svc.Toggle("hello", 7)
	if st.Liked || st.LikeCount != 1 {
		t.Fatalf("second toggle by same user: want unliked/1, got %+v", st)
	}

	for _, slug := range []string{"draft", "missing"} {
		if _, err := svc.Toggle(slug, 7); !errors.Is(err, ErrLikeTargetNotFound) {
			t.Fatalf("%s: expected ErrLikeTargetNotFound, got %v", slug, err)
		}
	}
	if n, _ := store.Count(2); n != 0 {
		t.Fatal("draft must not receive likes")
	}
}

func TestLikeDecorate_FillsCountsAndViewerState(t *testing.T) {
	store := &fakeLikeStore{}
	store.Toggle(1, 7)
	store.Toggle(1, 8)
	store.Toggle(3, 8)
	svc := NewLikeService(store, fakeArticles{})

	a1, a2, a3 := &model.Article{ID: 1}, &model.Article{ID: 2}, &model.Article{ID: 3}

	if err := svc.Decorate(7, a1, a2, a3); err != nil {
		t.Fatal(err)
	}
	if a1.LikeCount != 2 || !a1.Liked {
		t.Fatalf("a1: want 2/liked, got %d/%v", a1.LikeCount, a1.Liked)
	}
	if a2.LikeCount != 0 || a2.Liked {
		t.Fatalf("a2: want 0/not liked, got %d/%v", a2.LikeCount, a2.Liked)
	}
	if a3.LikeCount != 1 || a3.Liked {
		t.Fatalf("a3: want 1/not liked by 7, got %d/%v", a3.LikeCount, a3.Liked)
	}

	// Anonymous viewer: counts present, Liked always false.
	b1 := &model.Article{ID: 1}
	if err := svc.Decorate(0, b1); err != nil {
		t.Fatal(err)
	}
	if b1.LikeCount != 2 || b1.Liked {
		t.Fatalf("anonymous: want 2/not liked, got %d/%v", b1.LikeCount, b1.Liked)
	}

	if err := svc.Decorate(7); err != nil {
		t.Fatalf("empty input must be a no-op, got %v", err)
	}
}
