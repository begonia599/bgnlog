package handler

import (
	"blog-server/internal/pkg"
	"blog-server/internal/repository"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/begonia599/myplatform/sdk"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	plat      *sdk.Client
	publicURL string // platform public URL for image serving
	settings  *repository.SettingRepository
}

func NewAuthHandler(plat *sdk.Client, platformPublicURL string, settings *repository.SettingRepository) *AuthHandler {
	return &AuthHandler{plat: plat, publicURL: platformPublicURL, settings: settings}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	resp, err := h.plat.Auth.Register(req.Username, req.Password, req.Role)
	if err != nil {
		forwardPlatformError(c, err)
		return
	}
	pkg.Created(c, resp)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	tokens, err := h.plat.Auth.Login(req.Username, req.Password)
	if err != nil {
		forwardPlatformError(c, err)
		return
	}
	pkg.Success(c, tokens)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	body, _ := json.Marshal(map[string]string{"refresh_token": req.RefreshToken})
	httpReq, _ := http.NewRequest("POST", h.plat.GetBaseURL()+"/auth/refresh", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		pkg.Error(c, http.StatusBadGateway, "platform unreachable")
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", respBody)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	token, _ := c.Get("token")
	client := h.plat.WithToken(token.(string))

	if err := client.Auth.Logout(); err != nil {
		forwardPlatformError(c, err)
		return
	}
	pkg.Success(c, nil)
}

func (h *AuthHandler) Me(c *gin.Context) {
	token, _ := c.Get("token")
	client := h.plat.WithToken(token.(string))

	me, err := client.Auth.Me()
	if err != nil {
		forwardPlatformError(c, err)
		return
	}

	// Auto-sync admin's avatar, nickname and bio to hero settings on every page load
	if me.User.Role == "admin" {
		pairs := map[string]string{}
		if me.Profile.AvatarURL != "" {
			pairs["hero_avatar_url"] = me.Profile.AvatarURL
		}
		if me.Profile.Nickname != "" {
			pairs["hero_nickname"] = me.Profile.Nickname
		}
		if me.Profile.Bio != "" {
			pairs["hero_bio"] = me.Profile.Bio
		}
		if len(pairs) > 0 {
			_ = h.settings.SetMultiple(pairs)
		}
	}

	pkg.Success(c, me)
}

func (h *AuthHandler) GetProfile(c *gin.Context) {
	token, _ := c.Get("token")
	client := h.plat.WithToken(token.(string))

	profile, err := client.Auth.GetProfile()
	if err != nil {
		forwardPlatformError(c, err)
		return
	}
	pkg.Success(c, profile)
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	var req sdk.ProfileUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	token, _ := c.Get("token")
	client := h.plat.WithToken(token.(string))

	profile, err := client.Auth.UpdateProfile(&req)
	if err != nil {
		forwardPlatformError(c, err)
		return
	}

	// Auto-sync avatar to hero settings when admin updates avatar
	if req.AvatarURL != nil && *req.AvatarURL != "" {
		role, _ := c.Get("role")
		if role == "admin" {
			if err := h.settings.SetMultiple(map[string]string{"hero_avatar_url": *req.AvatarURL}); err != nil {
				log.Printf("Warning: failed to sync hero avatar: %v", err)
			}
		}
	}

	pkg.Success(c, profile)
}

func (h *AuthHandler) UploadAvatar(c *gin.Context) {
	token, _ := c.Get("token")
	client := h.plat.WithToken(token.(string))

	fh, err := c.FormFile("avatar")
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "missing avatar file")
		return
	}

	src, err := fh.Open()
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to open file")
		return
	}
	defer src.Close()

	img, err := client.ImageBed.UploadReader(fh.Filename, src)
	if err != nil {
		forwardPlatformError(c, err)
		return
	}

	// Build public URL
	publicURL := fmt.Sprintf("%s/api/imagebed/%d", h.publicURL, img.ID)

	pkg.Success(c, gin.H{
		"url": publicURL,
	})
}

func forwardPlatformError(c *gin.Context, err error) {
	if apiErr, ok := err.(*sdk.APIError); ok {
		pkg.Error(c, apiErr.StatusCode, apiErr.Message)
		return
	}
	pkg.Error(c, http.StatusBadGateway, err.Error())
}

