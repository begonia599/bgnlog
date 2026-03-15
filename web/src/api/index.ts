import api from './client'
import type { ApiResponse, Article, PaginatedData, Category, Tag, Comment, ArchiveItem, AuthTokens, UserProfile } from '@/types'

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
