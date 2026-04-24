import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api'
import { useAuth } from '@/contexts/AuthContext'

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { fetchUser } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    const exchangeCode = searchParams.get('exchange_code')
    const oauthError = searchParams.get('error')

    if (oauthError) {
      setError('GitHub 登录失败，请重试')
      return
    }

    if (!exchangeCode) {
      setError('缺少授权参数')
      return
    }

    authApi.oauthExchange(exchangeCode)
      .then((res) => {
        const tokens = res.data.data
        localStorage.setItem('access_token', tokens.access_token)
        localStorage.setItem('refresh_token', tokens.refresh_token)
        return fetchUser()
      })
      .then(() => {
        navigate('/', { replace: true })
      })
      .catch(() => {
        setError('GitHub 登录失败，请重试')
      })
  }, [searchParams, navigate, fetchUser])

  if (error) {
    return (
      <div className="mx-auto max-w-sm px-6 py-24 text-center">
        <p className="text-destructive">{error}</p>
        <a href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
          返回登录
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-24 text-center">
      <p className="text-muted-foreground">正在登录...</p>
    </div>
  )
}
