package handler

import (
	"errors"
	"net/http"

	"blog-server/internal/pkg"
	"blog-server/internal/service"

	"github.com/gin-gonic/gin"
)

// GetSite returns site metadata such as the launch date (public).
func (h *SettingHandler) GetSite(c *gin.Context) {
	info, err := h.svc.GetSiteInfo()
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to load settings")
		return
	}
	pkg.Success(c, info)
}

// UpdateSite updates site metadata (admin only).
func (h *SettingHandler) UpdateSite(c *gin.Context) {
	var req service.SiteInfoSettings
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}
	if err := h.svc.UpdateSiteInfo(&req); err != nil {
		if errors.Is(err, service.ErrInvalidSetting) {
			pkg.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		pkg.Error(c, http.StatusInternalServerError, "failed to update settings")
		return
	}
	info, _ := h.svc.GetSiteInfo()
	pkg.Success(c, info)
}
