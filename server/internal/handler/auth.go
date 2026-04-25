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
	"gorm.io/gorm"
)

type AuthHandler struct {
	plat      *sdk.Client
	publicURL string // platform public URL for image serving
	settings  *repository.SettingRepository
	db        *gorm.DB // raw DB handle for cross-table user_id migration on account merge
}

func NewAuthHandler(plat *sdk.Client, platformPublicURL string, settings *repository.SettingRepository, db *gorm.DB) *AuthHandler {
	return &AuthHandler{plat: plat, publicURL: platformPublicURL, settings: settings, db: db}
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

func (h *AuthHandler) OAuthAuthorize(c *gin.Context) {
	provider := c.Param("provider")
	redirectURI := c.Query("redirect_uri")
	if redirectURI == "" {
		pkg.Error(c, http.StatusBadRequest, "redirect_uri is required")
		return
	}

	resp, err := h.plat.Auth.OAuthAuthorize(provider, redirectURI)
	if err != nil {
		forwardPlatformError(c, err)
		return
	}
	pkg.Success(c, resp)
}

func (h *AuthHandler) OAuthExchange(c *gin.Context) {
	var req struct {
		ExchangeCode string `json:"exchange_code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.ExchangeCode == "" {
		pkg.Error(c, http.StatusBadRequest, "exchange_code is required")
		return
	}

	tokens, err := h.plat.Auth.OAuthExchange(req.ExchangeCode)
	if err != nil {
		forwardPlatformError(c, err)
		return
	}
	pkg.Success(c, tokens)
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	token, _ := c.Get("token")
	client := h.plat.WithToken(token.(string))

	if err := client.Auth.ChangePassword(req.OldPassword, req.NewPassword); err != nil {
		forwardPlatformError(c, err)
		return
	}
	pkg.Success(c, gin.H{"message": "password updated"})
}

func (h *AuthHandler) GetOAuthAccounts(c *gin.Context) {
	token, _ := c.Get("token")
	client := h.plat.WithToken(token.(string))

	accounts, err := client.Auth.GetOAuthAccounts()
	if err != nil {
		forwardPlatformError(c, err)
		return
	}
	pkg.Success(c, accounts)
}

func (h *AuthHandler) UnlinkOAuth(c *gin.Context) {
	provider := c.Param("provider")

	token, _ := c.Get("token")
	client := h.plat.WithToken(token.(string))

	if err := client.Auth.UnlinkOAuth(provider); err != nil {
		forwardPlatformError(c, err)
		return
	}
	pkg.Success(c, gin.H{"message": "oauth account unlinked"})
}

// OAuthBindAuthorize starts a bind flow: links a third-party account to the
// currently authenticated user (no merge, no new user).
func (h *AuthHandler) OAuthBindAuthorize(c *gin.Context) {
	provider := c.Param("provider")
	redirectURI := c.Query("redirect_uri")
	if redirectURI == "" {
		pkg.Error(c, http.StatusBadRequest, "redirect_uri is required")
		return
	}

	token, _ := c.Get("token")
	client := h.plat.WithToken(token.(string))

	resp, err := client.Auth.OAuthBindAuthorize(provider, redirectURI)
	if err != nil {
		forwardPlatformError(c, err)
		return
	}
	pkg.Success(c, resp)
}

// LinkExisting merges the currently authenticated (OAuth-only) user into a
// verified local account. After core merges its tables we migrate blog's
// own user-owned rows (articles.author_id, comments.user_id), then ask
// core to hard-delete the tombstone.
//
// If blog-side migration fails, we still return success with the new tokens
// (core merge already happened) but skip the purge — the tombstone is left
// in place and the user can retry purge later via admin tools. This avoids
// stranding the user without tokens.
func (h *AuthHandler) LinkExisting(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Username == "" || req.Password == "" {
		pkg.Error(c, http.StatusBadRequest, "username and password are required")
		return
	}

	token, _ := c.Get("token")
	client := h.plat.WithToken(token.(string))

	// Step 1 — core-side merge.
	resp, err := client.Auth.LinkExisting(req.Username, req.Password)
	if err != nil {
		forwardPlatformError(c, err)
		return
	}

	primaryID := resp.PrimaryID
	secondaryID := resp.SecondaryID

	// Step 2 — migrate blog-owned rows. The new tokens are for primaryID,
	// so build a fresh client to call core again with the post-merge identity.
	primaryClient := h.plat.WithToken(resp.Tokens.AccessToken)

	migrationErr := h.migrateBlogUserData(primaryID, secondaryID, resp.User.Username)
	if migrationErr != nil {
		log.Printf("link-existing: blog-side migration partial failure: primary=%d secondary=%d err=%v",
			primaryID, secondaryID, migrationErr)
		// Do NOT call purge — leave the tombstone for canonical lookup to keep
		// any unmigrated rows resolvable. Return tokens so the user is logged
		// in as primary; admin can investigate.
		pkg.Success(c, gin.H{
			"message":         "accounts linked but blog-side migration incomplete",
			"primary_id":      primaryID,
			"secondary_id":    secondaryID,
			"migration_error": migrationErr.Error(),
			"tokens":          resp.Tokens,
			"user":            resp.User,
		})
		return
	}

	// Step 3 — purge the now-orphan tombstone in core.
	if err := primaryClient.Auth.PurgeUser(secondaryID); err != nil {
		log.Printf("link-existing: purge failed but blog data already migrated: primary=%d secondary=%d err=%v",
			primaryID, secondaryID, err)
		// Migration already done — user data is consistent, just a leftover
		// tombstone in core. Return success.
	}

	pkg.Success(c, gin.H{
		"message":      "accounts linked",
		"primary_id":   primaryID,
		"secondary_id": secondaryID,
		"tokens":       resp.Tokens,
		"user":         resp.User,
	})
}

// migrateBlogUserData rewrites all blog-owned references from secondary to
// primary in a single transaction. Comment denormalized fields (username,
// avatar_url) are also refreshed to the primary user's values where known.
func (h *AuthHandler) migrateBlogUserData(primary, secondary uint, primaryUsername string) error {
	return h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(
			"UPDATE articles SET author_id = ?, author_name = ? WHERE author_id = ?",
			primary, primaryUsername, secondary,
		).Error; err != nil {
			return fmt.Errorf("articles: %w", err)
		}
		// For comments, also refresh the denormalized username; avatar_url
		// is left as-is (will resolve to primary's profile on next render).
		if err := tx.Exec(
			"UPDATE comments SET user_id = ?, username = ? WHERE user_id = ?",
			primary, primaryUsername, secondary,
		).Error; err != nil {
			return fmt.Errorf("comments: %w", err)
		}
		return nil
	})
}
