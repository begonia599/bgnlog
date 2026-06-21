package handler

import (
	"encoding/xml"
	"net/http"
	"time"

	"blog-server/internal/pkg"

	"github.com/gin-gonic/gin"
)

const (
	feedSiteName = "海棠小栈"
	feedSiteDesc = "海棠小栈 — 思考、记录、分享"
	feedMaxItems = 30
)

// ---------- RSS 2.0 feed ----------

type rssFeed struct {
	XMLName xml.Name   `xml:"rss"`
	Version string     `xml:"version,attr"`
	Channel rssChannel `xml:"channel"`
}

type rssChannel struct {
	Title       string    `xml:"title"`
	Link        string    `xml:"link"`
	Description string    `xml:"description"`
	Language    string    `xml:"language"`
	Items       []rssItem `xml:"item"`
}

type rssItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	GUID        string `xml:"guid"`
	PubDate     string `xml:"pubDate"`
	Description string `xml:"description"`
}

// Feed renders an RSS 2.0 feed of recent published posts (文稿).
func (h *ArticleHandler) Feed(c *gin.Context) {
	h.renderFeed(c, "post")
}

// NotesFeed renders an RSS 2.0 feed of recent published notes (手记).
func (h *ArticleHandler) NotesFeed(c *gin.Context) {
	h.renderFeed(c, "note")
}

func (h *ArticleHandler) renderFeed(c *gin.Context, articleType string) {
	origin := pkg.RequestOrigin(c)
	p := pkg.Pagination{Page: 1, PageSize: feedMaxItems}
	articles, _, err := h.svc.List(p, "", "", articleType)
	if err != nil {
		c.Data(http.StatusInternalServerError, "text/plain; charset=utf-8", []byte("failed to build feed"))
		return
	}

	items := make([]rssItem, 0, len(articles))
	for _, a := range articles {
		link := origin + "/article/" + a.Slug
		when := a.CreatedAt
		if a.PublishedAt != nil {
			when = *a.PublishedAt
		}
		items = append(items, rssItem{
			Title:       a.Title,
			Link:        link,
			GUID:        link,
			PubDate:     when.Format(time.RFC1123Z),
			Description: a.Excerpt,
		})
	}

	feed := rssFeed{
		Version: "2.0",
		Channel: rssChannel{
			Title:       feedSiteName,
			Link:        origin + "/",
			Description: feedSiteDesc,
			Language:    "zh-CN",
			Items:       items,
		},
	}

	out, err := xml.MarshalIndent(feed, "", "  ")
	if err != nil {
		c.Data(http.StatusInternalServerError, "text/plain; charset=utf-8", []byte("failed to encode feed"))
		return
	}
	c.Data(http.StatusOK, "application/rss+xml; charset=utf-8", append([]byte(xml.Header), out...))
}

// ---------- sitemap.xml ----------

type urlSet struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

type sitemapURL struct {
	Loc     string `xml:"loc"`
	LastMod string `xml:"lastmod,omitempty"`
}

// Sitemap renders a sitemap.xml of all public pages and published articles.
func (h *ArticleHandler) Sitemap(c *gin.Context) {
	origin := pkg.RequestOrigin(c)

	urls := []sitemapURL{
		{Loc: origin + "/"},
		{Loc: origin + "/posts"},
		{Loc: origin + "/notes"},
		{Loc: origin + "/timeline"},
	}

	p := pkg.Pagination{Page: 1, PageSize: 1000}
	if articles, _, err := h.svc.List(p, "", "", ""); err == nil {
		for _, a := range articles {
			urls = append(urls, sitemapURL{
				Loc:     origin + "/article/" + a.Slug,
				LastMod: a.UpdatedAt.Format("2006-01-02"),
			})
		}
	}

	set := urlSet{Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9", URLs: urls}
	out, err := xml.MarshalIndent(set, "", "  ")
	if err != nil {
		c.Data(http.StatusInternalServerError, "text/plain; charset=utf-8", []byte("failed to encode sitemap"))
		return
	}
	c.Data(http.StatusOK, "application/xml; charset=utf-8", append([]byte(xml.Header), out...))
}

// Robots renders robots.txt pointing crawlers at the sitemap.
func (h *ArticleHandler) Robots(c *gin.Context) {
	origin := pkg.RequestOrigin(c)
	body := "User-agent: *\nAllow: /\n\nSitemap: " + origin + "/sitemap.xml\n"
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(body))
}

// MetaBySlug returns Open Graph metadata for a published article, used by the
// SPA fallback to inject per-article OG/JSON-LD for crawlers. Returns ok=false
// for missing or unpublished articles (no view-count side effect).
func (h *ArticleHandler) MetaBySlug(slug string) (title, description, cover string, publishedAt *time.Time, ok bool) {
	a, err := h.svc.GetBySlug(slug)
	if err != nil || a == nil || a.Status != "published" {
		return "", "", "", nil, false
	}
	return a.Title, a.Excerpt, a.CoverImageURL, a.PublishedAt, true
}

