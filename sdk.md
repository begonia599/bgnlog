# MyPlatform Go SDK

`github.com/begonia599/myplatform/sdk` 是 MyPlatform 统一后端的 Go 客户端库，封装了认证、权限、存储三大服务的全部 API。

## 安装

```bash
go get github.com/begonia599/myplatform/sdk
```

## 快速开始

```go
package main

import (
    "fmt"
    "log"

    "github.com/begonia599/myplatform/sdk"
)

func main() {
    client := sdk.New(&sdk.Config{
        BaseURL: "http://localhost:8080",
    })

    // 注册
    reg, err := client.Auth.Register("alice", "password123", "user")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("注册成功: id=%d, role=%s\n", reg.ID, reg.Role)

    // 登录（Token 自动存储在 client 中）
    _, err = client.Auth.Login("alice", "password123")
    if err != nil {
        log.Fatal(err)
    }

    // 获取当前用户
    me, err := client.Auth.Me()
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("当前用户: %s, 角色: %s\n", me.User.Username, me.User.Role)

    // 上传文件
    file, err := client.Storage.Upload("./photo.jpg")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("上传成功: id=%d, size=%d\n", file.ID, file.Size)
}
```

---

## 客户端配置

### sdk.Config

| 字段 | 类型 | 说明 |
|------|------|------|
| `BaseURL` | `string` | 后端地址，如 `http://localhost:8080` |
| `HTTPClient` | `*http.Client` | 可选，自定义 HTTP 客户端。默认超时 30 秒 |

### 创建客户端

```go
// 基础用法
client := sdk.New(&sdk.Config{
    BaseURL: "http://localhost:8080",
})

// 自定义 HTTP 客户端
client := sdk.New(&sdk.Config{
    BaseURL: "http://localhost:8080",
    HTTPClient: &http.Client{Timeout: 60 * time.Second},
})
```

### Token 管理

SDK 客户端内置线程安全的 Token 管理，登录后自动存储，请求时自动附加，过期前 10 秒自动刷新。

```go
// 登录后 Token 自动存储
client.Auth.Login("alice", "password123")

// 手动设置 Token（从持久化存储恢复时使用）
client.SetTokens(accessToken, refreshToken, expiresInSeconds)

// 读取当前 access token
token := client.AccessToken()
```

### 多用户 / 请求级客户端

在 Web 服务中，通常需要以不同用户身份发起请求。使用 `WithToken` 创建轻量的请求级客户端：

```go
// 全局客户端（共享 HTTP 连接池和配置）
var platform = sdk.New(&sdk.Config{BaseURL: "http://localhost:8080"})

func handler(c *gin.Context) {
    token := extractBearerToken(c)

    // 创建以该用户身份操作的客户端（不会自动刷新 Token）
    userClient := platform.WithToken(token)

    // 使用该用户身份调用 API
    files, _ := userClient.Storage.List(1, 20)
}
```

> `WithToken` 返回的客户端共享底层 HTTP 连接池，但**不会**自动刷新 Token。适合在中间件验证 Token 后使用。

---

## 错误处理

所有 API 错误都返回 `*sdk.APIError`：

```go
file, err := client.Storage.GetMeta(999)
if err != nil {
    var apiErr *sdk.APIError
    if errors.As(err, &apiErr) {
        fmt.Printf("HTTP %d: %s\n", apiErr.StatusCode, apiErr.Message)
        // HTTP 404: file not found
    }
}
```

| StatusCode | 含义 |
|------------|------|
| 400 | 请求参数错误 |
| 401 | 未认证或 Token 无效 |
| 403 | 无权限（如注册关闭、用户被禁用） |
| 404 | 资源不存在 |
| 409 | 冲突（如用户名已存在） |
| 500 | 服务器内部错误 |

---

## Auth 认证服务

通过 `client.Auth` 访问。

### Register — 注册用户

```go
func (a *AuthService) Register(username, password, role string) (*RegisterResponse, error)
```

- `role` 可选，传空字符串则使用服务端默认值 `"user"`
- 服务端可通过配置关闭注册（`allow_registration: false`）

```go
resp, err := client.Auth.Register("bob", "secret", "editor")
// resp.ID, resp.Username, resp.Role
```

**错误码**：409 用户名已存在 | 403 注册已关闭

### Login — 登录

```go
func (a *AuthService) Login(username, password string) (*TokenPair, error)
```

