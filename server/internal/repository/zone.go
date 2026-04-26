package repository

import (
	"blog-server/internal/model"

	"gorm.io/gorm"
)

type ZoneRepository struct {
	db *gorm.DB
}

func NewZoneRepository(db *gorm.DB) *ZoneRepository {
	return &ZoneRepository{db: db}
}

// List returns all zones, ordered for display. Rules are eager-loaded only
// for callers that need to evaluate access; the public listing should call
// ListSummary instead.
func (r *ZoneRepository) List() ([]model.Zone, error) {
	var zs []model.Zone
	err := r.db.Preload("Rules").Order("sort_order ASC, id ASC").Find(&zs).Error
	return zs, err
}

// ListSummary returns zones without their access rules — safe for unauth
// users to see what zones exist.
func (r *ZoneRepository) ListSummary() ([]model.Zone, error) {
	var zs []model.Zone
	err := r.db.Order("sort_order ASC, id ASC").Find(&zs).Error
	return zs, err
}

func (r *ZoneRepository) GetByID(id uint) (*model.Zone, error) {
	var z model.Zone
	err := r.db.Preload("Rules").First(&z, id).Error
	if err != nil {
		return nil, err
	}
	return &z, nil
}

func (r *ZoneRepository) GetBySlug(slug string) (*model.Zone, error) {
	var z model.Zone
	err := r.db.Preload("Rules").Where("slug = ?", slug).First(&z).Error
	if err != nil {
		return nil, err
	}
	return &z, nil
}

func (r *ZoneRepository) Create(z *model.Zone) error {
	return r.db.Create(z).Error
}

func (r *ZoneRepository) Update(z *model.Zone) error {
	return r.db.Save(z).Error
}

func (r *ZoneRepository) Delete(id uint) error {
	return r.db.Delete(&model.Zone{}, id).Error
}

// --- rules ---

func (r *ZoneRepository) AddRule(rule *model.ZoneRule) error {
	return r.db.Create(rule).Error
}

func (r *ZoneRepository) DeleteRule(zoneID, ruleID uint) error {
	return r.db.Where("zone_id = ? AND id = ?", zoneID, ruleID).
		Delete(&model.ZoneRule{}).Error
}

func (r *ZoneRepository) GetRule(zoneID, ruleID uint) (*model.ZoneRule, error) {
	var rule model.ZoneRule
	err := r.db.Where("zone_id = ? AND id = ?", zoneID, ruleID).First(&rule).Error
	if err != nil {
		return nil, err
	}
	return &rule, nil
}
