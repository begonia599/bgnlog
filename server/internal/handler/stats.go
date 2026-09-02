package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"

	"blog-server/internal/pkg"
	"blog-server/internal/service"

	"github.com/gin-gonic/gin"
)

type StatsHandler struct {
	svc *service.StatsService
}

func NewStatsHandler(svc *service.StatsService) *StatsHandler {
	return &StatsHandler{svc: svc}
}

// GetSite returns launch date and visit counters (public).
func (h *StatsHandler) GetSite(c *gin.Context) {
	stats, err := h.svc.GetSiteStats()
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to load site stats")
		return
	}
	pkg.Success(c, stats)
}

// RecordVisit counts the current visitor (public). The frontend calls it once
// per browser session; the service additionally dedups by visitor key.
func (h *StatsHandler) RecordVisit(c *gin.Context) {
	counted, err := h.svc.RecordVisit(visitorKey(c))
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to record visit")
		return
	}
	pkg.Success(c, gin.H{"counted": counted})
}

// visitorKey derives an opaque, non-reversible key from client IP + User-Agent.
// It only ever lives in the in-memory dedup map.
func visitorKey(c *gin.Context) string {
	sum := sha256.Sum256([]byte(c.ClientIP() + "|" + c.GetHeader("User-Agent")))
	return hex.EncodeToString(sum[:16])
}