登录成功后 Token 自动存入客户端，后续请求无需手动设置。

```go
tokens, err := client.Auth.Login("bob", "secret")
// tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresIn
```

**错误码**：401 用户名或密码错误

### Refresh — 刷新 Token

```go
func (a *AuthService) Refresh() (*TokenPair, error)
```

手动刷新。通常不需要调用，SDK 在 Token 过期前 10 秒会自动刷新。

### Logout — 登出

```go
func (a *AuthService) Logout() error
```

吊销该用户所有 Refresh Token，并清除客户端中存储的 Token。

### Me — 获取当前用户信息

```go
func (a *AuthService) Me() (*MeResponse, error)
```

返回用户基础信息和个人资料。

```go
me, _ := client.Auth.Me()
fmt.Println(me.User.Username)   // "bob"
fmt.Println(me.User.Role)       // "editor"
fmt.Println(me.Profile.Nickname) // "Bob"
fmt.Println(me.Profile.Bio)      // "Hello world"
```

**返回类型**：

```go
type MeResponse struct {
    User    User        `json:"user"`
    Profile UserProfile `json:"profile"`
}

type User struct {
    ID        uint      `json:"id"`
    Username  string    `json:"username"`
    Email     *string   `json:"email,omitempty"`
    Role      string    `json:"role"`
    Status    string    `json:"status"`       // "active" | "banned" ...
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type UserProfile struct {
    ID        uint       `json:"id"`
    UserID    uint       `json:"user_id"`
    Nickname  string     `json:"nickname"`
    AvatarURL string     `json:"avatar_url"`
    Bio       string     `json:"bio"`
    Phone     string     `json:"phone"`
    Birthday  *time.Time `json:"birthday,omitempty"`
    UpdatedAt time.Time  `json:"updated_at"`
}
```

### Verify — 验证 Token（服务间调用）

```go
func (a *AuthService) Verify(token string) (*VerifyResponse, error)
```

**不需要认证**。用于微服务间验证用户 Token 的合法性。

```go
result, _ := platform.Auth.Verify(userToken)
if result.Valid {
    fmt.Println(result.User.ID, result.User.Role)
}
```

**返回类型**：

```go
type VerifyResponse struct {
    Valid bool       `json:"valid"`
    User  VerifyUser `json:"user"`
}

type VerifyUser struct {
    ID       uint   `json:"id"`
    Username string `json:"username"`
    Role     string `json:"role"`
    Status   string `json:"status"`
}
```

### GetProfile — 获取个人资料

```go
func (a *AuthService) GetProfile() (*UserProfile, error)
```

### UpdateProfile — 更新个人资料

```go
func (a *AuthService) UpdateProfile(update *ProfileUpdate) (*UserProfile, error)
```

仅发送非 nil 字段，支持部分更新。

```go
nickname := "新昵称"
bio := "这是我的简介"
profile, _ := client.Auth.UpdateProfile(&sdk.ProfileUpdate{
    Nickname: &nickname,
    Bio:      &bio,
})
```

| 字段 | 类型 | 格式 |
|------|------|------|
| Nickname | `*string` | — |
| AvatarURL | `*string` | URL |
| Bio | `*string` | — |
| Phone | `*string` | — |
| Birthday | `*string` | `YYYY-MM-DD` |

---

## Storage 存储服务

通过 `client.Storage` 访问。所有接口需要认证。

### Upload — 上传本地文件

```go
func (s *StorageService) Upload(filePath string) (*File, error)
```

```go
file, err := client.Storage.Upload("./cover.png")
fmt.Printf("id=%d, mime=%s, size=%d\n", file.ID, file.MimeType, file.Size)
```

### UploadReader — 从 Reader 上传

```go
func (s *StorageService) UploadReader(filename string, reader io.Reader) (*File, error)
```

适用于 HTTP 文件转发、内存数据上传等场景。

```go
// 转发 HTTP 上传
fh, _ := c.FormFile("file")
src, _ := fh.Open()
defer src.Close()

file, err := client.Storage.UploadReader(fh.Filename, src)
```

### List — 文件列表（分页）

```go
func (s *StorageService) List(page, pageSize int) (*FileListResponse, error)
```

`pageSize` 最大 100。

