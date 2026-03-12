package repository

import (
	"blog-server/internal/model"

	"gorm.io/gorm"
)

type CategoryRepository struct {
	db *gorm.DB
}

func NewCategoryRepository(db *gorm.DB) *CategoryRepository {
	return &CategoryRepository{db: db}
}

func (r *CategoryRepository) List() ([]model.Category, error) {
	var categories []model.Category
	err := r.db.Order("sort_order ASC, id ASC").Find(&categories).Error
	return categories, err
}

func (r *CategoryRepository) GetByID(id uint) (*model.Category, error) {
	var cat model.Category
	err := r.db.First(&cat, id).Error
	return &cat, err
}

func (r *CategoryRepository) GetBySlug(slug string) (*model.Category, error) {
	var cat model.Category
	err := r.db.Where("slug = ?", slug).First(&cat).Error
	return &cat, err
}

func (r *CategoryRepository) Create(cat *model.Category) error {
	return r.db.Create(cat).Error
}

func (r *CategoryRepository) Update(cat *model.Category) error {
	return r.db.Save(cat).Error
}

func (r *CategoryRepository) Delete(id uint) error {
	return r.db.Delete(&model.Category{}, id).Error
}
