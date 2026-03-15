package router

import (
	"blog-server/internal/config"
	"blog-server/internal/handler"
	"blog-server/internal/middleware"
	"os"
	"path/filepath"
	"time"

	"github.com/begonia599/myplatform/sdk"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type Handlers struct {
	Auth     *handler.AuthHandler
	Article  *handler.ArticleHandler
	Category *handler.CategoryHandler
	Tag      *handler.TagHandler
	Comment  *handler.CommentHandler
	Upload   *handler.UploadHandler
	Setting  *handler.SettingHandler
}

func Setup(r *gin.Engine, h Handlers, auth *middleware.AuthMiddleware, plat *sdk.Client, cfg *config.Config) {
	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORS.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Auth proxy routes
	authGroup := r.Group("/auth")
	{
		authGroup.POST("/register", h.Auth.Register)
		authGroup.POST("/login", h.Auth.Login)
		authGroup.POST("/refresh", h.Auth.Refresh)
		authGroup.POST("/logout", auth.AuthRequired(), h.Auth.Logout)
		authGroup.GET("/me", auth.AuthRequired(), h.Auth.Me)
		authGroup.GET("/profile", auth.AuthRequired(), h.Auth.GetProfile)
		authGroup.PUT("/profile", auth.AuthRequired(), h.Auth.UpdateProfile)
		authGroup.POST("/avatar", auth.AuthRequired(), h.Auth.UploadAvatar)
	}

	api := r.Group("/api")
	{
		// Articles
		api.GET("/articles", auth.OptionalAuth(), h.Article.List)
		api.GET("/articles/search", h.Article.Search)
		api.GET("/articles/drafts", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.article", "read"), h.Article.ListDrafts)
		api.GET("/articles/:slug", auth.OptionalAuth(), h.Article.GetBySlug)
		api.POST("/articles", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.article", "create"), h.Article.Create)
		api.PUT("/articles/:id", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.article", "update"), h.Article.Update)
		api.DELETE("/articles/:id", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.article", "delete"), h.Article.Delete)

		// Categories
		api.GET("/categories", h.Category.List)
		api.POST("/categories", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.category", "create"), h.Category.Create)
		api.PUT("/categories/:id", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.category", "update"), h.Category.Update)
		api.DELETE("/categories/:id", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.category", "delete"), h.Category.Delete)

		// Tags
		api.GET("/tags", h.Tag.List)
		api.POST("/tags", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.tag", "create"), h.Tag.Create)
		api.DELETE("/tags/:id", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.tag", "delete"), h.Tag.Delete)

		// Comments
		api.GET("/articles/:slug/comments", h.Comment.List)
		api.POST("/articles/:slug/comments", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.comment", "create"), h.Comment.Create)
		api.PUT("/comments/:id", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.comment", "update"), h.Comment.Update)
		api.DELETE("/comments/:id", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.comment", "delete"), h.Comment.Delete)

		// Upload & file proxy
		api.POST("/upload", auth.AuthRequired(), h.Upload.Upload)
		api.GET("/files/:id", h.Upload.FileProxy)

		// Archives
		api.GET("/archives", h.Article.Archives)

		// Site settings
		api.GET("/settings/hero", h.Setting.GetHero)
		api.PUT("/settings/hero", auth.AuthRequired(), middleware.RequireRole("admin"), h.Setting.UpdateHero)
	}

	// In release mode, serve static frontend files
	if cfg.Server.Mode == "release" {
		staticDir := "static"
		r.NoRoute(func(c *gin.Context) {
			requestPath := c.Request.URL.Path

			// Try to serve the exact file first
			fp := filepath.Join(staticDir, requestPath)
			if info, err := os.Stat(fp); err == nil && !info.IsDir() {
				c.File(fp)
				return
			}

			// For SPA: serve index.html for all non-API/non-file routes
			c.File(filepath.Join(staticDir, "index.html"))
		})
		r.Static("/assets", filepath.Join(staticDir, "assets"))
		r.StaticFile("/favicon.ico", filepath.Join(staticDir, "favicon.ico"))
	}
}