```go
list, _ := client.Storage.List(1, 20)
fmt.Printf("共 %d 个文件, 当前页 %d 个\n", list.Total, len(list.Data))

for _, f := range list.Data {
    fmt.Printf("  %s (%s, %d bytes)\n", f.OriginalName, f.MimeType, f.Size)
}
```

**返回类型**：

```go
type FileListResponse struct {
    Data     []File `json:"data"`
    Total    int64  `json:"total"`
    Page     int    `json:"page"`
    PageSize int    `json:"page_size"`
}

type File struct {
    ID           uint      `json:"id"`
    Filename     string    `json:"filename"`       // 存储文件名（UUID）
    OriginalName string    `json:"original_name"`  // 原始文件名
    Size         int64     `json:"size"`
    MimeType     string    `json:"mime_type"`
    StorageType  string    `json:"storage_type"`   // "local" | "s3"
    StoragePath  string    `json:"storage_path"`
    UploaderID   uint      `json:"uploader_id"`
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}
```

### GetMeta — 获取文件元信息

```go
func (s *StorageService) GetMeta(id uint) (*File, error)
```

### Download — 下载文件（流式）

```go
func (s *StorageService) Download(id uint) (io.ReadCloser, string, error)
```

返回文件流和 `Content-Disposition` 头。**调用方必须关闭返回的 ReadCloser**。

```go
body, contentDisp, _ := client.Storage.Download(fileID)
defer body.Close()

io.Copy(os.Stdout, body)
```

### DownloadTo — 下载到本地路径

```go
func (s *StorageService) DownloadTo(id uint, destPath string) error
```

```go
err := client.Storage.DownloadTo(fileID, "./downloaded.png")
```

### Delete — 删除文件

```go
func (s *StorageService) Delete(id uint) error
```

文件所有者可直接删除；非所有者需要 `storage:delete` 权限。

---

## Permission 权限服务

通过 `client.Permission` 访问。**所有接口需要 admin 角色**。

平台使用 RBAC 模型，核心概念：
- **Role**（角色）：如 `admin`、`user`、`editor`
- **Object**（资源对象）：如 `articles`、`storage`、`users`
- **Action**（操作）：如 `read`、`create`、`update`、`delete`

### ListPolicies — 列出策略

```go
func (p *PermissionService) ListPolicies(role string) ([]Policy, error)
```

`role` 为空则返回全部策略。

```go
// 查看所有策略
policies, _ := client.Permission.ListPolicies("")

// 查看 editor 角色的策略
policies, _ := client.Permission.ListPolicies("editor")

for _, p := range policies {
    fmt.Printf("%s can %s on %s\n", p.Role, p.Action, p.Object)
}
```

**返回类型**：

```go
type Policy struct {
    Role   string `json:"role"`
    Object string `json:"object"`
    Action string `json:"action"`
}
```

### AddPolicy — 添加策略

```go
func (p *PermissionService) AddPolicy(role, object, action string) error
```

幂等操作，策略已存在时不会报错。

```go
// 允许 editor 删除 articles
client.Permission.AddPolicy("editor", "articles", "delete")
```

### RemovePolicy — 移除策略

```go
func (p *PermissionService) RemovePolicy(role, object, action string) error
```

### ListUserRoles — 查看用户角色

```go
func (p *PermissionService) ListUserRoles(userID uint) ([]string, error)
```

```go
roles, _ := client.Permission.ListUserRoles(1)
// ["admin"]
```

### AssignRole — 分配角色

```go
func (p *PermissionService) AssignRole(userID uint, role string) error
```

```go
client.Permission.AssignRole(2, "editor")
```

### RemoveRole — 移除角色

```go
func (p *PermissionService) RemoveRole(userID uint, role string) error
```

---

## 默认权限策略

平台启动时（`seed_defaults: true`）自动创建以下策略：

| 角色 | 资源 | 操作 |
|------|------|------|
| admin | users | read, create, update, delete |
| admin | articles | read, create, update, delete |
| admin | permissions | read, create, delete |
| admin | storage | upload, read, delete |
| user | articles | read, create |
| user | storage | upload, read |
| editor | articles | read, create, update |
| editor | storage | upload, read |

---

## REST API 速查

SDK 方法与 REST 端点的对应关系：

### Auth (`/auth`)

