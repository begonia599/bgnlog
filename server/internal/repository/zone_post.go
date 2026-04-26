package repository

import (
	"blog-server/internal/model"

	"gorm.io/gorm"
)

type ZonePostRepository struct {
	db *gorm.DB
}

func NewZonePostRepository(db *gorm.DB) *ZonePostRepository {
	return &ZonePostRepository{db: db}
}

// --- posts ---

func (r *ZonePostRepository) ListByZone(zoneID uint, page, pageSize int) ([]model.ZonePost, int64, error) {
	var total int64
	r.db.Model(&model.ZonePost{}).Where("zone_id = ?", zoneID).Count(&total)

	var posts []model.ZonePost
	err := r.db.Where("zone_id = ?", zoneID).
		Order("is_pinned DESC, created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&posts).Error
	return posts, total, err
}

func (r *ZonePostRepository) GetByID(id uint) (*model.ZonePost, error) {
	var p model.ZonePost
	if err := r.db.First(&p, id).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *ZonePostRepository) Create(p *model.ZonePost) error {
	return r.db.Create(p).Error
}

func (r *ZonePostRepository) Update(p *model.ZonePost) error {
	return r.db.Save(p).Error
}

func (r *ZonePostRepository) Delete(id uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("post_id = ?", id).Delete(&model.ZoneComment{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.ZonePost{}, id).Error
	})
}

func (r *ZonePostRepository) IncrementCommentCount(postID uint) error {
	return r.db.Model(&model.ZonePost{}).Where("id = ?", postID).
		UpdateColumn("comment_count", gorm.Expr("comment_count + 1")).Error
}

func (r *ZonePostRepository) DecrementCommentCount(postID uint) error {
	return r.db.Model(&model.ZonePost{}).Where("id = ?", postID).
		UpdateColumn("comment_count", gorm.Expr("GREATEST(comment_count - 1, 0)")).Error
}

// --- comments ---

func (r *ZonePostRepository) ListComments(postID uint) ([]model.ZoneComment, error) {
	var comments []model.ZoneComment
	err := r.db.Where("post_id = ?", postID).
		Order("created_at ASC").
		Find(&comments).Error
	return comments, err
}

func (r *ZonePostRepository) GetComment(id uint) (*model.ZoneComment, error) {
	var c model.ZoneComment
	if err := r.db.First(&c, id).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *ZonePostRepository) CreateComment(c *model.ZoneComment) error {
	return r.db.Create(c).Error
}

func (r *ZonePostRepository) DeleteComment(id uint) error {
	return r.db.Delete(&model.ZoneComment{}, id).Error
}
