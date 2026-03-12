package service

import (
	"blog-server/internal/model"
	"blog-server/internal/pkg"
	"blog-server/internal/repository"
	"errors"
)

type TagService struct {
	repo *repository.TagRepository
}

func NewTagService(repo *repository.TagRepository) *TagService {
	return &TagService{repo: repo}
}

func (s *TagService) List() ([]model.Tag, error) {
	return s.repo.List()
}

func (s *TagService) Create(name string) (*model.Tag, error) {
	if name == "" {
		return nil, errors.New("name is required")
	}

	tag := &model.Tag{
		Name: name,
		Slug: pkg.GenerateSlug(name),
	}

	if err := s.repo.Create(tag); err != nil {
		return nil, err
	}
	return tag, nil
}

func (s *TagService) Delete(id uint) error {
	return s.repo.Delete(id)
}
