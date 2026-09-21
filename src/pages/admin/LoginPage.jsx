import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useSiteData } from '../../context/SiteDataContext'
import { LogoMark, LOGO_SRC } from '../../components/BrandLogo'
import LangSwitch from '../../components/LangSwitch'
import { api } from '../../api/client'
import '../../styles/admin.css'

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth()
  const { t, isEn } = useLang()
  const { settings } = useSiteData()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loginLogo, setLoginLogo] = useState('')

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setLoginLogo(s?.loginLogo || ''))
      .catch(() => {})
  }, [])

  if (!loading && isAuthenticated) {
    return <Navigate to="/admin/home" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      const from = location.state?.from?.pathname || '/admin/home'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || (isEn ? 'Login failed' : 'লগইন ব্যর্থ হয়েছে'))
    } finally {
      setSubmitting(false)
    }
  }

  const logoSrc = loginLogo || settings?.logo || LOGO_SRC

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-lang">
          <LangSwitch />
        </div>
        <div className="login-box-header">
          <div className="login-logo-wrap">
            <LogoMark className="login-logo" src={logoSrc} />
          </div>
          <h1>{t.loginAdmin}</h1>
          <p>{isEn ? 'Krishikagos editorial desk' : 'কৃষিকাগজ সম্পাদকীয় ডেস্ক'}</p>
        </div>
        <div className="login-box-body">
          {error && <div className="login-error">{error}</div>}
          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="form-group">
              <label htmlFor="email">{t.emailOrUser || t.email}</label>
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">{t.password}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="login-btn" disabled={submitting}>
              {submitting ? t.loggingIn : t.login}
            </button>
          </form>
          <div className="login-footer">
            <Link to="/register">{t.reporterReg}</Link>
            {' · '}
            <Link to="/">{t.viewSite}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
