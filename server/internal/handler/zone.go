package handler

import (
	"blog-server/internal/pkg"
	"blog-server/internal/service"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ZoneHandler struct {
	svc *service.ZoneService
}

func NewZoneHandler(svc *service.ZoneService) *ZoneHandler {
	return &ZoneHandler{svc: svc}
}

// List returns the public zone summary (no rules, no token operations).
// Anyone — including unauthenticated visitors — can see the catalog of zones.
func (h *ZoneHandler) List(c *gin.Context) {
	zs, err := h.svc.ListSummary()
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to list zones")
		return
	}
	pkg.Success(c, zs)
}

// ListAdmin returns full zones with their rules — admin-only view.
func (h *ZoneHandler) ListAdmin(c *gin.Context) {
	zs, err := h.svc.ListWithRules()
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to list zones")
		return
	}
	pkg.Success(c, zs)
}

// GetBySlug returns a single zone's metadata + rules (rules are needed by the
// frontend so it can display "to enter, you need X" hints before requesting
// access).
func (h *ZoneHandler) GetBySlug(c *gin.Context) {
	slug := c.Param("slug")
	z, err := h.svc.GetBySlug(slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			pkg.Error(c, http.StatusNotFound, "zone not found")
			return
		}
		pkg.Error(c, http.StatusInternalServerError, "failed to load zone")
		return
	}
	pkg.Success(c, z)
}

// CheckAccess evaluates whether the authenticated user can access this zone.
// It does NOT itself return zone content — content endpoints will use the
// same service.CheckAccess and 403 if denied. The reason this is a separate
// endpoint is for the frontend's pre-flight UX: show the right "you need to
// authorize Discord" / "you're not in the required server" prompt without
// blindly trying to load gated content.
func (h *ZoneHandler) CheckAccess(c *gin.Context) {
	slug := c.Param("slug")
	z, err := h.svc.GetBySlug(slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			pkg.Error(c, http.StatusNotFound, "zone not found")
			return
		}
		pkg.Error(c, http.StatusInternalServerError, "failed to load zone")
		return
	}

	userID, _ := c.Get("user_id")
	token, _ := c.Get("token")
	uid, _ := userID.(uint)
	tk, _ := token.(string)

	decision := h.svc.CheckAccess(z, uid, tk)
	pkg.Success(c, decision)
}

// RequestReauth returns a Discord re-authorization URL with extended scopes
// so that the user can grant the permissions needed for zone gating.
func (h *ZoneHandler) RequestReauth(c *gin.Context) {
	token, _ := c.Get("token")
	tk, _ := token.(string)

	redirectURI := c.Query("redirect_uri")
	if redirectURI == "" {
		pkg.Error(c, http.StatusBadRequest, "redirect_uri is required")
		return
	}

	authURL, err := h.svc.RequestReauth(tk, redirectURI)
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to request reauth")
		return
	}
	pkg.Success(c, gin.H{"auth_url": authURL})
}

// --- admin: zone CRUD ---

func (h *ZoneHandler) Create(c *gin.Context) {
	var req struct {
		Slug          string `json:"slug" binding:"required"`
		Name          string `json:"name" binding:"required"`
		Description   string `json:"description"`
		CoverImageURL string `json:"cover_image_url"`
		Visibility    string `json:"visibility"`
		RuleLogic     string `json:"rule_logic"`
		SortOrder     int    `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}
	uid, _ := c.Get("user_id")
	ownerID, _ := uid.(uint)

	z, err := h.svc.Create(ownerID, service.CreateZoneInput{
		Slug:          req.Slug,
		Name:          req.Name,
		Description:   req.Description,
		CoverImageURL: req.CoverImageURL,
		Visibility:    req.Visibility,
		RuleLogic:     req.RuleLogic,
		SortOrder:     req.SortOrder,
	})
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Created(c, z)
}

func (h *ZoneHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Name          *string `json:"name"`
		Description   *string `json:"description"`
		CoverImageURL *string `json:"cover_image_url"`
		Visibility    *string `json:"visibility"`
		RuleLogic     *string `json:"rule_logic"`
		SortOrder     *int    `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}
	z, err := h.svc.Update(uint(id), service.UpdateZoneInput{
		Name:          req.Name,
		Description:   req.Description,
		CoverImageURL: req.CoverImageURL,
		Visibility:    req.Visibility,
		RuleLogic:     req.RuleLogic,
		SortOrder:     req.SortOrder,
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			pkg.Error(c, http.StatusNotFound, "zone not found")
			return
		}
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Success(c, z)
}

func (h *ZoneHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.svc.Delete(uint(id)); err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to delete zone")
		return
	}
	pkg.Success(c, nil)
}

// --- admin: rule CRUD ---

func (h *ZoneHandler) AddRule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid zone id")
		return
	}
	var req struct {
		Kind        string `json:"kind" binding:"required"`
		GuildID     string `json:"guild_id"`
		RoleID      string `json:"role_id"`
		Value       int    `json:"value"`
		ValueStr    string `json:"value_str"`
		Description string `json:"description"`
		Label       string `json:"label"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}
	rule, err := h.svc.AddRule(uint(id), service.AddRuleInput{
		Kind:        req.Kind,
		GuildID:     req.GuildID,
		RoleID:      req.RoleID,
		Value:       req.Value,
		ValueStr:    req.ValueStr,
		Description: req.Description,
		Label:       req.Label,
	})
	if err != nil {
		if errors.Is(err, service.ErrZoneNotFound) {
			pkg.Error(c, http.StatusNotFound, "zone not found")
			return
		}
		pkg.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	pkg.Created(c, rule)
}

func (h *ZoneHandler) DeleteRule(c *gin.Context) {
	zoneID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid zone id")
		return
	}
	ruleID, err := strconv.ParseUint(c.Param("rule_id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid rule id")
		return
	}
	if err := h.svc.DeleteRule(uint(zoneID), uint(ruleID)); err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to delete rule")
		return
	}
	pkg.Success(c, nil)
}