| 方法 | HTTP | 路径 | 认证 |
|------|------|------|------|
| `Auth.Register()` | POST | `/auth/register` | 否 |
| `Auth.Login()` | POST | `/auth/login` | 否 |
| `Auth.Refresh()` | POST | `/auth/refresh` | 否 |
| `Auth.Verify()` | POST | `/auth/verify` | 否 |
| `Auth.Logout()` | POST | `/auth/logout` | 是 |
| `Auth.Me()` | GET | `/auth/me` | 是 |
| `Auth.GetProfile()` | GET | `/auth/profile` | 是 |
| `Auth.UpdateProfile()` | PUT | `/auth/profile` | 是 |

### Storage (`/api/storage`)

| 方法 | HTTP | 路径 | 认证 |
|------|------|------|------|
| `Storage.Upload()` | POST | `/api/storage/upload` | 是 |
| `Storage.UploadReader()` | POST | `/api/storage/upload` | 是 |
| `Storage.List()` | GET | `/api/storage/files?page=&page_size=` | 是 |
| `Storage.GetMeta()` | GET | `/api/storage/files/:id` | 是 |
| `Storage.Download()` | GET | `/api/storage/files/:id/download` | 是 |
| `Storage.Delete()` | DELETE | `/api/storage/files/:id` | 是 |

### Permission (`/api/permissions`) — 需要 admin 角色

| 方法 | HTTP | 路径 | 认证 |
|------|------|------|------|
| `Permission.ListPolicies()` | GET | `/api/permissions/policies?role=` | 是 |
| `Permission.AddPolicy()` | POST | `/api/permissions/policies` | 是 |
| `Permission.RemovePolicy()` | DELETE | `/api/permissions/policies` | 是 |
| `Permission.ListUserRoles()` | GET | `/api/permissions/roles/:user_id` | 是 |
| `Permission.AssignRole()` | POST | `/api/permissions/roles` | 是 |
| `Permission.RemoveRole()` | DELETE | `/api/permissions/roles` | 是 |

---

## 完整示例：博客服务中使用 SDK

以下展示如何在一个独立的博客微服务中使用 SDK 对接平台：

```go
package main

import (
    "log"
    "net/http"
    "strings"

    "github.com/begonia599/myplatform/sdk"
    "github.com/gin-gonic/gin"
)

var platform *sdk.Client

func main() {
    platform = sdk.New(&sdk.Config{
        BaseURL: "http://localhost:8080",
    })

    r := gin.Default()

    // 公开接口
    r.GET("/blog/posts", handleListPosts)
    r.GET("/blog/posts/:id", handleGetPost)

    // 需要认证的接口
    auth := r.Group("/blog")
    auth.Use(authRequired())
    {
        auth.POST("/posts", handleCreatePost)
        auth.PUT("/posts/:id", handleUpdatePost)
        auth.DELETE("/posts/:id", handleDeletePost)
        auth.POST("/upload", handleUploadImage)
    }

    log.Println("Blog service running on :8082")
    r.Run(":8082")
}

// authRequired 通过平台 Verify 接口验证 Token
func authRequired() gin.HandlerFunc {
    return func(c *gin.Context) {
        header := c.GetHeader("Authorization")
        if header == "" {
            c.AbortWithStatusJSON(401, gin.H{"error": "missing token"})
            return
        }

        parts := strings.SplitN(header, " ", 2)
        if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
            c.AbortWithStatusJSON(401, gin.H{"error": "invalid format"})
            return
        }

        result, err := platform.Auth.Verify(parts[1])
        if err != nil || !result.Valid {
            c.AbortWithStatusJSON(401, gin.H{"error": "invalid token"})
            return
        }

        c.Set("user", result.User)
        c.Set("token", parts[1])
        c.Next()
    }
}

// userClient 以当前用户身份创建 SDK 客户端
func userClient(c *gin.Context) *sdk.Client {
    return platform.WithToken(c.GetString("token"))
}

// handleUploadImage 上传博客配图到平台存储
func handleUploadImage(c *gin.Context) {
    fh, err := c.FormFile("image")
    if err != nil {
        c.JSON(400, gin.H{"error": "missing image"})
        return
    }

    src, _ := fh.Open()
    defer src.Close()

    file, err := userClient(c).Storage.UploadReader(fh.Filename, src)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }

    c.JSON(201, gin.H{
        "id":  file.ID,
        "url": file.StoragePath,
    })
}
```

> 博客自身的文章 CRUD 逻辑使用独立数据库，认证和文件存储通过 SDK 委托给平台处理。
