export interface Article {
  id: number
  title: string
  slug: string
  content: string
  excerpt: string
  cover_image_url: string
  cover_file_id: number | null
  status: 'draft' | 'published'
  type: 'post' | 'note'
  author_id: number
  author_name: string
  category_id: number | null
  category: Category | null
  tags: Tag[]
  view_count: number
  like_count: number
  liked: boolean
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

export interface OAuthAccount {
  id: number
  provider: string
  provider_user_id: string
  email: string
  avatar_url: string
  created_at: string
  updated_at: string
}

export interface OAuthAccountsData {
  accounts: OAuthAccount[]
  has_password: boolean
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

// --- Zone ---

export type ZoneRuleKind =
  | 'discord_guild_member'
  | 'discord_guild_role'
  | 'discord_guild_boost'
  | 'discord_guild_join_days'
  | 'discord_account_age'
  | 'discord_connection'

export interface ZoneRule {
  id: number
  zone_id: number
  kind: ZoneRuleKind
  guild_id?: string
  role_id?: string
  value?: number
  value_str?: string
  description?: string
  label?: string
  created_at: string
  updated_at: string
}

export interface Zone {
  id: number
  slug: string
  name: string
  description: string
  cover_image_url: string
  owner_id: number
  visibility: 'public' | 'gated'
  rule_logic: 'or' | 'and'
  sort_order: number
  rules?: ZoneRule[]
  created_at: string
  updated_at: string
}

export interface ZoneAccessDecision {
  status: 'allowed' | 'denied' | 'need_link' | 'need_reauth' | 'error'
  reason?: string
  missing_scopes?: string[]
  evaluated_at: string
}

// --- Zone Posts & Comments ---

export interface ZonePost {
  id: number
  zone_id: number
  title: string
  content: string
  images: string[]
  is_anonymous: boolean
  is_pinned: boolean
  status: 'open' | 'closed' | 'resolved'
  comment_count: number
  author_name: string
  author_avatar: string
  is_owner: boolean
  created_at: string
  updated_at: string
}

export interface ZonePostListResult {
  posts: ZonePost[]
  total: number
  page: number
  size: number
}

export interface ZoneComment {
  id: number
  post_id: number
  parent_id?: number
  content: string
  is_anonymous: boolean
  author_name: string
  author_avatar: string
  is_owner: boolean
  created_at: string
}

// Site stats widget
export interface SiteStats {
  launched_at: string
  total_visits: number
  today_visits: number
}

export interface SiteInfoSettings {
  launched_at: string
  is_default: boolean
}
