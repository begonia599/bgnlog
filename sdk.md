# MyPlatform Go SDK

`github.com/begonia599/myplatform/sdk` 是 MyPlatform 统一后端的 Go 客户端库，封装了**认证、权限、文件存储、图床**四大服务的全部 REST API。

> 本文档对照 **v0.10.0** 源码逐方法核实生成，覆盖全部 43 个服务方法 + 5 个客户端方法。
> 标注 🔹 的方法为 bgnlog 博客后端当前正在调用（附调用位置）。

## 安装

```bash
go get github.com/begonia599/myplatform/sdk
```

`server/go.mod` 当前锁定：

```
github.com/begonia599/myplatform v0.10.0
```

---

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

    // 注册（role 传空字符串则由平台取默认角色）
    reg, err := client.Auth.Register("alice", "password123", "")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("注册成功: id=%d, username=%s, role=%s\n", reg.ID, reg.Username, reg.Role)

    // 登录（Token 自动存入 client）
    if _, err := client.Auth.Login("alice", "password123"); err != nil {
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

## 客户端

### sdk.Config

| 字段 | 类型 | 说明 |
|------|------|------|
| `BaseURL` | `string` | 后端地址，如 `http://localhost:8080`。**末尾不要带 `/`** —— SDK 内部用 `baseURL + path` 拼接，多一个斜杠会产生 `//auth/login` |
| `HTTPClient` | `*http.Client` | 可选。为 `nil` 时使用默认客户端，超时 30 秒 |

### 客户端方法

| 方法 | 说明 |
|------|------|
| `sdk.New(cfg *Config) *Client` | 创建客户端。`cfg` 不可为 `nil` |
| `(*Client) WithToken(accessToken string) *Client` | 派生一个请求级轻量客户端，用指定 Token 代表某个用户发起调用 |
| `(*Client) SetTokens(access, refresh string, expiresIn int)` | 手动写入 Token 对（从持久化恢复时用）。`expiresIn` 单位为秒 |
| `(*Client) AccessToken() string` | 返回当前 Access Token |
| `(*Client) GetBaseURL() string` | 返回平台 BaseURL |

### Token 自动刷新

客户端内置线程安全（`sync.RWMutex`）的 Token 管理。每次发起需鉴权的请求前会检查：若 Access Token 为空、或**距过期不足 10 秒**，则自动用 Refresh Token 换新。

自动存储 Token 的入口只有三个：`Auth.Login()`、`Auth.OAuthExchange()`、`Client.SetTokens()`。

```go
// 登录后 Token 自动存储，后续调用无需手动携带
client.Auth.Login("alice", "password123")
me, _ := client.Auth.Me()

// 从持久化恢复
client.SetTokens(savedAccess, savedRefresh, 3600)
```

若既无 Access Token 也无 Refresh Token，需鉴权的调用会直接返回：

```go
&APIError{StatusCode: 401, Message: "not authenticated, call Login first"}
```

### WithToken：代表用户发起调用

业务服务（如博客后端）常需要**以某个终端用户的身份**调用平台。`WithToken` 派生的客户端共享底层 HTTP 连接和 BaseURL，但持有独立的 Token。

```go
// 从请求头拿到用户 Token，派生一个用户级客户端
userClient := platformClient.WithToken(userAccessToken)
img, err := userClient.ImageBed.UploadReader("avatar.png", reader)
```

> ⚠️ **派生客户端不会自动刷新 Token**（内部把过期时间设为公元 9999 年以跳过刷新逻辑）。它没有 Refresh Token，Token 过期时平台会直接返回 401，需由调用方处理。

### 错误处理

所有非 2xx 响应都会包装成 `*sdk.APIError`：

```go
type APIError struct {
    StatusCode int
    Message    string   // 取响应体的 error 字段，缺失时回落到 HTTP status 文本
}

func (e *APIError) Error() string  // "api error 404: user not found"
```

```go
import "errors"

_, err := client.Auth.Me()
var apiErr *sdk.APIError
if errors.As(err, &apiErr) && apiErr.StatusCode == 401 {
    // 重新登录
}
```

网络层、序列化层的错误则以 `sdk: <阶段>: <原因>` 的形式包装原始 error，可用 `errors.Unwrap` 取出。

---

## Auth 服务

### 基础认证

#### Register 🔹

```go
func (a *AuthService) Register(username, password, role string) (*RegisterResponse, error)
```

`POST /auth/register` · 免鉴权

创建新账号。`role` 传空字符串时不发送该字段，由平台使用默认角色。

<sub>调用位置：`server/internal/handler/auth.go`</sub>

#### Login 🔹

```go
func (a *AuthService) Login(username, password string) (*TokenPair, error)
```

`POST /auth/login` · 免鉴权

登录成功后**自动把 Token 对存入客户端**。

<sub>调用位置：`server/internal/handler/auth.go`</sub>

#### Refresh

```go
func (a *AuthService) Refresh() (*TokenPair, error)
```

`POST /auth/refresh` · 免鉴权（用客户端内已存的 Refresh Token）

手动刷新。通常不需要调用——请求前会自动刷新。客户端内无 Refresh Token 时返回 `APIError{401, "no refresh token available"}`。

#### Logout 🔹

```go
func (a *AuthService) Logout() error
```

`POST /auth/logout` · 需鉴权

吊销当前用户的所有 Refresh Token，并清空本地 Token 状态。

<sub>调用位置：`server/internal/handler/auth.go`</sub>

#### Me 🔹

```go
func (a *AuthService) Me() (*MeResponse, error)
```

`GET /auth/me` · 需鉴权

一次返回 `User` + `UserProfile`。

<sub>调用位置：`server/internal/handler/auth.go`</sub>

#### Verify 🔹

```go
func (a *AuthService) Verify(token string) (*VerifyResponse, error)
```

`POST /auth/verify` · 免鉴权（服务间调用）

校验任意 Token 并返回其归属用户。**这是业务服务鉴权中间件的标准入口**——不需要客户端自身处于登录态。

```go
resp, err := client.Auth.Verify(tokenFromHeader)
if err != nil || !resp.Valid {
    c.AbortWithStatus(http.StatusUnauthorized)
    return
}
userID := resp.User.ID
```

<sub>调用位置：`server/internal/middleware/auth.go`</sub>

#### GetProfile 🔹

```go
func (a *AuthService) GetProfile() (*UserProfile, error)
```

`GET /auth/profile` · 需鉴权

<sub>调用位置：`server/internal/handler/auth.go`</sub>

#### UpdateProfile 🔹

```go
func (a *AuthService) UpdateProfile(update *ProfileUpdate) (*UserProfile, error)
```

`PUT /auth/profile` · 需鉴权

`ProfileUpdate` 全部字段为指针，**只有非 nil 字段会被发送**，便于做部分更新：

```go
type ProfileUpdate struct {
    Nickname  *string `json:"nickname,omitempty"`
    AvatarURL *string `json:"avatar_url,omitempty"`
    Bio       *string `json:"bio,omitempty"`
    Phone     *string `json:"phone,omitempty"`
    Birthday  *string `json:"birthday,omitempty"` // 格式 YYYY-MM-DD
}
```

```go
nickname := "新昵称"
profile, err := client.Auth.UpdateProfile(&sdk.ProfileUpdate{Nickname: &nickname})
```

<sub>调用位置：`server/internal/handler/auth.go`</sub>

#### ChangePassword 🔹

```go
func (a *AuthService) ChangePassword(oldPassword, newPassword string) error
```

`PUT /auth/password` · 需鉴权

`oldPassword` 传空字符串时不发送 `old_password` 字段——这是**给 OAuth-only 用户首次设置密码**用的路径。

<sub>调用位置：`server/internal/handler/auth.go`</sub>

---

### OAuth

典型登录流程：`OAuthAuthorize` 拿授权 URL → 用户在第三方授权 → 平台回调业务前端并带上一次性 `exchange_code` → `OAuthExchange` 换 Token。

#### OAuthAuthorize 🔹

```go
func (a *AuthService) OAuthAuthorize(provider, redirectURI string) (*OAuthAuthorizeResponse, error)
```

`GET /auth/oauth/{provider}?redirect_uri={redirectURI}` · 免鉴权

返回 `{AuthURL string}`，把用户重定向过去即可。`redirectURI` 是授权完成后回跳的业务前端地址。

<sub>调用位置：`server/internal/handler/auth.go`</sub>

#### OAuthExchange 🔹

```go
func (a *AuthService) OAuthExchange(exchangeCode string) (*TokenPair, error)
```

`POST /auth/oauth/exchange` · 免鉴权

用一次性 exchange code 换取 Token 对，**成功后自动存入客户端**。

<sub>调用位置：`server/internal/handler/auth.go`</sub>

#### OAuthBindAuthorize 🔹

```go
func (a *AuthService) OAuthBindAuthorize(provider, redirectURI string, extraScopes ...string) (*OAuthAuthorizeResponse, error)
```

`GET /auth/oauth/{provider}/bind?redirect_uri={redirectURI}&scopes={extraScopes}` · **需鉴权**

绑定模式：回调时把第三方账号挂到**当前已登录用户**名下，不创建新用户。

`extraScopes` 可申请超出登录默认值的额外权限，多个 scope 会以空格连接后 URL 编码。例如 Discord 频道校验需要：

```go
resp, err := userClient.Auth.OAuthBindAuthorize(
    "discord", "https://blog.example.com/settings",
    "guilds", "guilds.members.read",
)
```

回跳地址上会带 `?bind_result=` 参数，取值为 `success` / `already_bound` / `conflict` / `oauth_failed` / `internal_error`。

<sub>调用位置：`server/internal/handler/auth.go`、`server/internal/service/zone.go`</sub>

#### GetOAuthAccounts 🔹

```go
func (a *AuthService) GetOAuthAccounts() (*OAuthAccountsResponse, error)
```

`GET /auth/oauth/accounts` · 需鉴权

返回当前用户已绑定的全部第三方账号，外加 `HasPassword bool`——可据此判断是否允许解绑最后一个 OAuth 账号（否则用户将无法登录）。

<sub>调用位置：`server/internal/handler/auth.go`</sub>

#### GetOAuthToken 🔹

```go
func (a *AuthService) GetOAuthToken(provider string) (*OAuthTokenResponse, error)
```

`GET /auth/oauth/accounts/{provider}/token` · 需鉴权

取出用户在第三方的 Access Token（平台侧已按需自动刷新），供受信任的下游服务代表用户调用第三方 API。

返回 `{AccessToken string, Scopes []string, ExpiresAt *time.Time}`。

可能的错误码：

| 状态码 | 含义 |
|--------|------|
| `404` | 该 provider 未绑定 |
| `410` | 无存储的 Token（历史遗留记录，需用户重新授权） |
| `401` | Token 刷新失败（用户在第三方侧撤销了授权） |

<sub>调用位置：`server/internal/service/zone.go`（校验 Discord 服务器成员身份）</sub>

#### UnlinkOAuth 🔹

```go
func (a *AuthService) UnlinkOAuth(provider string) error
```

`DELETE /auth/oauth/accounts/{provider}` · 需鉴权

<sub>调用位置：`server/internal/handler/auth.go`</sub>

---

### 账号合并

用于「OAuth 登录后发现自己早有本地账号」的场景。合并后旧账号变成 tombstone（墓碑），业务方需自行迁移数据再清理。

#### LinkExisting 🔹

```go
func (a *AuthService) LinkExisting(username, password string) (*LinkExistingResponse, error)
```

`POST /auth/oauth/link-existing` · 需鉴权

把当前已登录的 OAuth-only 用户，合并进一个通过密码校验的本地账号。

```go
type LinkExistingResponse struct {
    Message     string
    PrimaryID   uint       // 合并后保留的主账号 ID
    SecondaryID uint       // 被合并掉的 tombstone ID
    Tokens      TokenPair  // 主账号的新 Token
    User        struct{ ID uint; Username, Role string }
}
```

> ⚠️ 返回的 Token **不会自动存入客户端**——这是刻意设计：调用方可能需要先以 secondary 身份完成业务侧数据迁移，再切换身份。

标准三步：

```go
resp, err := userClient.Auth.LinkExisting("alice", "password123")
if err != nil { return err }

// 1. 把业务库里指向 SecondaryID 的记录改到 PrimaryID
migrateUserRefs(resp.SecondaryID, resp.PrimaryID)

// 2. 切换到主账号身份
userClient.SetTokens(resp.Tokens.AccessToken, resp.Tokens.RefreshToken, resp.Tokens.ExpiresIn)

// 3. 清理墓碑
userClient.Auth.PurgeUser(resp.SecondaryID)
```

<sub>调用位置：`server/internal/handler/auth.go`</sub>

#### GetCanonicalUser

```go
func (a *AuthService) GetCanonicalUser(id uint) (*CanonicalUserResponse, error)
```

`GET /auth/users/{id}/canonical` · 需鉴权

把一个可能已被合并的用户 ID 解析到当前有效的账号。返回 `RequestedID` / `CanonicalID` / `Merged bool` 和用户信息。业务库里存着历史 user_id 时可用它做兜底。

#### PurgeUser 🔹

```go
func (a *AuthService) PurgeUser(id uint) error
```

`DELETE /auth/users/{id}/purge` · 需鉴权

硬删除一个已被合并的 tombstone。调用方必须是合并目标账号本人，或 admin/root。

<sub>调用位置：`server/internal/handler/auth.go`</sub>

---

## Permission 服务

### 模块注册（推荐入口）

业务模块声明自己有哪些资源和动作，并顺带声明默认授权——这样全新部署无需人工配权。

#### RegisterPermissions 🔹

```go
func (p *PermissionService) RegisterPermissions(module string, resources []ResourceDef, grants ...RoleGrant) error
```

`POST /api/permissions/registry` · 免鉴权（服务间调用）

**幂等**，重复注册不会产生重复定义。`grants` 声明的默认策略会以 `{module}.{resource}` 的命名空间幂等地写入 Casbin。admin 是超级用户，无需列出。

```go
err := client.Permission.RegisterPermissions("blog",
    []sdk.ResourceDef{
        {Resource: "article", Actions: []string{"create", "read", "update", "delete"}, Description: "博客文章"},
        {Resource: "comment", Actions: []string{"create", "read", "delete"}, Description: "评论"},
    },
    sdk.RoleGrant{Role: "user", Resource: "comment", Action: "create"},
)
```

<sub>调用位置：`server/cmd/server/main.go`（启动时注册）</sub>

#### CheckPermission 🔹

```go
func (p *PermissionService) CheckPermission(userID uint, object, action string) (bool, error)
```

`POST /api/permissions/check` · 免鉴权（服务间调用）

鉴权中间件的标准入口。`object` 用 `{module}.{resource}` 形式：

```go
allowed, err := client.Permission.CheckPermission(userID, "blog.comment", "create")
```

<sub>调用位置：`server/internal/middleware/auth.go`</sub>

#### ListModules

```go
func (p *PermissionService) ListModules() ([]string, error)
```

`GET /api/permissions/registry` · 需鉴权

#### ListModulePermissions

```go
func (p *PermissionService) ListModulePermissions(module string) ([]PermissionDef, error)
```

`GET /api/permissions/registry/{module}` · 需鉴权

---

### 策略 CRUD（Admin）

#### ListPolicies

```go
func (p *PermissionService) ListPolicies(role string) ([]Policy, error)
```

`GET /api/permissions/policies?role={role}` · 需鉴权 · `role` 传空则返回全部

#### AddPolicy / RemovePolicy

```go
func (p *PermissionService) AddPolicy(role, object, action string) error
func (p *PermissionService) RemovePolicy(role, object, action string) error
```

`POST` / `DELETE /api/permissions/policies` · 需鉴权

#### ListUserRoles / AssignRole / RemoveRole

```go
func (p *PermissionService) ListUserRoles(userID uint) ([]string, error)
func (p *PermissionService) AssignRole(userID uint, role string) error
func (p *PermissionService) RemoveRole(userID uint, role string) error
```

`GET /api/permissions/roles/{userID}` · `POST` / `DELETE /api/permissions/roles` · 需鉴权

---

### 默认角色策略

新用户注册时自动套用的策略集。

```go
func (p *PermissionService) GetDefaultPolicies(role string) ([]DefaultPolicy, error)
func (p *PermissionService) SetDefaultPolicies(role string, policies []Policy) error
```

`GET` / `PUT /api/permissions/defaults/{role}` · 需鉴权

> `SetDefaultPolicies` 是**整体替换**语义，不是追加。

---

## Storage 服务

通用文件存储。全部方法需鉴权。

> multipart 表单字段名为 **`file`**（图床用的是 `image`，别混）。

#### Upload / UploadReader 🔹

```go
func (s *StorageService) Upload(filePath string) (*File, error)
func (s *StorageService) UploadReader(filename string, reader io.Reader) (*File, error)
```

`POST /api/storage/upload`

`Upload` 是 `UploadReader` 的本地文件封装（自动取 `filepath.Base` 作为文件名）。服务端接收 HTTP 上传时用 `UploadReader` 直接转发，避免落盘：

```go
fh, _ := c.FormFile("file")
src, _ := fh.Open()
defer src.Close()
file, err := userClient.Storage.UploadReader(fh.Filename, src)
```

<sub>调用位置：`server/internal/handler/upload.go`</sub>

#### List

```go
func (s *StorageService) List(page, pageSize int) (*FileListResponse, error)
```

`GET /api/storage/files?page={page}&page_size={pageSize}`

#### GetMeta 🔹

```go
func (s *StorageService) GetMeta(id uint) (*File, error)
```

`GET /api/storage/files/{id}`

<sub>调用位置：`server/internal/handler/upload.go`</sub>

#### Download / DownloadTo 🔹

```go
func (s *StorageService) Download(id uint) (io.ReadCloser, string, error)
func (s *StorageService) DownloadTo(id uint, destPath string) error
```

`GET /api/storage/files/{id}/download`

`Download` 的第二个返回值是原始的 `Content-Disposition` 响应头（不是解析后的文件名）。**返回的 ReadCloser 必须由调用方关闭。**

```go
body, disposition, err := client.Storage.Download(42)
if err != nil { return err }
defer body.Close()
```

<sub>调用位置：`server/internal/handler/upload.go`</sub>

#### Delete

```go
func (s *StorageService) Delete(id uint) error
```

`DELETE /api/storage/files/{id}`

---

## ImageBed 服务

图床，相比 Storage 多了公开/私有可见性控制。除 `PublicURL` 外均需鉴权。

> multipart 表单字段名为 **`image`**。

#### Upload / UploadReader 🔹

```go
func (s *ImageBedService) Upload(filePath string) (*Image, error)
func (s *ImageBedService) UploadReader(filename string, reader io.Reader) (*Image, error)
```

`POST /api/imagebed/upload`

`UploadReader` 会**按扩展名显式设置 part 的 Content-Type**，而不是让 multipart 默认写成 `application/octet-stream`。内置了 jpg/jpeg/png/gif/webp/svg/bmp/ico 的硬编码兜底表——因为 Alpine 容器没有 `/etc/mime.types`，`mime.TypeByExtension` 会返回空。

<sub>调用位置：`server/internal/handler/auth.go`（头像上传）</sub>

#### List

```go
func (s *ImageBedService) List(page, pageSize int) (*ImageListResponse, error)
```

`GET /api/imagebed/images?page={page}&page_size={pageSize}` · 只返回当前用户的图片

#### Delete

```go
func (s *ImageBedService) Delete(id uint) error
```

`DELETE /api/imagebed/images/{id}`

#### ToggleVisibility

```go
func (s *ImageBedService) ToggleVisibility(id uint, isPublic bool) (*Image, error)
```

`PATCH /api/imagebed/images/{id}/visibility`

#### PublicURL

```go
func (s *ImageBedService) PublicURL(id uint) string
```

**纯本地字符串拼接，不发起任何请求**，返回 `{BaseURL}/api/imagebed/{id}`。

> ⚠️ 拼接用的是客户端配置的 `BaseURL`。若容器内 `BaseURL` 是内网地址（如 `http://app:8080`），生成的 URL 无法给浏览器使用。博客用独立的 `BLOG_PLATFORM_PUBLIC_URL` 环境变量处理对外地址，见 `docker-compose.yml`。

---

## 类型参考

### 认证

```go
type TokenPair struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    TokenType    string `json:"token_type"`
    ExpiresIn    int    `json:"expires_in"`   // 秒
}

type User struct {
    ID        uint      `json:"id"`
    Username  string    `json:"username"`
    Email     *string   `json:"email,omitempty"`
    Role      string    `json:"role"`
    Status    string    `json:"status"`
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

type MeResponse struct {
    User    User        `json:"user"`
    Profile UserProfile `json:"profile"`
}

type RegisterResponse struct {
    ID       uint   `json:"id"`
    Username string `json:"username"`
    Role     string `json:"role"`
}

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

### OAuth

```go
type OAuthAuthorizeResponse struct {
    AuthURL string `json:"auth_url"`
}

type OAuthAccountInfo struct {
    ID             uint   `json:"id"`
    Provider       string `json:"provider"`
    ProviderUserID string `json:"provider_user_id"`
    Email          string `json:"email"`
    AvatarURL      string `json:"avatar_url"`
    CreatedAt      string `json:"created_at"`
    UpdatedAt      string `json:"updated_at"`
}

type OAuthAccountsResponse struct {
    Accounts    []OAuthAccountInfo `json:"accounts"`
    HasPassword bool               `json:"has_password"`
}

type OAuthTokenResponse struct {
    AccessToken string     `json:"access_token"`
    Scopes      []string   `json:"scopes"`
    ExpiresAt   *time.Time `json:"expires_at,omitempty"`
}

type CanonicalUserResponse struct {
    RequestedID uint `json:"requested_id"`
    CanonicalID uint `json:"canonical_id"`
    Merged      bool `json:"merged"`
    User        struct {
        ID       uint   `json:"id"`
        Username string `json:"username"`
        Role     string `json:"role"`
        Status   string `json:"status"`
    } `json:"user"`
}
```

### 权限

```go
type Policy struct {
    Role   string `json:"role"`
    Object string `json:"object"`
    Action string `json:"action"`
}

type ResourceDef struct {
    Resource    string   `json:"resource"`
    Actions     []string `json:"actions"`
    Description string   `json:"description,omitempty"`
}

type RoleGrant struct {
    Role     string `json:"role"`
    Resource string `json:"resource"`
    Action   string `json:"action"`
}

type PermissionDef struct {
    ID          uint   `json:"id"`
    Module      string `json:"module"`
    Resource    string `json:"resource"`
    Action      string `json:"action"`
    Description string `json:"description"`
}

type DefaultPolicy struct {
    ID     uint   `json:"id"`
    Role   string `json:"role"`
    Object string `json:"object"`
    Action string `json:"action"`
}
```

### 文件与图片

```go
type File struct {
    ID           uint      `json:"id"`
    Filename     string    `json:"filename"`
    OriginalName string    `json:"original_name"`
    Size         int64     `json:"size"`
    MimeType     string    `json:"mime_type"`
    StorageType  string    `json:"storage_type"`
    StoragePath  string    `json:"storage_path"`
    UploaderID   uint      `json:"uploader_id"`
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}

type Image struct {
    ID           uint      `json:"id"`
    Filename     string    `json:"filename"`
    OriginalName string    `json:"original_name"`
    Size         int64     `json:"size"`
    MimeType     string    `json:"mime_type"`
    StoragePath  string    `json:"storage_path"`
    UploaderID   uint      `json:"uploader_id"`
    IsPublic     bool      `json:"is_public"`
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}

// 分页响应：FileListResponse / ImageListResponse
// 均为 { Data []T, Total int64, Page int, PageSize int }
```

---

## 方法总览

「鉴权」列中，**否**表示服务间调用，客户端无需处于登录态。

### Auth（18）

| 方法 | HTTP | 鉴权 | 博客在用 |
|------|------|:----:|:----:|
| `Register` | `POST /auth/register` | 否 | 🔹 |
| `Login` | `POST /auth/login` | 否 | 🔹 |
| `Refresh` | `POST /auth/refresh` | 否 | |
| `Logout` | `POST /auth/logout` | 是 | 🔹 |
| `Me` | `GET /auth/me` | 是 | 🔹 |
| `Verify` | `POST /auth/verify` | 否 | 🔹 |
| `GetProfile` | `GET /auth/profile` | 是 | 🔹 |
| `UpdateProfile` | `PUT /auth/profile` | 是 | 🔹 |
| `ChangePassword` | `PUT /auth/password` | 是 | 🔹 |
| `OAuthAuthorize` | `GET /auth/oauth/{provider}` | 否 | 🔹 |
| `OAuthExchange` | `POST /auth/oauth/exchange` | 否 | 🔹 |
| `OAuthBindAuthorize` | `GET /auth/oauth/{provider}/bind` | 是 | 🔹 |
| `GetOAuthAccounts` | `GET /auth/oauth/accounts` | 是 | 🔹 |
| `GetOAuthToken` | `GET /auth/oauth/accounts/{provider}/token` | 是 | 🔹 |
| `UnlinkOAuth` | `DELETE /auth/oauth/accounts/{provider}` | 是 | 🔹 |
| `LinkExisting` | `POST /auth/oauth/link-existing` | 是 | 🔹 |
| `GetCanonicalUser` | `GET /auth/users/{id}/canonical` | 是 | |
| `PurgeUser` | `DELETE /auth/users/{id}/purge` | 是 | 🔹 |

### Permission（12）

| 方法 | HTTP | 鉴权 | 博客在用 |
|------|------|:----:|:----:|
| `RegisterPermissions` | `POST /api/permissions/registry` | 否 | 🔹 |
| `CheckPermission` | `POST /api/permissions/check` | 否 | 🔹 |
| `ListModules` | `GET /api/permissions/registry` | 是 | |
| `ListModulePermissions` | `GET /api/permissions/registry/{module}` | 是 | |
| `ListPolicies` | `GET /api/permissions/policies` | 是 | |
| `AddPolicy` | `POST /api/permissions/policies` | 是 | |
| `RemovePolicy` | `DELETE /api/permissions/policies` | 是 | |
| `ListUserRoles` | `GET /api/permissions/roles/{userID}` | 是 | |
| `AssignRole` | `POST /api/permissions/roles` | 是 | |
| `RemoveRole` | `DELETE /api/permissions/roles` | 是 | |
| `GetDefaultPolicies` | `GET /api/permissions/defaults/{role}` | 是 | |
| `SetDefaultPolicies` | `PUT /api/permissions/defaults/{role}` | 是 | |

### Storage（7）

| 方法 | HTTP | 鉴权 | 博客在用 |
|------|------|:----:|:----:|
| `Upload` | `POST /api/storage/upload` | 是 | |
| `UploadReader` | `POST /api/storage/upload` | 是 | 🔹 |
| `List` | `GET /api/storage/files` | 是 | |
| `GetMeta` | `GET /api/storage/files/{id}` | 是 | 🔹 |
| `Download` | `GET /api/storage/files/{id}/download` | 是 | 🔹 |
| `DownloadTo` | `GET /api/storage/files/{id}/download` | 是 | |
| `Delete` | `DELETE /api/storage/files/{id}` | 是 | |

### ImageBed（6）

| 方法 | HTTP | 鉴权 | 博客在用 |
|------|------|:----:|:----:|
| `Upload` | `POST /api/imagebed/upload` | 是 | |
| `UploadReader` | `POST /api/imagebed/upload` | 是 | 🔹 |
| `List` | `GET /api/imagebed/images` | 是 | |
| `Delete` | `DELETE /api/imagebed/images/{id}` | 是 | |
| `ToggleVisibility` | `PATCH /api/imagebed/images/{id}/visibility` | 是 | |
| `PublicURL` | — （本地拼接） | — | |

---

## 博客侧集成备忘

`docker-compose.yml` 中博客通过外部网络 `myplatform_default` 接入平台：

| 环境变量 | 值 | 用途 |
|----------|-----|------|
| `BLOG_PLATFORM_BASE_URL` | `http://app:8080` | 容器内部调用地址，传给 `sdk.Config.BaseURL` |
| `BLOG_PLATFORM_PUBLIC_URL` | `https://core.bgnhub.me` | 对外地址，用于拼接浏览器可访问的资源 URL |

两者必须区分：SDK 的 `ImageBed.PublicURL()` 用的是 `BaseURL`，在容器里会生成内网地址，不能直接下发给前端。
