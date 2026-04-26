import api from './client'
import type { ApiResponse, Article, PaginatedData, Category, Tag, Comment, ArchiveItem, AuthTokens, UserProfile, OAuthAccountsData, Zone, ZoneRule, ZoneAccessDecision, ZonePost, ZonePostListResult, ZoneComment } from '@/types'

// Auth
export const authApi = {
  register: (username: string, password: string) =>
    api.post<ApiResponse<{ id: number; username: string; role: string }>>('/auth/register', { username, password }),
  login: (username: string, password: string) =>
    api.post<ApiResponse<AuthTokens>>('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<ApiResponse<{ user: { id: number; username: string; role: string }; profile: { nickname: string; avatar_url: string } }>>('/auth/me'),
  getProfile: () => api.get<ApiResponse<UserProfile>>('/auth/profile'),
  updateProfile: (data: { nickname?: string; avatar_url?: string; bio?: string }) =>
    api.put<ApiResponse<UserProfile>>('/auth/profile', data),
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    return api.post<ApiResponse<{ url: string }>>('/auth/avatar', form)
  },
  changePassword: (oldPassword: string, newPassword: string) =>
    api.put<ApiResponse<{ message: string }>>('/auth/password', {
      old_password: oldPassword || undefined,
      new_password: newPassword,
    }),
  getOAuthAccounts: () =>
    api.get<ApiResponse<OAuthAccountsData>>('/auth/oauth/accounts'),
  unlinkOAuth: (provider: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/auth/oauth/accounts/${provider}`),
  oauthAuthorize: (provider: string, redirectUri: string) =>
    api.get<ApiResponse<{ auth_url: string }>>(`/auth/oauth/${provider}`, { params: { redirect_uri: redirectUri } }),
  oauthBindAuthorize: (provider: string, redirectUri: string) =>
    api.get<ApiResponse<{ auth_url: string }>>(`/auth/oauth/${provider}/bind`, { params: { redirect_uri: redirectUri } }),
  oauthExchange: (exchangeCode: string) =>
    api.post<ApiResponse<AuthTokens>>('/auth/oauth/exchange', { exchange_code: exchangeCode }),
  linkExisting: (username: string, password: string) =>
    api.post<ApiResponse<{
      message: string
      primary_id: number
      secondary_id: number
      tokens: AuthTokens
      user: { id: number; username: string; role: string }
      migration_error?: string
    }>>('/auth/oauth/link-existing', { username, password }),
}

// Articles
export const articleApi = {
  list: (params?: { page?: number; page_size?: number; category?: string; tag?: string }) =>
    api.get<ApiResponse<PaginatedData<Article>>>('/api/articles', { params }),
  search: (q: string, page = 1) =>
    api.get<ApiResponse<PaginatedData<Article>>>('/api/articles/search', { params: { q, page } }),
  drafts: (page = 1) =>
    api.get<ApiResponse<PaginatedData<Article>>>('/api/articles/drafts', { params: { page } }),
  getBySlug: (slug: string) =>
    api.get<ApiResponse<Article>>(`/api/articles/${slug}`),
  create: (data: Partial<Article> & { tag_ids?: number[] }) =>
    api.post<ApiResponse<Article>>('/api/articles', data),
  update: (id: number, data: Partial<Article> & { tag_ids?: number[] }) =>
    api.put<ApiResponse<Article>>(`/api/articles/${id}`, data),
  delete: (id: number) =>
    api.delete(`/api/articles/${id}`),
}

// Categories
export const categoryApi = {
  list: () => api.get<ApiResponse<Category[]>>('/api/categories'),
  create: (data: { name: string; description?: string; sort_order?: number }) =>
    api.post<ApiResponse<Category>>('/api/categories', data),
  update: (id: number, data: { name: string; description?: string; sort_order?: number }) =>
    api.put<ApiResponse<Category>>(`/api/categories/${id}`, data),
  delete: (id: number) => api.delete(`/api/categories/${id}`),
}

// Tags
export const tagApi = {
  list: () => api.get<ApiResponse<Tag[]>>('/api/tags'),
  create: (name: string) => api.post<ApiResponse<Tag>>('/api/tags', { name }),
  delete: (id: number) => api.delete(`/api/tags/${id}`),
}

// Comments
export const commentApi = {
  list: (slug: string) => api.get<ApiResponse<Comment[]>>(`/api/articles/${slug}/comments`),
  create: (slug: string, data: { content: string; parent_id?: number }) =>
    api.post<ApiResponse<Comment>>(`/api/articles/${slug}/comments`, data),
  update: (id: number, content: string) =>
    api.put<ApiResponse<Comment>>(`/api/comments/${id}`, { content }),
  delete: (id: number) => api.delete(`/api/comments/${id}`),
}

// Upload
export const uploadApi = {
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<{ id: number; filename: string; url: string }>>('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// Archives
export const archiveApi = {
  list: () => api.get<ApiResponse<ArchiveItem[]>>('/api/archives'),
}

// Site Settings
export interface HeroSettings {
  hero_title: string
  hero_subtitle: string
  hero_avatar_url: string
  hero_nickname: string
  hero_bio: string
  discord_user_id: string
}

// Zones
export const zoneApi = {
  list: () => api.get<ApiResponse<Zone[]>>('/api/zones'),
  getBySlug: (slug: string) => api.get<ApiResponse<Zone>>(`/api/zones/${slug}`),
  checkAccess: (slug: string) => api.get<ApiResponse<ZoneAccessDecision>>(`/api/zones/${slug}/access`),
  // admin
  listAdmin: () => api.get<ApiResponse<Zone[]>>('/api/admin/zones'),
  create: (data: { slug: string; name: string; description?: string; cover_image_url?: string; visibility?: string; rule_logic?: string; sort_order?: number }) =>
    api.post<ApiResponse<Zone>>('/api/zones', data),
  update: (id: number, data: { name?: string; description?: string; cover_image_url?: string; visibility?: string; rule_logic?: string; sort_order?: number }) =>
    api.put<ApiResponse<Zone>>(`/api/zones/${id}`, data),
  delete: (id: number) => api.delete(`/api/zones/${id}`),
  addRule: (zoneId: number, data: { kind: string; guild_id?: string; role_id?: string; value?: number; value_str?: string; description?: string; label?: string }) =>
    api.post<ApiResponse<ZoneRule>>(`/api/zones/${zoneId}/rules`, data),
  deleteRule: (zoneId: number, ruleId: number) =>
    api.delete(`/api/zones/${zoneId}/rules/${ruleId}`),
  requestReauth: (redirectUri: string) =>
    api.get<ApiResponse<{ auth_url: string }>>(`/api/zones/reauth?redirect_uri=${encodeURIComponent(redirectUri)}`),
}

// Zone Posts & Comments
export const zonePostApi = {
  listPosts: (slug: string, page = 1, size = 20) =>
    api.get<ApiResponse<ZonePostListResult>>(`/api/zones/${slug}/posts?page=${page}&size=${size}`),
  getPost: (slug: string, postId: number) =>
    api.get<ApiResponse<ZonePost>>(`/api/zones/${slug}/posts/${postId}`),
  createPost: (slug: string, data: { title: string; content: string; is_anonymous?: boolean }) =>
    api.post<ApiResponse<ZonePost>>(`/api/zones/${slug}/posts`, data),
  updateStatus: (slug: string, postId: number, status: string) =>
    api.put(`/api/zones/${slug}/posts/${postId}/status`, { status }),
  togglePin: (slug: string, postId: number, pinned: boolean) =>
    api.put(`/api/zones/${slug}/posts/${postId}/pin`, { pinned }),
  deletePost: (slug: string, postId: number) =>
    api.delete(`/api/zones/${slug}/posts/${postId}`),
  listComments: (slug: string, postId: number) =>
    api.get<ApiResponse<ZoneComment[]>>(`/api/zones/${slug}/posts/${postId}/comments`),
  createComment: (slug: string, postId: number, data: { content: string; parent_id?: number; is_anonymous?: boolean }) =>
    api.post<ApiResponse<ZoneComment>>(`/api/zones/${slug}/posts/${postId}/comments`, data),
  deleteComment: (slug: string, postId: number, commentId: number) =>
    api.delete(`/api/zones/${slug}/posts/${postId}/comments/${commentId}`),
}

export const settingsApi = {
  getHero: () => api.get<ApiResponse<HeroSettings>>('/api/settings/hero'),
  updateHero: (data: Partial<HeroSettings>) =>
    api.put<ApiResponse<HeroSettings>>('/api/settings/hero', data),
}
