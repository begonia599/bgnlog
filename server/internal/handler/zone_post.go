package handler

import (
	"blog-server/internal/pkg"
	"blog-server/internal/service"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ZonePostHandler struct {
	svc     *service.ZonePostService
	zoneSvc *service.ZoneService
}

func NewZonePostHandler(svc *service.ZonePostService, zoneSvc *service.ZoneService) *ZonePostHandler {
	return &ZonePostHandler{svc: svc, zoneSvc: zoneSvc}
}

// helpers

func (h *ZonePostHandler) viewerID(c *gin.Context) uint {
	uid, _ := c.Get("user_id")
	id, _ := uid.(uint)
	return id
}

func (h *ZonePostHandler) viewerName(c *gin.Context) string {
	v, _ := c.Get("username")
	s, _ := v.(string)
	return s
}

func (h *ZonePostHandler) viewerAvatar(_ *gin.Context) string {
	// Avatar is not available in the auth middleware context; left empty.
	return ""
}

func (h *ZonePostHandler) isAdmin(c *gin.Context) bool {
	v, _ := c.Get("role")
	role, _ := v.(string)
	return role == "admin"
}

// resolveZone looks up a zone by slug and checks that the current user has
// access. On failure it writes an error response and returns nil.
func (h *ZonePostHandler) resolveZone(c *gin.Context) *uint {
	slug := c.Param("slug")
	z, err := h.zoneSvc.GetBySlug(slug)
	if err != nil {
		pkg.Error(c, http.StatusNotFound, "zone not found")
		return nil
	}
	// Access check for gated zones.
	if z.Visibility != "public" {
		token, _ := c.Get("token")
		tk, _ := token.(string)
		uid := h.viewerID(c)
		decision := h.zoneSvc.CheckAccess(z, uid, tk)
		if decision.Status != "allowed" {
			pkg.Error(c, http.StatusForbidden, "zone access denied")
			return nil
		}
	}
	return &z.ID
}

// --- posts ---

func (h *ZonePostHandler) ListPosts(c *gin.Context) {
	zoneID := h.resolveZone(c)
	if zoneID == nil {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	result, err := h.svc.ListPosts(*zoneID, h.viewerID(c), page, size)
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to list posts")
		return
	}
	pkg.Success(c, result)
}

func (h *ZonePostHandler) GetPost(c *gin.Context) {
	zoneID := h.resolveZone(c)
	if zoneID == nil {
		return
	}
	postID, err := strconv.ParseUint(c.Param("post_id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid post id")
		return
	}
	resp, err := h.svc.GetPost(uint(postID), h.viewerID(c))
	if err != nil {
		pkg.Error(c, http.StatusNotFound, "post not found")
		return
	}
	pkg.Success(c, resp)
}

func (h *ZonePostHandler) CreatePost(c *gin.Context) {
	zoneID := h.resolveZone(c)
	if zoneID == nil {
		return
	}
	var req struct {
		Title       string   `json:"title" binding:"required"`
		Content     string   `json:"content" binding:"required"`
		Images      []string `json:"images"`
		IsAnonymous bool     `json:"is_anonymous"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}
	resp, err := h.svc.CreatePost(service.CreatePostInput{
		ZoneID:       *zoneID,
		UserID:       h.viewerID(c),
		Title:        req.Title,
		Content:      req.Content,
		Images:       req.Images,
		IsAnonymous:  req.IsAnonymous,
		AuthorName:   h.viewerName(c),
		AuthorAvatar: h.viewerAvatar(c),
	})
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Created(c, resp)
}

func (h *ZonePostHandler) UpdatePostStatus(c *gin.Context) {
	_ = h.resolveZone(c)
	postID, err := strconv.ParseUint(c.Param("post_id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid post id")
		return
	}
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}
	if err := h.svc.UpdatePostStatus(uint(postID), h.viewerID(c), req.Status, h.isAdmin(c)); err != nil {
		if errors.Is(err, service.ErrNotPostOwner) {
			pkg.Error(c, http.StatusForbidden, err.Error())
			return
		}
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Success(c, nil)
}

func (h *ZonePostHandler) TogglePin(c *gin.Context) {
	_ = h.resolveZone(c)
	postID, err := strconv.ParseUint(c.Param("post_id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid post id")
		return
	}
	var req struct {
		Pinned bool `json:"pinned"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}
	if err := h.svc.TogglePin(uint(postID), req.Pinned); err != nil {
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Success(c, nil)
}

func (h *ZonePostHandler) DeletePost(c *gin.Context) {
	_ = h.resolveZone(c)
	postID, err := strconv.ParseUint(c.Param("post_id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid post id")
		return
	}
	if err := h.svc.DeletePost(uint(postID), h.viewerID(c), h.isAdmin(c)); err != nil {
		if errors.Is(err, service.ErrNotPostOwner) {
			pkg.Error(c, http.StatusForbidden, err.Error())
			return
		}
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Success(c, nil)
}

// --- comments ---

func (h *ZonePostHandler) ListComments(c *gin.Context) {
	_ = h.resolveZone(c)
	postID, err := strconv.ParseUint(c.Param("post_id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid post id")
		return
	}
	comments, err := h.svc.ListComments(uint(postID), h.viewerID(c))
	if err != nil {
		if errors.Is(err, service.ErrPostNotFound) {
			pkg.Error(c, http.StatusNotFound, "post not found")
			return
		}
		pkg.Error(c, http.StatusInternalServerError, "failed to list comments")
		return
	}
	pkg.Success(c, comments)
}

func (h *ZonePostHandler) CreateComment(c *gin.Context) {
	_ = h.resolveZone(c)
	postID, err := strconv.ParseUint(c.Param("post_id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid post id")
		return
	}
	var req struct {
		Content     string `json:"content" binding:"required"`
		ParentID    *uint  `json:"parent_id"`
		IsAnonymous bool   `json:"is_anonymous"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}
	resp, err := h.svc.CreateComment(service.CreateCommentInput{
		PostID:       uint(postID),
		UserID:       h.viewerID(c),
		Content:      req.Content,
		ParentID:     req.ParentID,
		IsAnonymous:  req.IsAnonymous,
		AuthorName:   h.viewerName(c),
		AuthorAvatar: h.viewerAvatar(c),
	})
	if err != nil {
		if errors.Is(err, service.ErrPostNotFound) {
			pkg.Error(c, http.StatusNotFound, "post not found")
			return
		}
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Created(c, resp)
}

func (h *ZonePostHandler) DeleteComment(c *gin.Context) {
	_ = h.resolveZone(c)
	commentID, err := strconv.ParseUint(c.Param("comment_id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid comment id")
		return
	}
	if err := h.svc.DeleteComment(uint(commentID), h.viewerID(c), h.isAdmin(c)); err != nil {
		if errors.Is(err, service.ErrNotCommentOwner) {
			pkg.Error(c, http.StatusForbidden, err.Error())
			return
		}
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Success(c, nil)
}
