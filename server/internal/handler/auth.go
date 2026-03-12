package handler

import (
	"blog-server/internal/pkg"
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/begonia599/myplatform/sdk"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	plat *sdk.Client
}

func NewAuthHandler(plat *sdk.Client) *AuthHandler {
	return &AuthHandler{plat: plat}
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
	pkg.Success(c, profile)
}

func forwardPlatformError(c *gin.Context, err error) {
	if apiErr, ok := err.(*sdk.APIError); ok {
		pkg.Error(c, apiErr.StatusCode, apiErr.Message)
		return
	}
	pkg.Error(c, http.StatusBadGateway, err.Error())
}

