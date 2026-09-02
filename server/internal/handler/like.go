package handler

import (
	"errors"
	"net/http"

	"blog-server/internal/pkg"
	"blog-server/internal/service"

	"github.com/gin-gonic/gin"
)

type LikeHandler struct {
	svc *service.LikeService
}

func NewLikeHandler(svc *service.LikeService) *LikeHandler {
	return &LikeHandler{svc: svc}
}

// Toggle likes/unlikes the article for the authenticated user and returns
// {liked, like_count}.
func (h *LikeHandler) Toggle(c *gin.Context) {
	state, err := h.svc.Toggle(c.Param("slug"), c.GetUint("user_id"))
	if err != nil {
		if errors.Is(err, service.ErrLikeTargetNotFound) {
			pkg.Error(c, http.StatusNotFound, "article not found")
			return
		}
		pkg.Error(c, http.StatusInternalServerError, "failed to update like")
		return
	}
	pkg.Success(c, state)
}
