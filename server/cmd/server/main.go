package main

import (
	"fmt"
	"log"

	"blog-server/internal/config"
	"blog-server/internal/handler"
	"blog-server/internal/middleware"
	"blog-server/internal/repository"
	"blog-server/internal/router"
	"blog-server/internal/service"

	"github.com/begonia599/myplatform/sdk"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Database
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}
	log.Println("Database connected")

	// Platform SDK
	plat := sdk.New(&sdk.Config{
		BaseURL: cfg.Platform.BaseURL,
	})

	// Admin SDK client (for file proxy — public access without user token)
	adminPlat := sdk.New(&sdk.Config{
		BaseURL: cfg.Platform.BaseURL,
	})

	// Register blog permissions with central platform
	registerBlogPermissions(plat)

	// Repositories
	articleRepo := repository.NewArticleRepository(db)
	categoryRepo := repository.NewCategoryRepository(db)
	tagRepo := repository.NewTagRepository(db)
	commentRepo := repository.NewCommentRepository(db)

	// Services
	articleSvc := service.NewArticleService(articleRepo, tagRepo)
	categorySvc := service.NewCategoryService(categoryRepo)
	tagSvc := service.NewTagService(tagRepo)
	commentSvc := service.NewCommentService(commentRepo, articleRepo)

	// Handlers
	authHandler := handler.NewAuthHandler(plat)
	articleHandler := handler.NewArticleHandler(articleSvc)
	categoryHandler := handler.NewCategoryHandler(categorySvc)
	tagHandler := handler.NewTagHandler(tagSvc)
	commentHandler := handler.NewCommentHandler(commentSvc)
	uploadHandler := handler.NewUploadHandler(plat, adminPlat)

	// Auth middleware
	authMiddleware := middleware.NewAuthMiddleware(plat)

	// Gin
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	router.Setup(r, router.Handlers{
		Auth:     authHandler,
		Article:  articleHandler,
		Category: categoryHandler,
		Tag:      tagHandler,
		Comment:  commentHandler,
		Upload:   uploadHandler,
	}, authMiddleware, plat, cfg)

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// registerBlogPermissions registers the blog module's permissions with the central platform.
// This allows the admin to manage blog-specific permissions from the unified role management panel.
func registerBlogPermissions(plat *sdk.Client) {
	defs := []sdk.ResourceDef{
		{Resource: "article", Actions: []string{"create", "read", "update", "delete"}, Description: "Blog articles"},
		{Resource: "comment", Actions: []string{"create", "read", "update", "delete"}, Description: "Article comments"},
		{Resource: "category", Actions: []string{"create", "update", "delete"}, Description: "Article categories"},
		{Resource: "tag", Actions: []string{"create", "delete"}, Description: "Article tags"},
	}
	if err := plat.Permission.RegisterPermissions("blog", defs); err != nil {
		log.Printf("Warning: failed to register blog permissions: %v", err)
	} else {
		log.Println("Blog permissions registered with platform")
	}
}

