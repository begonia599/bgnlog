package repository

import (
	"blog-server/internal/model"

	"gorm.io/gorm"
)

type CommentRepository struct {
	db *gorm.DB
}

func NewCommentRepository(db *gorm.DB) *CommentRepository {
	return &CommentRepository{db: db}
}

func (r *CommentRepository) ListByArticleID(articleID uint) ([]model.Comment, error) {
	var comments []model.Comment
	err := r.db.Where("article_id = ?", articleID).
		Order("created_at ASC").
		Find(&comments).Error
	return comments, err
}

func (r *CommentRepository) GetByID(id uint) (*model.Comment, error) {
	var comment model.Comment
	err := r.db.First(&comment, id).Error
	return &comment, err
}

func (r *CommentRepository) Create(comment *model.Comment) error {
	return r.db.Create(comment).Error
}

func (r *CommentRepository) Update(comment *model.Comment) error {
	return r.db.Save(comment).Error
}

func (r *CommentRepository) Delete(id uint) error {
	return r.db.Delete(&model.Comment{}, id).Error
}
