package router

import (
	"blog-server/internal/config"
	"blog-server/internal/handler"
	"blog-server/internal/middleware"
	"blog-server/internal/pkg"
	"encoding/json"
	"html"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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
	Zone     *handler.ZoneHandler
	ZonePost *handler.ZonePostHandler
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
		authGroup.PUT("/password", auth.AuthRequired(), h.Auth.ChangePassword)
		authGroup.GET("/oauth/accounts", auth.AuthRequired(), h.Auth.GetOAuthAccounts)
		authGroup.DELETE("/oauth/accounts/:provider", auth.AuthRequired(), h.Auth.UnlinkOAuth)
		authGroup.POST("/oauth/link-existing", auth.AuthRequired(), h.Auth.LinkExisting)
		authGroup.GET("/oauth/:provider", h.Auth.OAuthAuthorize)
		authGroup.GET("/oauth/:provider/bind", auth.AuthRequired(), h.Auth.OAuthBindAuthorize)
		authGroup.POST("/oauth/exchange", h.Auth.OAuthExchange)
	}

	// SEO / syndication (public, absolute URLs derived from request Host)
	r.GET("/feed.xml", h.Article.Feed)
	r.GET("/notes.xml", h.Article.NotesFeed)
	r.GET("/sitemap.xml", h.Article.Sitemap)
	r.GET("/robots.txt", h.Article.Robots)

	api := r.Group("/api")
	{		// Articles
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

		// Site settings
		api.GET("/settings/hero", h.Setting.GetHero)
		api.PUT("/settings/hero", auth.AuthRequired(), middleware.RequireRole("admin"), h.Setting.UpdateHero)

		// Zones — public listing + per-user access check.
		api.GET("/zones", h.Zone.List)
		api.GET("/zones/reauth", auth.AuthRequired(), h.Zone.RequestReauth)
		api.GET("/zones/:slug", h.Zone.GetBySlug)
		api.GET("/zones/:slug/access", auth.AuthRequired(), h.Zone.CheckAccess)

		// Zone admin CRUD — all under /admin/zones to avoid wildcard conflicts.
		api.GET("/admin/zones", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.zone", "read"), h.Zone.ListAdmin)
		api.POST("/admin/zones", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.zone", "create"), h.Zone.Create)
		api.PUT("/admin/zones/:id", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.zone", "update"), h.Zone.Update)
		api.DELETE("/admin/zones/:id", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.zone", "delete"), h.Zone.Delete)
		api.POST("/admin/zones/:id/rules", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.zone", "update"), h.Zone.AddRule)
		api.DELETE("/admin/zones/:id/rules/:rule_id", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.zone", "update"), h.Zone.DeleteRule)

		// Zone posts & comments — require auth; access check inside handler.
		api.GET("/zones/:slug/posts", auth.AuthRequired(), h.ZonePost.ListPosts)
		api.POST("/zones/:slug/posts", auth.AuthRequired(), h.ZonePost.CreatePost)
		api.GET("/zones/:slug/posts/:post_id", auth.AuthRequired(), h.ZonePost.GetPost)
		api.PUT("/zones/:slug/posts/:post_id/status", auth.AuthRequired(), h.ZonePost.UpdatePostStatus)
		api.PUT("/zones/:slug/posts/:post_id/pin", auth.AuthRequired(), middleware.RequirePermission(plat, "blog.zone", "update"), h.ZonePost.TogglePin)
		api.DELETE("/zones/:slug/posts/:post_id", auth.AuthRequired(), h.ZonePost.DeletePost)
		api.GET("/zones/:slug/posts/:post_id/comments", auth.AuthRequired(), h.ZonePost.ListComments)
		api.POST("/zones/:slug/posts/:post_id/comments", auth.AuthRequired(), h.ZonePost.CreateComment)
		api.DELETE("/zones/:slug/posts/:post_id/comments/:comment_id", auth.AuthRequired(), h.ZonePost.DeleteComment)
	}

	// In release mode, serve static frontend files
	if cfg.Server.Mode == "release" {
		staticDir := "static"
		indexPath := filepath.Join(staticDir, "index.html")
		r.NoRoute(func(c *gin.Context) {
			requestPath := c.Request.URL.Path

			// Try to serve the exact file first
			fp := filepath.Join(staticDir, requestPath)
			if info, err := os.Stat(fp); err == nil && !info.IsDir() {
				c.File(fp)
				return
			}

			// For SPA: serve index.html for all non-API/non-file routes,
			// filling Open Graph tags. Article pages get per-article metadata;
			// everything else gets site-level defaults. Absolute URLs are
			// derived from the request (no hardcoded domain).
			origin := pkg.RequestOrigin(c)
			meta := defaultMeta(origin, requestPath)
			if slug, ok := strings.CutPrefix(requestPath, "/article/"); ok && slug != "" && !strings.Contains(slug, "/") {
				if title, desc, cover, pub, found := h.Article.MetaBySlug(slug); found {
					meta = articleMeta(origin, slug, title, desc, cover, pub)
				}
			}
			serveIndexWithOG(c, indexPath, meta)
		})
		r.Static("/assets", filepath.Join(staticDir, "assets"))
		r.StaticFile("/favicon.ico", filepath.Join(staticDir, "favicon.ico"))
	}
}

// ogMeta holds the Open Graph / Twitter values injected into index.html.
type ogMeta struct {
	Type   string
	Title  string
	Desc   string
	URL    string
	Image  string
	JSONLD string // raw <script> block (already serialized), empty for non-articles
}

const (
	defaultTitle = "海棠小栈"
	defaultDesc  = "海棠小栈 — 思考、记录、分享"
)

// defaultMeta returns site-level Open Graph values for any non-article page.
func defaultMeta(origin, path string) ogMeta {
	return ogMeta{
		Type:  "website",
		Title: defaultTitle,
		Desc:  defaultDesc,
		URL:   origin + path,
		Image: origin + "/logo.png",
	}
}

// articleMeta returns per-article Open Graph values plus a JSON-LD BlogPosting.
func articleMeta(origin, slug, title, desc, cover string, pub *time.Time) ogMeta {
	image := origin + "/logo.png"
	if cover != "" {
		if strings.HasPrefix(cover, "http://") || strings.HasPrefix(cover, "https://") {
			image = cover
		} else {
			image = origin + cover
		}
	}
	if desc == "" {
		desc = defaultDesc
	}
	url := origin + "/article/" + slug

	ld := map[string]any{
		"@context":    "https://schema.org",
		"@type":       "BlogPosting",
		"headline":    title,
		"description": desc,
		"url":         url,
		"image":       image,
	}
	if pub != nil {
		ld["datePublished"] = pub.Format(time.RFC3339)
	}
	// encoding/json escapes <, >, & to \u00xx, so this is safe inside <script>.
	b, _ := json.Marshal(ld)

	return ogMeta{
		Type:   "article",
		Title:  title,
		Desc:   desc,
		URL:    url,
		Image:  image,
		JSONLD: `<script type="application/ld+json">` + string(b) + `</script>`,
	}
}

// serveIndexWithOG serves the SPA index.html with its __OG_* placeholders
// filled. Attribute values are HTML-escaped; the JSON-LD block is injected raw.
// All URLs are absolute (origin derived from the request), so the site adapts
// to whatever domain it is deployed on — no hardcoded domain needed.
func serveIndexWithOG(c *gin.Context, indexPath string, meta ogMeta) {
	data, err := os.ReadFile(indexPath)
	if err != nil {
		c.File(indexPath) // fall back to plain serving
		return
	}

	repl := strings.NewReplacer(
		"__OG_TYPE__", html.EscapeString(meta.Type),
		"__OG_TITLE__", html.EscapeString(meta.Title),
		"__OG_DESC__", html.EscapeString(meta.Desc),
		"__OG_URL__", html.EscapeString(meta.URL),
		"__OG_IMAGE__", html.EscapeString(meta.Image),
		"__OG_JSONLD__", meta.JSONLD,
	)
	out := repl.Replace(string(data))
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(out))
}
