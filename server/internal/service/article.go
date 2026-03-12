package service

import (
	"blog-server/internal/model"
	"blog-server/internal/pkg"
	"blog-server/internal/repository"
	"errors"
	"strings"
	"time"
)

type ArticleService struct {
	articleRepo *repository.ArticleRepository
	tagRepo     *repository.TagRepository
}

func NewArticleService(articleRepo *repository.ArticleRepository, tagRepo *repository.TagRepository) *ArticleService {
	return &ArticleService{articleRepo: articleRepo, tagRepo: tagRepo}
}

type CreateArticleInput struct {
	Title         string `json:"title"`
	Content       string `json:"content"`
	Excerpt       string `json:"excerpt"`
	CoverImageURL string `json:"cover_image_url"`
	CoverFileID   *uint  `json:"cover_file_id"`
	Status        string `json:"status"`
	CategoryID    *uint  `json:"category_id"`
	TagIDs        []uint `json:"tag_ids"`
}

type UpdateArticleInput struct {
	Title         *string `json:"title"`
	Content       *string `json:"content"`
	Excerpt       *string `json:"excerpt"`
	CoverImageURL *string `json:"cover_image_url"`
	CoverFileID   *uint   `json:"cover_file_id"`
	Status        *string `json:"status"`
	CategoryID    *uint   `json:"category_id"`
	TagIDs        *[]uint `json:"tag_ids"`
}

func (s *ArticleService) List(p pkg.Pagination, category, tag string) ([]model.Article, int64, error) {
	return s.articleRepo.List(p, category, tag, "published")
}

func (s *ArticleService) ListDrafts(p pkg.Pagination, userID uint, role string) ([]model.Article, int64, error) {
	authorID := userID
	if role == "admin" {
		authorID = 0 // admin sees all drafts
	}
	return s.articleRepo.ListDrafts(p, authorID)
}

func (s *ArticleService) GetBySlug(slug string) (*model.Article, error) {
	return s.articleRepo.GetBySlug(slug)
}

func (s *ArticleService) Create(input CreateArticleInput, authorID uint, authorName string) (*model.Article, error) {
	if input.Title == "" {
		return nil, errors.New("title is required")
	}

	slug := pkg.UniqueSlug(input.Title)

	status := input.Status
	if status == "" {
		status = "draft"
	}

	var publishedAt *time.Time
	if status == "published" {
		now := time.Now()
		publishedAt = &now
	}

	article := &model.Article{
		Title:         input.Title,
		Slug:          slug,
		Content:       input.Content,
		Excerpt:       input.Excerpt,
		CoverImageURL: input.CoverImageURL,
		CoverFileID:   input.CoverFileID,
		Status:        status,
		AuthorID:      authorID,
		AuthorName:    authorName,
		CategoryID:    input.CategoryID,
		PublishedAt:   publishedAt,
	}

	if err := s.articleRepo.Create(article); err != nil {
		return nil, err
	}

	if len(input.TagIDs) > 0 {
		tags, err := s.tagRepo.GetByIDs(input.TagIDs)
		if err != nil {
			return nil, err
		}
		if err := s.articleRepo.ReplaceTags(article.ID, tags); err != nil {
			return nil, err
		}
	}

	return s.articleRepo.GetByID(article.ID)
}

func (s *ArticleService) Update(id uint, input UpdateArticleInput, userID uint, role string) (*model.Article, error) {
	article, err := s.articleRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if role != "admin" && article.AuthorID != userID {
		return nil, errors.New("not authorized to edit this article")
	}

	if input.Title != nil {
		article.Title = *input.Title
		article.Slug = pkg.UniqueSlug(*input.Title)
	}
	if input.Content != nil {
		article.Content = *input.Content
	}
	if input.Excerpt != nil {
		article.Excerpt = *input.Excerpt
	}
	if input.CoverImageURL != nil {
		article.CoverImageURL = *input.CoverImageURL
	}
	if input.CoverFileID != nil {
		article.CoverFileID = input.CoverFileID
	}
	if input.CategoryID != nil {
		article.CategoryID = input.CategoryID
	}
	if input.Status != nil {
		oldStatus := article.Status
		article.Status = *input.Status
		if oldStatus == "draft" && *input.Status == "published" && article.PublishedAt == nil {
			now := time.Now()
			article.PublishedAt = &now
		}
	}

	if err := s.articleRepo.Update(article); err != nil {
		return nil, err
	}

	if input.TagIDs != nil {
		tags, err := s.tagRepo.GetByIDs(*input.TagIDs)
		if err != nil {
			return nil, err
		}
		if err := s.articleRepo.ReplaceTags(article.ID, tags); err != nil {
			return nil, err
		}
	}

	return s.articleRepo.GetByID(article.ID)
}

func (s *ArticleService) Delete(id uint, userID uint, role string) error {
	if role != "admin" {
		return errors.New("only admin can delete articles")
	}
	return s.articleRepo.Delete(id)
}

func (s *ArticleService) IncrementView(id uint) {
	_ = s.articleRepo.IncrementViewCount(id)
}

func (s *ArticleService) Search(query string, p pkg.Pagination) ([]model.Article, int64, error) {
	// Convert query for tsquery: split words and join with &
	words := strings.Fields(query)
	tsQuery := strings.Join(words, " & ")
	if tsQuery == "" {
		return nil, 0, nil
	}
	return s.articleRepo.Search(tsQuery, p)
}

func (s *ArticleService) GetArchives() ([]repository.ArchiveItem, error) {
	return s.articleRepo.GetArchives()
}

func (s *ArticleService) GetArticlesByYearMonth(year, month int) ([]model.Article, error) {
	return s.articleRepo.GetArticlesByYearMonth(year, month)
}
