import { Suspense, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { LogoMark } from '../../components/BrandLogo'
import LangSwitch from '../../components/LangSwitch'
import { useSiteData } from '../../context/SiteDataContext'
import '../../styles/admin.css'

const navItems = [
  { sectionKey: 'navMain' },
  { to: '/admin/home', labelKey: 'navDashboard', icon: 'fa-solid fa-gauge-high', any: true },
  { sectionKey: 'navContent' },
  { to: '/admin/categories', labelKey: 'navCategories', icon: 'fa-solid fa-folder', perm: 'category' },
  { to: '/admin/subcategories', labelKey: 'navSubcategories', icon: 'fa-solid fa-folder-tree', perm: 'category' },
  { to: '/admin/posts/new', labelKey: 'navNewPost', icon: 'fa-solid fa-pen-to-square', perm: 'post' },
  { to: '/admin/posts', labelKey: 'navAllPosts', icon: 'fa-solid fa-newspaper', perm: 'post' },
  { to: '/admin/home-lead', labelKey: 'navHomeLead', icon: 'fa-solid fa-table-columns', perm: ['setting', 'post'] },
  { to: '/admin/sidebars', labelKey: 'navSidebars', icon: 'fa-solid fa-bars-staggered', perm: ['setting', 'category'] },
  { to: '/admin/layout-topics', labelKey: 'navLayoutTopics', icon: 'fa-solid fa-layer-group', perm: ['setting', 'category', 'post'] },
  { to: '/admin/latest-popular', labelKey: 'navLatestPopular', icon: 'fa-solid fa-fire-flame-curved', perm: ['setting', 'category', 'post'] },
  { to: '/admin/topic-grid', labelKey: 'navTopicGrid', icon: 'fa-solid fa-grip', perm: ['category', 'setting', 'post'] },
  {
    groupKey: 'navAiWriter',
    icon: 'fa-solid fa-robot',
    perm: 'setting',
    children: [
      { to: '/admin/ai', labelKey: 'navAiSettings' },
      { to: '/admin/facebook-settings', labelKey: 'navFacebookSettings' },
    ],
  },
  {
    groupKey: 'navOpinion',
    icon: 'fa-solid fa-comments',
    perm: ['setting', 'post'],
    children: [
      { to: '/admin/opinions', labelKey: 'navOpinionList', end: true },
      { to: '/admin/opinions/new', labelKey: 'navOpinionAdd' },
    ],
  },
  {
    groupKey: 'navPolls',
    icon: 'fa-solid fa-square-poll-vertical',
    perm: ['setting', 'post'],
    children: [
      { to: '/admin/polls', labelKey: 'navPollList', end: true },
      { to: '/admin/polls/new', labelKey: 'navPollAdd' },
    ],
  },
  {
    groupKey: 'navSurvey',
    icon: 'fa-solid fa-clipboard-list',
    perm: ['setting', 'post'],
    children: [
      { to: '/admin/surveys', labelKey: 'navSurveyList', end: true },
      { to: '/admin/surveys/new', labelKey: 'navSurveyAdd' },
    ],
  },
  {
    groupKey: 'navPages',
    icon: 'fa-regular fa-file-lines',
    perm: ['setting', 'post'],
    children: [
      { to: '/admin/pages/new', labelKey: 'navPageAdd' },
      { to: '/admin/pages', labelKey: 'navPageList', end: true },
    ],
  },
  { sectionKey: 'navBreaking' },
  { to: '/admin/breaking', labelKey: 'navBreaking', icon: 'fa-solid fa-bolt', perm: ['breaking', 'post', 'setting'] },
  { sectionKey: 'navGallery' },
  { to: '/admin/photos', labelKey: 'navPhotos', icon: 'fa-regular fa-image', perm: 'gallery' },
  { to: '/admin/videos', labelKey: 'navVideos', icon: 'fa-solid fa-clapperboard', perm: 'gallery' },
  { sectionKey: 'navStaffSec' },
  { to: '/admin/staff', labelKey: 'navStaff', icon: 'fa-solid fa-users', perm: ['setting', 'role'] },
  { to: '/admin/writers', labelKey: 'navWriters', icon: 'fa-solid fa-feather', role: 'superadmin' },
  { sectionKey: 'navUsersSec' },
  { to: '/admin/users', labelKey: 'navUsers', icon: 'fa-solid fa-user-gear', perm: ['users', 'role'] },
  { to: '/admin/users/new', labelKey: 'navAddUser', icon: 'fa-solid fa-user-plus', perm: ['users', 'role'] },
  { to: '/admin/roles', labelKey: 'navRoles', icon: 'fa-solid fa-id-badge', perm: ['users', 'role'] },
  { to: '/admin/permissions', labelKey: 'navPermissions', icon: 'fa-solid fa-key', perm: ['users', 'role'] },
  { sectionKey: 'navSettings' },
  { to: '/admin/password', labelKey: 'navPassword', icon: 'fa-solid fa-lock', any: true },
  { to: '/admin/website', labelKey: 'navWebsite', icon: 'fa-solid fa-gear', perm: 'setting' },
  { to: '/admin/login-logo', labelKey: 'navLoginLogo', icon: 'fa-regular fa-id-badge', role: 'superadmin' },
  { to: '/admin/namaz', labelKey: 'navNamaz', icon: 'fa-solid fa-mosque', perm: 'setting' },
  { to: '/admin/notice', labelKey: 'navNotice', icon: 'fa-solid fa-bullhorn', perm: 'setting' },
  { to: '/admin/social', labelKey: 'navSocial', icon: 'fa-solid fa-share-nodes', perm: 'setting' },
  { to: '/admin/facebook-settings', labelKey: 'navFacebookSettings', icon: 'fa-brands fa-facebook', perm: 'setting' },
  { to: '/admin/seo', labelKey: 'navSeo', icon: 'fa-solid fa-magnifying-glass-chart', perm: ['setting', 'ads'] },
  { to: '/admin/ads', labelKey: 'navAds', icon: 'fa-solid fa-rectangle-ad', perm: ['setting', 'ads'] },
  { to: '/admin/important-websites', labelKey: 'navWebsites', icon: 'fa-solid fa-link', perm: 'setting' },
]

function canSee(user, item) {
  if (!user) return false
  if (item.any) return true
  if (user.role === 'superadmin') return true
  if (item.role && user.role !== item.role) return false
  if (!item.perm) return true
  const keys = Array.isArray(item.perm) ? item.perm : [item.perm]
  const perms = user.permissions || {}
  return keys.some((k) => perms[k] === true)
}

function childActive(pathname, to, end) {
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

function NavGroup({ item, t, pathname, onNavigate }) {
  const hasActive = item.children.some((c) => childActive(pathname, c.to, c.end))
  const [open, setOpen] = useState(hasActive)

  useEffect(() => {
    if (hasActive) setOpen(true)
  }, [hasActive])

  return (
    <li className={`admin-nav-group${hasActive ? ' is-current' : ''}${open ? ' is-open' : ''}`}>
      <button type="button" className="admin-nav-group-btn" onClick={() => setOpen((v) => !v)}>
        <span className="admin-nav-icon" aria-hidden="true">
          <i className={item.icon} />
        </span>
        <span>{t[item.groupKey]}</span>
        <i className={`fa-solid fa-chevron-${open ? 'down' : 'right'} admin-nav-caret`} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="admin-nav-sub">
          {item.children.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                end={Boolean(child.end)}
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={onNavigate}
              >
                {t[child.labelKey]}
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { t, isEn } = useLang()
  const { settings } = useSiteData()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isPostEditor = pathname === '/admin/posts/new' || /^\/admin\/posts\/[^/]+$/.test(pathname)

  useEffect(() => {
    if (isPostEditor) setSidebarOpen(false)
  }, [isPostEditor])

  const visibleNav = useMemo(() => {
    const out = []
    let pendingSection = null
    for (const item of navItems) {
      if (item.sectionKey) {
        pendingSection = item
        continue
      }
      if (item.groupKey) {
        const kids = (item.children || []).filter((c) => canSee(user, { ...item, ...c, perm: c.perm || item.perm }))
        if (!kids.length || !canSee(user, item)) continue
        if (pendingSection) {
          out.push(pendingSection)
          pendingSection = null
        }
        out.push({ ...item, children: kids })
        continue
      }
      if (canSee(user, item)) {
        if (pendingSection) {
          out.push(pendingSection)
          pendingSection = null
        }
        out.push(item)
      }
    }
    return out
  }, [user])

  function handleLogout() {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className={`admin-wrapper${isPostEditor ? ' admin-wrapper--composer' : ''}`}>
      {sidebarOpen ? (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Link to="/admin/home" className="admin-sidebar-brand" aria-label={t.loginAdmin}>
          <LogoMark className="admin-brand-logo" src={settings?.logo} />
          <p className="admin-brand-tag">{isEn ? 'Editorial desk' : 'সম্পাদকীয় ডেস্ক'}</p>
        </Link>
        <ul className="admin-nav">
          {visibleNav.map((item, i) =>
            item.sectionKey ? (
              <li key={`s-${i}`} className="admin-nav-section">
                {t[item.sectionKey]}
              </li>
            ) : item.groupKey ? (
              <NavGroup
                key={item.groupKey}
                item={item}
                t={t}
                pathname={pathname}
                onNavigate={() => setSidebarOpen(false)}
              />
            ) : (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/admin/users'}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="admin-nav-icon" aria-hidden="true">
                    <i className={item.icon} />
                  </span>
                  {t[item.labelKey]}
                </NavLink>
              </li>
            ),
          )}
        </ul>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-menu-toggle"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={t.menu}
            >
              <i className="fa-solid fa-bars" />
            </button>
            <div className="admin-topbar-title">
              <h2>{t.adminPanel}</h2>
              <small>{isEn ? 'Krishikagos newsroom' : 'কৃষিকাগজ নিউজরুম'}</small>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <LangSwitch />
            <span className="admin-user">
              <i className="fa-regular fa-user" aria-hidden="true" />
              {user?.name} <em>({user?.role})</em>
            </span>
            <Link to="/" className="admin-btn admin-btn-sm admin-btn-secondary">
              {t.viewSite}
            </Link>
            <button type="button" className="admin-logout-btn" onClick={handleLogout}>
              {t.logout}
            </button>
          </div>
        </header>
        <main className="admin-content">
          <Suspense
            fallback={
              <div className="admin-loading">
                <div className="admin-spinner" />
                <p>{t.adminLoading}</p>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
