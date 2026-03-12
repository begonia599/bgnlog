package handler

import (
	"blog-server/internal/pkg"
	"io"
	"net/http"
	"strconv"

	"github.com/begonia599/myplatform/sdk"
	"github.com/gin-gonic/gin"
)

type UploadHandler struct {
	plat      *sdk.Client
	adminPlat *sdk.Client
}

func NewUploadHandler(plat, adminPlat *sdk.Client) *UploadHandler {
	return &UploadHandler{plat: plat, adminPlat: adminPlat}
}

func (h *UploadHandler) Upload(c *gin.Context) {
	fh, err := c.FormFile("file")
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "missing file")
		return
	}

	src, err := fh.Open()
	if err != nil {
		pkg.Error(c, http.StatusInternalServerError, "failed to open file")
		return
	}
	defer src.Close()

	token, _ := c.Get("token")
	userClient := h.plat.WithToken(token.(string))

	file, err := userClient.Storage.UploadReader(fh.Filename, src)
	if err != nil {
		forwardPlatformError(c, err)
		return
	}

	pkg.Created(c, gin.H{
		"id":       file.ID,
		"filename": file.OriginalName,
		"size":     file.Size,
		"mime":     file.MimeType,
		"url":      "/api/files/" + strconv.Itoa(int(file.ID)),
	})
}

func (h *UploadHandler) FileProxy(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		pkg.Error(c, http.StatusBadRequest, "invalid file id")
		return
	}

	body, contentDisp, err := h.adminPlat.Storage.Download(uint(id))
	if err != nil {
		pkg.Error(c, http.StatusNotFound, "file not found")
		return
	}
	defer body.Close()

	meta, err := h.adminPlat.Storage.GetMeta(uint(id))
	if err == nil && meta.MimeType != "" {
		c.Header("Content-Type", meta.MimeType)
	}

	if contentDisp != "" {
		c.Header("Content-Disposition", contentDisp)
	}

	c.Header("Cache-Control", "public, max-age=86400")
	c.Status(http.StatusOK)
	io.Copy(c.Writer, body)
}
