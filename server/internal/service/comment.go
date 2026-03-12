package service

import (
	"blog-server/internal/model"
	"blog-server/internal/repository"
	"errors"
)

type CommentService struct {
	commentRepo *repository.CommentRepository
	articleRepo *repository.ArticleRepository
}

func NewCommentService(commentRepo *repository.CommentRepository, articleRepo *repository.ArticleRepository) *CommentService {
	return &CommentService{commentRepo: commentRepo, articleRepo: articleRepo}
}

func (s *CommentService) ListByArticleSlug(slug string) ([]model.Comment, error) {
	article, err := s.articleRepo.GetBySlug(slug)
	if err != nil {
		return nil, errors.New("article not found")
	}
	return s.commentRepo.ListByArticleID(article.ID)
}

func (s *CommentService) Create(slug string, parentID *uint, userID uint, username, avatarURL, content string) (*model.Comment, error) {
	if content == "" {
		return nil, errors.New("content is required")
	}

	article, err := s.articleRepo.GetBySlug(slug)
	if err != nil {
		return nil, errors.New("article not found")
	}

	comment := &model.Comment{
		ArticleID: article.ID,
		ParentID:  parentID,
		UserID:    userID,
		Username:  username,
		AvatarURL: avatarURL,
		Content:   content,
	}

	if err := s.commentRepo.Create(comment); err != nil {
		return nil, err
	}
	return comment, nil
}

func (s *CommentService) Update(id uint, content string, userID uint, role string) (*model.Comment, error) {
	comment, err := s.commentRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("comment not found")
	}

	if role != "admin" && comment.UserID != userID {
		return nil, errors.New("not authorized")
	}

	comment.Content = content
	if err := s.commentRepo.Update(comment); err != nil {
		return nil, err
	}
	return comment, nil
}

func (s *CommentService) Delete(id uint, userID uint, role string) error {
	comment, err := s.commentRepo.GetByID(id)
	if err != nil {
		return errors.New("comment not found")
	}

	if role != "admin" && comment.UserID != userID {
		return errors.New("not authorized")
	}

	return s.commentRepo.Delete(id)
}
