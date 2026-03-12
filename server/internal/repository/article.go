package repository

import (
	"blog-server/internal/model"
	"blog-server/internal/pkg"

	"gorm.io/gorm"
)

type ArticleRepository struct {
	db *gorm.DB
}

func NewArticleRepository(db *gorm.DB) *ArticleRepository {
	return &ArticleRepository{db: db}
}

func (r *ArticleRepository) List(p pkg.Pagination, categorySlug, tagSlug, status string) ([]model.Article, int64, error) {
	query := r.db.Model(&model.Article{})

	if status != "" {
		query = query.Where("articles.status = ?", status)
	} else {
		query = query.Where("articles.status = ?", "published")
	}

	if categorySlug != "" {
		query = query.Joins("JOIN categories ON categories.id = articles.category_id").
			Where("categories.slug = ?", categorySlug)
	}

	if tagSlug != "" {
		query = query.Joins("JOIN article_tags ON article_tags.article_id = articles.id").
			Joins("JOIN tags ON tags.id = article_tags.tag_id").
			Where("tags.slug = ?", tagSlug)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var articles []model.Article
	err := query.Preload("Category").Preload("Tags").
		Order("articles.published_at DESC, articles.created_at DESC").
		Offset(p.Offset()).Limit(p.PageSize).
		Find(&articles).Error

	return articles, total, err
}

func (r *ArticleRepository) ListDrafts(p pkg.Pagination, authorID uint) ([]model.Article, int64, error) {
	query := r.db.Model(&model.Article{}).Where("status = ?", "draft")
	if authorID > 0 {
		query = query.Where("author_id = ?", authorID)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var articles []model.Article
	err := query.Preload("Category").Preload("Tags").
		Order("updated_at DESC").
		Offset(p.Offset()).Limit(p.PageSize).
		Find(&articles).Error

	return articles, total, err
}

func (r *ArticleRepository) GetBySlug(slug string) (*model.Article, error) {
	var article model.Article
	err := r.db.Preload("Category").Preload("Tags").
		Where("slug = ?", slug).First(&article).Error
	return &article, err
}

func (r *ArticleRepository) GetByID(id uint) (*model.Article, error) {
	var article model.Article
	err := r.db.Preload("Category").Preload("Tags").First(&article, id).Error
	return &article, err
}

func (r *ArticleRepository) Create(article *model.Article) error {
	return r.db.Create(article).Error
}

func (r *ArticleRepository) Update(article *model.Article) error {
	return r.db.Save(article).Error
}

func (r *ArticleRepository) Delete(id uint) error {
	return r.db.Select("Tags").Delete(&model.Article{ID: id}).Error
}

func (r *ArticleRepository) ReplaceTags(articleID uint, tags []model.Tag) error {
	article := model.Article{ID: articleID}
	return r.db.Model(&article).Association("Tags").Replace(tags)
}

func (r *ArticleRepository) IncrementViewCount(id uint) error {
	return r.db.Model(&model.Article{}).Where("id = ?", id).
		UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
}

func (r *ArticleRepository) Search(query string, p pkg.Pagination) ([]model.Article, int64, error) {
	q := r.db.Model(&model.Article{}).
		Where("status = ? AND search_vector @@ to_tsquery('simple', ?)", "published", query)

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var articles []model.Article
	err := q.Preload("Category").Preload("Tags").
		Select("articles.*, ts_rank(search_vector, to_tsquery('simple', ?)) AS rank", query).
		Order("rank DESC").
		Offset(p.Offset()).Limit(p.PageSize).
		Find(&articles).Error

	return articles, total, err
}

type ArchiveItem struct {
	Year  int `json:"year"`
	Month int `json:"month"`
	Count int `json:"count"`
}

type ArchiveArticle struct {
	model.Article
}

func (r *ArticleRepository) GetArchives() ([]ArchiveItem, error) {
	var items []ArchiveItem
	err := r.db.Model(&model.Article{}).
		Select("EXTRACT(YEAR FROM published_at)::int AS year, EXTRACT(MONTH FROM published_at)::int AS month, COUNT(*) AS count").
		Where("status = ? AND published_at IS NOT NULL", "published").
		Group("year, month").
		Order("year DESC, month DESC").
		Find(&items).Error
	return items, err
}

func (r *ArticleRepository) GetArticlesByYearMonth(year, month int) ([]model.Article, error) {
	var articles []model.Article
	err := r.db.Where("status = ? AND EXTRACT(YEAR FROM published_at) = ? AND EXTRACT(MONTH FROM published_at) = ?",
		"published", year, month).
		Select("id, title, slug, published_at").
		Order("published_at DESC").
		Find(&articles).Error
	return articles, err
}

func (r *ArticleRepository) SlugExists(slug string) (bool, error) {
	var count int64
	err := r.db.Model(&model.Article{}).Where("slug = ?", slug).Count(&count).Error
	return count > 0, err
}
