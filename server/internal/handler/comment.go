package handler

import (
	"blog-server/internal/pkg"
	"blog-server/internal/service"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type CommentHandler struct {
	svc *service.CommentService
}

func NewCommentHandler(svc *service.CommentService) *CommentHandler {
	return &CommentHandler{svc: svc}
}

func (h *CommentHandler) List(c *gin.Context) {
	slug := c.Param("slug")

	comments, err := h.svc.ListByArticleSlug(slug)
	if err != nil {
		pkg.Error(c, http.StatusNotFound, err.Error())
		return
	}
	pkg.Success(c, comments)
}

func (h *CommentHandler) Create(c *gin.Context) {
	slug := c.Param("slug")

	var req struct {
		ParentID *uint  `json:"parent_id"`
		Content  string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	userID := c.GetUint("user_id")
	username, _ := c.Get("username")

	// Try to get avatar from platform profile — we store empty string if unavailable
	avatarURL := ""

	comment, err := h.svc.Create(slug, req.ParentID, userID, username.(string), avatarURL, req.Content)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Created(c, comment)
}

func (h *CommentHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid id")
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	userID := c.GetUint("user_id")
	role, _ := c.Get("role")

	comment, err := h.svc.Update(uint(id), req.Content, userID, role.(string))
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Success(c, comment)
}

func (h *CommentHandler) Delete(c *gin.Context) {
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
