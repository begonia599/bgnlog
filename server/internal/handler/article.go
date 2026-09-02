package handler

import (
	"blog-server/internal/model"
	"blog-server/internal/pkg"
	"blog-server/internal/service"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ArticleHandler struct {
	svc   *service.ArticleService
	likes *service.LikeService
}

func NewArticleHandler(svc *service.ArticleService, likes *service.LikeService) *ArticleHandler {
	return &ArticleHandler{svc: svc, likes: likes}
}

// decorateLikes fills like_count / liked for the current viewer. Failures are
// logged, not surfaced: the article itself is more important than its counter.
func (h *ArticleHandler) decorateLikes(c *gin.Context, articles []model.Article) {
	if h.likes == nil || len(articles) == 0 {
		return
	}
	ptrs := make([]*model.Article, len(articles))
	for i := range articles {
		ptrs[i] = &articles[i]
	}
	if err := h.likes.Decorate(c.GetUint("user_id"), ptrs...); err != nil {
		log.Printf("[likes] decorate failed: %v", err)
	}
}

func (h *ArticleHandler) List(c *gin.Context) {
	p := pkg.GetPagination(c)
	category := c.Query("category")
	tag := c.Query("tag")
	articleType := c.Query("type")

	articles, total, err := h.svc.List(p, category, tag, articleType)
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to list articles")
		return
	}
	h.decorateLikes(c, articles)

	p.Total = total
	pkg.Success(c, pkg.PaginatedResponse{Items: articles, Pagination: p})
}

func (h *ArticleHandler) ListDrafts(c *gin.Context) {
	p := pkg.GetPagination(c)
	userID := c.GetUint("user_id")
	role, _ := c.Get("role")

	articles, total, err := h.svc.ListDrafts(p, userID, role.(string))
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to list drafts")
		return
	}

	p.Total = total
	pkg.Success(c, pkg.PaginatedResponse{Items: articles, Pagination: p})
}

func (h *ArticleHandler) GetBySlug(c *gin.Context) {
	slug := c.Param("slug")

	article, err := h.svc.GetBySlug(slug)
	if err != nil {
		pkg.Error(c, http.StatusNotFound, "article not found")
		return
	}

	// Only allow viewing published articles unless user is admin/editor
	if article.Status != "published" {
		role, exists := c.Get("role")
		if !exists || (role != "admin" && role != "editor") {
			pkg.Error(c, http.StatusNotFound, "article not found")
			return
		}
	}

	// Increment view count asynchronously
	go h.svc.IncrementView(article.ID)

	if h.likes != nil {
		if err := h.likes.Decorate(c.GetUint("user_id"), article); err != nil {
			log.Printf("[likes] decorate failed: %v", err)
		}
	}

	pkg.Success(c, article)
}

func (h *ArticleHandler) Create(c *gin.Context) {
	var input service.CreateArticleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	userID := c.GetUint("user_id")
	username, _ := c.Get("username")

	article, err := h.svc.Create(input, userID, username.(string))
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Created(c, article)
}

func (h *ArticleHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid id")
		return
	}

	var input service.UpdateArticleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	userID := c.GetUint("user_id")
	role, _ := c.Get("role")

	article, err := h.svc.Update(uint(id), input, userID, role.(string))
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Success(c, article)
}

func (h *ArticleHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid id")
		return
	}

	userID := c.GetUint("user_id")
	role, _ := c.Get("role")

	if err := h.svc.Delete(uint(id), userID, role.(string)); err != nil {
		pkg.Error(c, http.StatusForbidden, err.Error())
		return
	}
	pkg.Success(c, nil)
}

func (h *ArticleHandler) Search(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		pkg.Error(c, http.StatusBadRequest, "search query is required")
		return
	}

	p := pkg.GetPagination(c)
	articles, total, err := h.svc.Search(q, p)
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "search failed")
		return
	}

	p.Total = total
	pkg.Success(c, pkg.PaginatedResponse{Items: articles, Pagination: p})
}
