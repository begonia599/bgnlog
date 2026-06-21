package pkg

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// RequestOrigin returns the absolute scheme://host for the current request,
// honoring reverse-proxy headers (X-Forwarded-Proto / X-Forwarded-Host).
// Used to build absolute URLs for Open Graph tags, RSS, and the sitemap so the
// site adapts to whatever domain it is deployed on — no hardcoded domain.
func RequestOrigin(c *gin.Context) string {
	scheme := "http"
	if proto := firstHeaderValue(c.Request.Header.Get("X-Forwarded-Proto")); proto != "" {
		scheme = proto
	} else if c.Request.TLS != nil {
		scheme = "https"
	}

	host := c.Request.Host
	if fwd := firstHeaderValue(c.Request.Header.Get("X-Forwarded-Host")); fwd != "" {
		host = fwd
	}

	return scheme + "://" + host
}

// firstHeaderValue returns the first value of a possibly comma-separated proxy
// header (e.g. "https,http" -> "https"), trimmed of surrounding space.
func firstHeaderValue(v string) string {
	if v == "" {
		return ""
	}
	if i := strings.IndexByte(v, ','); i >= 0 {
		v = v[:i]
	}
	return strings.TrimSpace(v)
}
