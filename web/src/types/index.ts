export interface Article {
  id: number
  title: string
  slug: string
  content: string
  excerpt: string
  cover_image_url: string
  cover_file_id: number | null
  status: 'draft' | 'published'
  author_id: number
  author_name: string
  category_id: number | null
  category: Category | null
  tags: Tag[]
  view_count: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string
  sort_order: number
}

export interface Tag {
  id: number
  name: string
  slug: string
}

export interface Comment {
  id: number
  article_id: number
  parent_id: number | null
  user_id: number
  username: string
  avatar_url: string
  content: string
  children?: Comment[]
  created_at: string
  updated_at: string
}

export interface User {
  id: number
  username: string
  email?: string
  role: string
  status: string
}

export interface UserProfile {
  id: number
  user_id: number
  nickname: string
  avatar_url: string
  bio: string
  updated_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PaginatedData<T> {
  items: T[]
  pagination: {
    page: number
    page_size: number
    total: number
  }
}

export interface ArchiveItem {
  year: number
  month: number
  count: number
}
