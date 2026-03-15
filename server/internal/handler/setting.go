package handler

import (
	"blog-server/internal/pkg"
	"blog-server/internal/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

type SettingHandler struct {
	svc *service.SettingService
}

func NewSettingHandler(svc *service.SettingService) *SettingHandler {
	return &SettingHandler{svc: svc}
}

// GetHero returns hero section settings (public).
func (h *SettingHandler) GetHero(c *gin.Context) {
	settings, err := h.svc.GetHeroSettings()
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to load settings")
		return
	}
	pkg.Success(c, settings)
}

// UpdateHero updates hero section settings (admin only).
func (h *SettingHandler) UpdateHero(c *gin.Context) {
	var req service.HeroSettings
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}
	if err := h.svc.UpdateHeroSettings(&req); err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to update settings")
		return
	}
	// Return updated settings
	settings, _ := h.svc.GetHeroSettings()
	pkg.Success(c, settings)
}
