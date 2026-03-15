package repository

import (
	"blog-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SettingRepository struct {
	db *gorm.DB
}

func NewSettingRepository(db *gorm.DB) *SettingRepository {
	return &SettingRepository{db: db}
}

// GetMultiple returns settings for the given keys as a map.
func (r *SettingRepository) GetMultiple(keys []string) (map[string]string, error) {
	var settings []model.SiteSetting
	if err := r.db.Where("key IN ?", keys).Find(&settings).Error; err != nil {
		return nil, err
	}
	result := make(map[string]string, len(settings))
	for _, s := range settings {
		result[s.Key] = s.Value
	}
	return result, nil
}

// SetMultiple upserts multiple key-value pairs.
func (r *SettingRepository) SetMultiple(pairs map[string]string) error {
	for key, value := range pairs {
		setting := model.SiteSetting{Key: key, Value: value}
		if err := r.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "key"}},
			DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
		}).Create(&setting).Error; err != nil {
			return err
		}
	}
	return nil
}
