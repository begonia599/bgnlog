import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Layout } from '@/components/layout/Layout'
import HomePage from '@/pages/HomePage'
import PostsPage from '@/pages/PostsPage'
import ArticlePage from '@/pages/ArticlePage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import EditorPage from '@/pages/EditorPage'
import SearchPage from '@/pages/SearchPage'
import ArchivesPage from '@/pages/ArchivesPage'
import DraftsPage from '@/pages/DraftsPage'
import AdminPage from '@/pages/AdminPage'
import ProfilePage from '@/pages/ProfilePage'
import NotesPage from '@/pages/NotesPage'
import TimelinePage from '@/pages/TimelinePage'
import ThinkingPage from '@/pages/ThinkingPage'
import FriendsPage from '@/pages/FriendsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import type { ReactNode } from 'react'

function RequireAuth({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/posts" element={<PostsPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/thinking" element={<ThinkingPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/article/:slug" element={<ArticlePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/archives" element={<ArchivesPage />} />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/editor"
          element={
            <RequireAuth roles={['admin', 'editor']}>
              <EditorPage />
            </RequireAuth>
          }
        />
        <Route
          path="/editor/:id"
          element={
            <RequireAuth roles={['admin', 'editor']}>
              <EditorPage />
            </RequireAuth>
          }
        />
        <Route
          path="/drafts"
          element={
            <RequireAuth roles={['admin', 'editor']}>
              <DraftsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth roles={['admin']}>
              <AdminPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
