package middleware

import (
	"net/http"
	"strings"

	"blog-server/internal/pkg"

	"github.com/begonia599/myplatform/sdk"
	"github.com/gin-gonic/gin"
)

type AuthMiddleware struct {
	platform *sdk.Client
}

func NewAuthMiddleware(platform *sdk.Client) *AuthMiddleware {
	return &AuthMiddleware{platform: platform}
}

func (m *AuthMiddleware) extractToken(c *gin.Context) string {
	header := c.GetHeader("Authorization")
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}

// AuthRequired requires a valid token.
func (m *AuthMiddleware) AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := m.extractToken(c)
		if token == "" {
			pkg.Error(c, http.StatusUnauthorized, "missing or invalid token")
			c.Abort()
			return
		}

		result, err := m.platform.Auth.Verify(token)
		if err != nil || !result.Valid {
			pkg.Error(c, http.StatusUnauthorized, "invalid token")
			c.Abort()
			return
		}

		c.Set("user_id", result.User.ID)
		c.Set("username", result.User.Username)
		c.Set("role", result.User.Role)
		c.Set("token", token)
		c.Next()
	}
}

// OptionalAuth extracts user info if token is present, but doesn't block.
func (m *AuthMiddleware) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := m.extractToken(c)
		if token == "" {
			c.Next()
			return
		}

		result, err := m.platform.Auth.Verify(token)
		if err == nil && result.Valid {
			c.Set("user_id", result.User.ID)
			c.Set("username", result.User.Username)
			c.Set("role", result.User.Role)
			c.Set("token", token)
		}
		c.Next()
	}
}

// RequireRole checks if the authenticated user has one of the allowed roles.
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("role")
		if !exists {
			pkg.Error(c, http.StatusUnauthorized, "not authenticated")
			c.Abort()
			return
		}

		role := userRole.(string)
		for _, r := range roles {
			if role == r {
				c.Next()
				return
			}
		}

		pkg.Error(c, http.StatusForbidden, "insufficient permissions")
		c.Abort()
	}
}

// RequirePermission checks if the user has a specific permission via the central platform.
func RequirePermission(plat *sdk.Client, object, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			pkg.Error(c, http.StatusUnauthorized, "not authenticated")
			c.Abort()
			return
		}

		allowed, err := plat.Permission.CheckPermission(userID.(uint), object, action)
		if err != nil {
			pkg.Error(c, http.StatusBadGateway, "permission check failed")
			c.Abort()
			return
		}

		if !allowed {
			pkg.Error(c, http.StatusForbidden, "insufficient permissions")
			c.Abort()
			return
		}

		c.Next()
	}
}

