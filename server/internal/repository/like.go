package repository

import (
	"blog-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type LikeRepository struct {
	db *gorm.DB
}

func NewLikeRepository(db *gorm.DB) *LikeRepository {
	return &LikeRepository{db: db}
}

// Toggle flips the like for (articleID, userID) and reports the resulting
// state. Two concurrent toggles racing past the delete both try to insert;
// the unique index makes the loser a no-op and both observe liked=true.
func (r *LikeRepository) Toggle(articleID, userID uint) (bool, error) {
	liked := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		res := tx.Where("article_id = ? AND user_id = ?", articleID, userID).Delete(&model.ArticleLike{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected > 0 {
			return nil // was liked → now unliked
		}
		row := model.ArticleLike{ArticleID: articleID, UserID: userID}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
			return err
		}
		liked = true
		return nil
	})
	return liked, err
}

// Count returns the number of likes for one article.
func (r *LikeRepository) Count(articleID uint) (int64, error) {
	var n int64
	err := r.db.Model(&model.ArticleLike{}).Where("article_id = ?", articleID).Count(&n).Error
	return n, err
}

// CountByArticleIDs returns like counts keyed by article ID (absent = 0).
func (r *LikeRepository) CountByArticleIDs(ids []uint) (map[uint]int64, error) {
	out := make(map[uint]int64, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	var rows []struct {
		ArticleID uint
		N         int64
	}
	err := r.db.Model(&model.ArticleLike{}).
		Select("article_id, COUNT(*) AS n").
		Where("article_id IN ?", ids).
		Group("article_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.ArticleID] = row.N
	}
	return out, nil
}

// LikedByUser reports which of the given articles userID has liked.
func (r *LikeRepository) LikedByUser(ids []uint, userID uint) (map[uint]bool, error) {
	out := make(map[uint]bool, len(ids))
	if len(ids) == 0 || userID == 0 {
		return out, nil
	}
	var likedIDs []uint
	err := r.db.Model(&model.ArticleLike{}).
		Where("article_id IN ? AND user_id = ?", ids, userID).
		Pluck("article_id", &likedIDs).Error
	if err != nil {
		return nil, err
	}
	for _, id := range likedIDs {
		out[id] = true
	}
	return out, nil
}
