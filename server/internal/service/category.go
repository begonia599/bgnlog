package service

import (
	"blog-server/internal/model"
	"blog-server/internal/pkg"
	"blog-server/internal/repository"
	"errors"
)

type CategoryService struct {
	repo *repository.CategoryRepository
}

func NewCategoryService(repo *repository.CategoryRepository) *CategoryService {
	return &CategoryService{repo: repo}
}

func (s *CategoryService) List() ([]model.Category, error) {
	return s.repo.List()
}

func (s *CategoryService) GetByID(id uint) (*model.Category, error) {
	return s.repo.GetByID(id)
}

func (s *CategoryService) Create(name, description string, sortOrder int) (*model.Category, error) {
	if name == "" {
		return nil, errors.New("name is required")
	}

	cat := &model.Category{
		Name:        name,
		Slug:        pkg.GenerateSlug(name),
		Description: description,
		SortOrder:   sortOrder,
	}

	if err := s.repo.Create(cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *CategoryService) Update(id uint, name, description string, sortOrder int) (*model.Category, error) {
	cat, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if name != "" {
		cat.Name = name
		cat.Slug = pkg.GenerateSlug(name)
	}
	cat.Description = description
	cat.SortOrder = sortOrder

	if err := s.repo.Update(cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *CategoryService) Delete(id uint) error {
	return s.repo.Delete(id)
}
