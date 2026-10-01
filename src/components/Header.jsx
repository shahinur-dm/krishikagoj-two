import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useSiteData } from '../context/SiteDataContext'
import { useLang } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { BrandLogoLink } from './BrandLogo'
import LangSwitch from './LangSwitch'

const DHAKA_TZ = 'Asia/Dhaka'

function CategoryLink({ cat, text, className, onClick, caret }) {
  return (
    <NavLink
      to={`/category/${cat.slug}`}
      onClick={onClick}
      className={({ isActive }) => `${className}${isActive ? ' active' : ''}`}
    >
      {text(cat.name, cat.nameEn)}
      {caret}
    </NavLink>
  )
}

export function SiteHeader() {
  const { categories, settings, subs } = useSiteData()
  const { t, text, isEn, toggleLang } = useLang()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const navRailRef = useRef(null)
  const moreRef = useRef(null)
  const userMenuRef = useRef(null)
  const [megaOpen, setMegaOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [openAcc, setOpenAcc] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [q, setQ] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [hiddenIds, setHiddenIds] = useState([])
  const [now] = useState(() => new Date())

  const social = settings?.social || {}

  function runSearch(e) {
    e?.preventDefault?.()
    const term = q.trim()
    if (!term) return
    setSearchOpen(false)
    navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  const navCats = useMemo(
    () => (categories || []).filter((c) => c.slug && c.slug !== 'home'),
    [categories],
  )

  const subMap = useMemo(() => {
    const map = {}
    ;(subs || []).forEach((s) => {
      const cid = s.category?._id || s.category
      if (!map[cid]) map[cid] = []
      map[cid].push(s)
    })
    return map
  }, [subs])

  const hiddenCats = useMemo(
    () => navCats.filter((c) => hiddenIds.includes(String(c._id))),
    [navCats, hiddenIds],
  )

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 90)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMegaOpen(false)
    setMoreOpen(false)
    setUserMenuOpen(false)
    setOpenAcc(null)
  }, [location.pathname])

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return
      setMegaOpen(false)
      setMoreOpen(false)
      setUserMenuOpen(false)
      setOpenAcc(null)
    }
    function onClick(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false)
      if (e.target.closest('.nav-mega') || e.target.closest('.kk-mega-panel')) return
      if (e.target.closest('.kk-drawer') || e.target.closest('.expend-navbar')) return
      setMegaOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [])

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 991.98px)').matches
    document.body.style.overflow = megaOpen && mobile ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [megaOpen])

  useLayoutEffect(() => {
    const list = navRailRef.current
    if (!list) return

    function fit() {
      const catItems = Array.from(list.querySelectorAll(':scope > .nav-item[data-nav-id]'))
      const more = list.querySelector(':scope > .nav-more')
      const home = list.querySelector(':scope > .nav-home')
      const mega = list.querySelector(':scope > .nav-mega')
      if (!catItems.length) {
        setHiddenIds([])
        return
      }

      catItems.forEach((el) => el.classList.remove('nav-item-overflow'))
      if (more) more.classList.add('is-idle')

      const available = list.clientWidth
      const homeW = home ? home.offsetWidth : 0
      const megaW = mega ? mega.offsetWidth : 0
      let used = homeW + megaW
      const allFit = catItems.every((el) => {
        used += el.offsetWidth
        return used <= available - 2
      })

      if (allFit) {
        setHiddenIds((prev) => (prev.length ? [] : prev))
        return
      }

      if (more) more.classList.remove('is-idle')
      const moreW = more ? more.offsetWidth : 96
      used = homeW + megaW + moreW
      const nextHidden = []
      catItems.forEach((el) => {
        if (used + el.offsetWidth <= available - 2) {
          used += el.offsetWidth
        } else {
          el.classList.add('nav-item-overflow')
          nextHidden.push(el.dataset.navId)
        }
      })
      setHiddenIds((prev) => {
        const same = prev.length === nextHidden.length && prev.every((id, i) => id === nextHidden[i])
        return same ? prev : nextHidden
      })
    }

    const ro = new ResizeObserver(fit)
    ro.observe(list)
    window.addEventListener('resize', fit)
    document.fonts?.ready?.then(fit)
    fit()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [navCats, scrolled, isEn])

  const displayDate = new Intl.DateTimeFormat(isEn ? 'en-GB' : 'bn-BD', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: DHAKA_TZ,
  }).format(now)

  function closeMenus() {
    setMegaOpen(false)
    setMoreOpen(false)
    setOpenAcc(null)
  }

  function renderCatItem(cat) {
    const catSubs = subMap[cat._id] || []
    const overflow = hiddenIds.includes(String(cat._id))
    if (catSubs.length) {
      return (
        <li
          key={cat._id}
          data-nav-id={cat._id}
          className={`nav-item has-sub${overflow ? ' nav-item-overflow' : ''}`}
        >
          <CategoryLink
            cat={cat}
            text={text}
            className="nav-link animated"
            caret={<i className="fa-solid fa-chevron-down ms-1 sub-caret" />}
          />
          <ul className="nav-submenu">
            {catSubs.map((s) => (
              <li key={s._id}>
                <Link to={`/category/${cat.slug}?sub=${s.slug}`}>{text(s.nameBn, s.nameEn)}</Link>
              </li>
            ))}
          </ul>
        </li>
      )
    }
    return (
      <li
        key={cat._id}
        data-nav-id={cat._id}
        className={`nav-item${overflow ? ' nav-item-overflow' : ''}`}
      >
        <CategoryLink cat={cat} text={text} className="nav-link animated" />
      </li>
    )
  }

  return (
    <header className={scrolled ? 'header-scrolled' : ''}>
      <div className="top-header header-desktop d-print-none">
        <div className="container">
          <div className="top-header-flex">
            <div className="main-logo">
              <BrandLogoLink />
            </div>

            <div className="main-links d-flex">
              <div className="nav-item d-none d-xl-block">
                <Link to="/epaper" className="nav-link">
                  <i className="fa-solid fa-table-list me-1" />
                  {t.todayPaper}
                </Link>
              </div>
              <div className="nav-item d-none d-lg-block">
                <Link to="/epaper" className="nav-link">
                  <i className="fa-regular fa-newspaper me-1" />
                  {t.epaper}
                </Link>
              </div>
              <div className="nav-item d-none d-lg-block">
                <Link to="/category/projukti" className="nav-link">
                  <i className="fa-solid fa-book-open me-1" />
                  {t.magazine}
                </Link>
              </div>
              <div className="nav-item d-none d-xxl-block">
                <Link to="/search" className="nav-link">
                  <i className="fa-solid fa-box-archive me-1" />
                  {t.archive || 'আর্কাইভ'}
                </Link>
              </div>
              <div className="nav-item d-none d-lg-block">
                <a className="nav-link" href={social.facebook || '#'} target="_blank" rel="noreferrer">
                  <i className="fa-solid fa-thumbs-up me-1" />
                  {t.social}
                </a>
              </div>
              <div className="nav-item d-none d-xxl-block">
                <button
                  type="button"
                  className="nav-link border-0 bg-transparent"
                  onClick={toggleLang}
                  title={isEn ? 'বাংলায় দেখুন' : 'Switch to English'}
                >
                  <i className="fa-solid fa-repeat me-1" />
                  {t.converter || 'বাংলা কনভার্টার'}
                </button>
              </div>
              {user ? (
                <div className="nav-item d-none d-md-block visitor-profile-nav" ref={userMenuRef}>
                  <span
                    className="nav-link d-inline-flex align-items-center"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setUserMenuOpen((v) => !v)}
                    role="button"
                    tabIndex={0}
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        style={{ width: 20, height: 20, borderRadius: '50%', marginRight: 6, objectFit: 'cover' }}
                      />
                    ) : (
                      <i className="fa-solid fa-circle-user me-1" />
                    )}
                    <span className="visitor-name-label">{user.name?.split(' ')[0] || (isEn ? 'Account' : 'অ্যাকাউন্ট')}</span>
                  </span>
                  {userMenuOpen && (
                    <div className="visitor-dropdown-menu">
                      <div className="visitor-dropdown-header">
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </div>
                      <button
                        type="button"
                        className="visitor-logout-btn"
                        onClick={() => {
                          setUserMenuOpen(false)
                          logout()
                        }}
                      >
                        <i className="fa-solid fa-arrow-right-from-bracket me-2" />
                        {isEn ? 'Log Out' : 'লগআউট'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="nav-item d-none d-md-block">
                  <Link to="/login" className="nav-link">
                    <i className="fa-solid fa-user me-2" />
                    {t.login}
                  </Link>
                </div>
              )}
            </div>

            <div className="main-others">
              <LangSwitch className="d-none d-md-flex" />
              {searchOpen ? (
                <form className="search-area d-flex align-items-center" onSubmit={runSearch}>
                  <input
                    className="form-control"
                    placeholder={t.search}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" aria-label="search">
                    <i className="fa-solid fa-magnifying-glass" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger ms-2 hide-search"
                    onClick={() => setSearchOpen(false)}
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </form>
              ) : (
                <div className="nav-item">
                  <button
                    type="button"
                    className="nav-link search-toggle-btn border-0"
                    onClick={() => setSearchOpen(true)}
                    aria-label="Search"
                  >
                    <i className="fa-solid fa-magnifying-glass" />
                  </button>
                </div>
              )}
              <div className="nav-item position-relative">
                <span className="nav-link notification-toggle">
                  <i className="fa-solid fa-bell" />
                  <span className="notification-toggle-badge" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="top-header header-mobile d-print-none">
        <div className="container">
          <div className="header-mobile-bar">
            <div className="main-logo">
              <BrandLogoLink />
            </div>
            <div className="header-mobile-tools">
              <LangSwitch className="lang-switch--compact" />
              <button
                type="button"
                className="nav-link search-toggle-btn border-0"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Search"
              >
                <i className="fa-solid fa-magnifying-glass" />
              </button>
              <button
                type="button"
                className="nav-link expend-navbar border-0"
                onClick={() => setMegaOpen(true)}
                aria-expanded={megaOpen}
                aria-label={t.menu}
              >
                <i className="fa-solid fa-bars" />
              </button>
            </div>
          </div>
          {searchOpen && (
            <form className="search-area d-flex align-items-center mt-2" onSubmit={runSearch}>
              <input
                className="form-control"
                placeholder={t.search}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button type="submit" className="btn btn-primary ms-2">
                <i className="fa-solid fa-magnifying-glass" />
              </button>
            </form>
          )}
        </div>
      </div>

      <div className={`main-navbar navbar-desktop d-print-none${scrolled ? ' fixed_nav is-sticky' : ''}`}>
        <div className="container">
          <div className="navbar-area d-flex align-items-center">
            <div className={`big-nav-logo${scrolled ? ' show' : ''}`}>
              <BrandLogoLink className="logo" />
            </div>
            <ul className="navbar-links-area hide-scrollbar" ref={navRailRef}>
              <li className="nav-item nav-home">
                <NavLink
                  to="/"
                  end
                  aria-label={t.home}
                  title={t.home}
                  className={({ isActive }) => `nav-link animated${isActive ? ' active' : ''}`}
                >
                  <i className="fa-solid fa-house" aria-hidden="true" />
                </NavLink>
              </li>
              {navCats.map(renderCatItem)}
              <li
                ref={moreRef}
                className={`nav-item has-sub nav-more${hiddenCats.length ? '' : ' is-idle'}${moreOpen ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="nav-link animated border-0 bg-transparent"
                  aria-expanded={moreOpen}
                  aria-haspopup="true"
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  {t.more}
                  <i className="fa-solid fa-chevron-down ms-1 sub-caret" />
                </button>
                <ul className="nav-submenu nav-more-menu">
                  {hiddenCats.map((cat) => {
                    const catSubs = subMap[cat._id] || []
                    return (
                      <li key={cat._id}>
                        <Link to={`/category/${cat.slug}`} onClick={() => setMoreOpen(false)}>
                          {text(cat.name, cat.nameEn)}
                        </Link>
                        {catSubs.map((s) => (
                          <Link
                            key={s._id}
                            className="nav-more-sub"
                            to={`/category/${cat.slug}?sub=${s.slug}`}
                            onClick={() => setMoreOpen(false)}
                          >
                            {text(s.nameBn, s.nameEn)}
                          </Link>
                        ))}
                      </li>
                    )
                  })}
                </ul>
              </li>
              <li className="nav-item nav-mega">
                <button
                  type="button"
                  className={`nav-link border-0 bg-transparent${megaOpen ? ' active' : ''}`}
                  onClick={() => setMegaOpen((v) => !v)}
                  aria-expanded={megaOpen}
                  aria-label={t.menu}
                >
                  <i className="fa-solid fa-bars" />
                </button>
              </li>
            </ul>
          </div>
        </div>

        {megaOpen && (
          <div className="kk-mega-desktop">
            <div className="container">
              <div className="kk-mega-panel" role="dialog" aria-label={t.categories}>
                  {navCats.map((cat) => (
                    <div key={cat._id} className="kk-mega-col">
                      <Link to={`/category/${cat.slug}`} className="kk-mega-heading" onClick={closeMenus}>
                        {text(cat.name, cat.nameEn)}
                      </Link>
                      <ul>
                        {(subMap[cat._id] || []).map((s) => (
                          <li key={s._id}>
                            <Link to={`/category/${cat.slug}?sub=${s.slug}`} onClick={closeMenus}>
                              {text(s.nameBn, s.nameEn)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        )}
      </div>

      {megaOpen && (
        <div className="kk-drawer-overlay" onClick={closeMenus}>
          <aside className="kk-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="kk-drawer-head">
              <span>{displayDate}</span>
              <button type="button" className="close-mb-nav border-0" onClick={closeMenus} aria-label="Close">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <nav className="kk-drawer-nav">
              <NavLink to="/" end className="kk-drawer-link" onClick={closeMenus}>
                <i className="fa-solid fa-house me-2" />
                {t.home}
              </NavLink>
              {navCats.map((cat) => {
                const catSubs = subMap[cat._id] || []
                const expanded = openAcc === cat._id
                if (!catSubs.length) {
                  return (
                    <Link
                      key={cat._id}
                      to={`/category/${cat.slug}`}
                      className="kk-drawer-link"
                      onClick={closeMenus}
                    >
                      {text(cat.name, cat.nameEn)}
                    </Link>
                  )
                }
                return (
                  <div key={cat._id} className={`kk-acc${expanded ? ' is-open' : ''}`}>
                    <div className="kk-acc-row">
                      <Link to={`/category/${cat.slug}`} className="kk-drawer-link" onClick={closeMenus}>
                        {text(cat.name, cat.nameEn)}
                      </Link>
                      <button
                        type="button"
                        className="kk-acc-toggle"
                        aria-expanded={expanded}
                        onClick={() => setOpenAcc(expanded ? null : cat._id)}
                      >
                        <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                      </button>
                    </div>
                    {expanded && (
                      <ul className="kk-acc-sub">
                        {catSubs.map((s) => (
                          <li key={s._id}>
                            <Link to={`/category/${cat.slug}?sub=${s.slug}`} onClick={closeMenus}>
                              {text(s.nameBn, s.nameEn)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
              {user ? (
                <div className="kk-drawer-link d-flex justify-content-between align-items-center">
                  <span className="text-truncate me-2">
                    <i className="fa-solid fa-circle-user me-2" />
                    {user.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger py-0 px-2"
                    onClick={() => {
                      closeMenus()
                      logout()
                    }}
                  >
                    {isEn ? 'Log Out' : 'লগআউট'}
                  </button>
                </div>
              ) : (
                <Link to="/login" className="kk-drawer-link" onClick={closeMenus}>
                  {t.login}
                </Link>
              )}
            </nav>
          </aside>
        </div>
      )}
    </header>
  )
}

export function TopBar() {
  return null
}
export function BrandHeader() {
  return null
}
export function MainNav() {
  return null
}
