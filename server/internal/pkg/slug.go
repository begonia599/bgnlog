package pkg

import (
	"fmt"
	"math/rand"
	"regexp"
	"strings"
	"time"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

var (
	nonAlphaNum = regexp.MustCompile(`[^a-z0-9\p{Han}\p{Hiragana}\p{Katakana}-]+`)
	multiDash   = regexp.MustCompile(`-{2,}`)
)

func GenerateSlug(title string) string {
	s := strings.ToLower(strings.TrimSpace(title))
	s = norm.NFKD.String(s)

	// Replace spaces with dashes
	s = strings.ReplaceAll(s, " ", "-")

	// Keep alphanumeric, CJK characters, and dashes
	s = nonAlphaNum.ReplaceAllString(s, "-")
	s = multiDash.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")

	// If slug is empty (e.g., all special chars), generate a random one
	if s == "" {
		s = fmt.Sprintf("post-%s", randomString(6))
	}

	return s
}

func UniqueSlug(title string) string {
	base := GenerateSlug(title)

	// Check if slug contains CJK characters — if so, truncate and append short ID
	hasCJK := false
	for _, r := range base {
		if unicode.Is(unicode.Han, r) {
			hasCJK = true
			break
		}
	}

	if hasCJK {
		runes := []rune(base)
		if len(runes) > 20 {
			runes = runes[:20]
		}
		return fmt.Sprintf("%s-%s", string(runes), randomString(4))
	}

	// For Latin slugs, truncate at 60 chars and append short ID
	if len(base) > 60 {
		base = base[:60]
	}
	return fmt.Sprintf("%s-%s", base, randomString(4))
}

func randomString(n int) string {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[r.Intn(len(letters))]
	}
	return string(b)
}
