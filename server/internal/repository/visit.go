package repository

import (
	"time"

	"blog-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type VisitRepository struct {
	db *gorm.DB
}

func NewVisitRepository(db *gorm.DB) *VisitRepository {
	return &VisitRepository{db: db}
}

// Increment adds one visit to the given day (YYYY-MM-DD), creating the row on
// first use. Single upsert statement, safe under concurrency.
func (r *VisitRepository) Increment(day string) error {
	row := model.SiteVisitDaily{Day: day, Count: 1, UpdatedAt: time.Now()}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "day"}},
		DoUpdates: clause.Assignments(map[string]any{
			"count":      gorm.Expr("site_visits_daily.count + 1"),
			"updated_at": time.Now(),
		}),
	}).Create(&row).Error
}

// Total returns the lifetime visit count.
func (r *VisitRepository) Total() (int64, error) {
	var total int64
	err := r.db.Model(&model.SiteVisitDaily{}).
		Select("COALESCE(SUM(count), 0)").
		Row().Scan(&total)
	return total, err
}

// CountForDay returns the visit count for one day (0 when there is no row).
func (r *VisitRepository) CountForDay(day string) (int64, error) {
	var count int64
	err := r.db.Model(&model.SiteVisitDaily{}).
		Select("COALESCE(SUM(count), 0)").
		Where("day = ?", day).
		Row().Scan(&count)
	return count, err
}
