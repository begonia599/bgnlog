package handler

import (
	"blog-server/internal/pkg"
	"blog-server/internal/service"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type TagHandler struct {
	svc *service.TagService
}

func NewTagHandler(svc *service.TagService) *TagHandler {
	return &TagHandler{svc: svc}
}

func (h *TagHandler) List(c *gin.Context) {
	tags, err := h.svc.List()
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to list tags")
		return
	}
	pkg.Success(c, tags)
}

func (h *TagHandler) Create(c *gin.Context) {
	var req struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	tag, err := h.svc.Create(req.Name)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Created(c, tag)
}

func (h *TagHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid id")
		return
	}

	if err := h.svc.Delete(uint(id)); err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to delete tag")
		return
	}
	pkg.Success(c, nil)
}
