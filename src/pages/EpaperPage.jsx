import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSiteData } from '../context/SiteDataContext'
import { useLang } from '../context/LanguageContext'
import { BrandLogo } from '../components/BrandLogo'
import SafeImage from '../components/SafeImage'
import SeoHead from '../components/SeoHead'

const DHAKA_TZ = 'Asia/Dhaka'

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
function toBnNum(num) {
  return String(num).replace(/[0-9]/g, (d) => BN_DIGITS[d])
}

export default function EpaperPage() {
  const { headlines = [], featured = [], latest = [], popular = [], recent = [], settings = {} } = useSiteData()
  const { t, text, isEn } = useLang()
  const [activePage, setActivePage] = useState(1)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [zoomLevel, setZoomLevel] = useState(100)

  // Combine and organize articles into 4 virtual newspaper pages
  const allArticles = useMemo(() => {
    const map = new Map()
    ;[...headlines, ...featured, ...latest, ...popular, ...recent].forEach((a) => {
      if (a && a.id && !map.has(a.id)) {
        map.set(a.id, a)
      }
    })
    return Array.from(map.values())
  }, [headlines, featured, latest, popular, recent])

  const pagesData = useMemo(() => {
    const p1 = allArticles.slice(0, 6)
    const p2 = allArticles.slice(6, 12)
    const p3 = allArticles.slice(12, 18)
    const p4 = allArticles.slice(18, 24)
    return [
      { pageNumber: 1, title: isEn ? 'Main News / Front Page' : 'প্রথম পাতা — প্রধান খবর', articles: p1.length ? p1 : allArticles.slice(0, 4) },
      { pageNumber: 2, title: isEn ? 'National & Admin' : 'দ্বিতীয় পাতা — প্রশাসন ও জাতীয়', articles: p2.length ? p2 : allArticles.slice(2, 6) },
      { pageNumber: 3, title: isEn ? 'Agriculture & Research' : 'তৃতীয় পাতা — প্রযুক্তি ও গবেষণা', articles: p3.length ? p3 : allArticles.slice(4, 8) },
      { pageNumber: 4, title: isEn ? 'Farming & Business' : 'চতুর্থ পাতা — ফসল, প্রাণিসম্পদ ও বাণিজ্য', articles: p4.length ? p4 : allArticles.slice(0, 4) },
    ]
  }, [allArticles, isEn])

  const currentPage = pagesData[activePage - 1] || pagesData[0]
  const totalPages = pagesData.length

  const todayDateStr = new Intl.DateTimeFormat(isEn ? 'en-GB' : 'bn-BD', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: DHAKA_TZ,
  }).format(new Date(selectedDate || Date.now()))

  const leadItem = currentPage.articles[0]
  const gridItems = currentPage.articles.slice(1)

  return (
    <div className="epaper-wrapper">
      <SeoHead title={isEn ? 'E-Paper | Krishikagoj' : 'ই-পেপার | কৃষিকাগজ'} />

      {/* Top Banner Row */}
      <div className="epaper-topbar">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="epaper-badge-title">
            <span className="badge bg-danger px-3 py-2 text-uppercase fw-bold">
              {isEn ? 'Online Version' : 'অনলাইন ভার্সন'}
            </span>
          </div>
          <div className="epaper-social-links d-flex gap-2">
            {settings?.youtubePage && (
              <a href={settings.youtubePage} target="_blank" rel="noreferrer" className="epaper-soc-icon youtube" aria-label="YouTube">
                <i className="fa-brands fa-youtube" />
              </a>
            )}
            {settings?.twitterPage && (
              <a href={settings.twitterPage} target="_blank" rel="noreferrer" className="epaper-soc-icon twitter" aria-label="Twitter">
                <i className="fa-brands fa-twitter" />
              </a>
            )}
            {settings?.facebookPage && (
              <a href={settings.facebookPage} target="_blank" rel="noreferrer" className="epaper-soc-icon facebook" aria-label="Facebook">
                <i className="fa-brands fa-facebook" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Main Newspaper Masthead */}
      <div className="epaper-header py-3 bg-white border-bottom">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-md-5">
              <Link to="/" className="d-inline-block">
                <BrandLogo className="epaper-logo" />
              </Link>
              <div className="epaper-date text-muted mt-1 small">
                <i className="fa-regular fa-calendar-days me-1" /> {todayDateStr}
              </div>
            </div>
            <div className="col-md-7 text-md-end mt-2 mt-md-0">
              <div className="epaper-slogan text-muted small fst-italic">
                {text(
                  settings?.aboutUs || 'কৃষিকাগজ — বাংলাদেশের শীর্ষ ও নির্ভরযোগ্য কৃষি সংবাদমাধ্যম',
                  settings?.aboutUsEn,
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar / Controls */}
      <div className="epaper-toolbar py-2 bg-light border-bottom sticky-top" style={{ zIndex: 100 }}>
        <div className="container">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            {/* Left: Date selector */}
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-danger fw-bold"
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              >
                <i className="fa-solid fa-calendar-check me-1" />
                {isEn ? 'Today Edition' : 'আজকের পত্রিকা'}
              </button>
              <div className="input-group input-group-sm" style={{ width: '160px' }}>
                <input
                  type="date"
                  className="form-control"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  aria-label="Select Edition Date"
                />
              </div>
            </div>

            {/* Center: Pagination */}
            <div className="d-flex align-items-center gap-1">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={activePage <= 1}
                onClick={() => setActivePage(1)}
              >
                {isEn ? 'First' : 'শুরু'}
              </button>
              {pagesData.map((p) => (
                <button
                  key={p.pageNumber}
                  type="button"
                  className={`btn btn-sm ${activePage === p.pageNumber ? 'btn-danger' : 'btn-outline-secondary'}`}
                  onClick={() => setActivePage(p.pageNumber)}
                >
                  {isEn ? p.pageNumber : toBnNum(p.pageNumber)}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={activePage >= totalPages}
                onClick={() => setActivePage((prev) => Math.min(totalPages, prev + 1))}
              >
                {isEn ? 'Next' : 'পরের'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={activePage >= totalPages}
                onClick={() => setActivePage(totalPages)}
              >
                {isEn ? 'Last' : 'শেষ'}
              </button>
            </div>

            {/* Right: Zoom / Actions */}
            <div className="d-flex align-items-center gap-2">
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className="btn btn-outline-dark"
                  onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
                  title="Zoom Out"
                >
                  <i className="fa-solid fa-magnifying-glass-minus" />
                </button>
                <button
                  type="button"
                  className="btn btn-outline-dark"
                  onClick={() => setZoomLevel(100)}
                  title="Reset Zoom"
                >
                  {zoomLevel}%
                </button>
                <button
                  type="button"
                  className="btn btn-outline-dark"
                  onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
                  title="Zoom In"
                >
                  <i className="fa-solid fa-magnifying-glass-plus" />
                </button>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary d-none d-md-inline-flex align-items-center"
                onClick={() => window.print()}
              >
                <i className="fa-solid fa-print me-1" /> {isEn ? 'Print' : 'প্রিন্ট'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main E-Paper Layout */}
      <div className="container py-4">
        <div className="row g-4">
          {/* Left: Thumbnail Sidebar (সকল পাতা) */}
          <div className="col-lg-3 col-md-4">
            <div className="epaper-sidebar card shadow-sm p-3 sticky-top" style={{ top: '120px' }}>
              <h5 className="border-bottom pb-2 mb-3 fw-bold text-dark d-flex align-items-center justify-content-between">
                <span><i className="fa-solid fa-layer-group text-danger me-2" />{isEn ? 'All Pages' : 'সকল পাতা'}</span>
                <span className="badge bg-secondary">{isEn ? `Page ${activePage} of ${totalPages}` : `${toBnNum(activePage)} / ${toBnNum(totalPages)} পাতা`}</span>
              </h5>
              <div className="epaper-thumb-list d-flex flex-column gap-3">
                {pagesData.map((p) => (
                  <div
                    key={p.pageNumber}
                    className={`epaper-thumb-card p-2 border rounded ${activePage === p.pageNumber ? 'border-danger bg-light shadow-sm' : 'bg-white'}`}
                    style={{ cursor: 'pointer', transition: '0.2s' }}
                    onClick={() => setActivePage(p.pageNumber)}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <strong className="text-danger small">
                        {isEn ? `Page ${p.pageNumber}` : `পাতা ${toBnNum(p.pageNumber)}`}
                      </strong>
                      <small className="text-muted">{p.articles.length} {isEn ? 'stories' : 'সংবাদ'}</small>
                    </div>
                    <div className="epaper-thumb-preview bg-white border p-1 rounded text-center small text-truncate">
                      {p.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Main Newspaper Spread */}
          <div className="col-lg-9 col-md-8">
            <div
              className="epaper-sheet bg-white border shadow-sm p-4 rounded"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}
            >
              <div className="epaper-sheet-header border-bottom pb-3 mb-4 text-center">
                <h3 className="fw-bold mb-1">{currentPage.title}</h3>
                <div className="text-muted small">
                  {settings?.siteName || 'কৃষিকাগজ'} • {todayDateStr} • {isEn ? `Page ${activePage}` : `পাতা ${toBnNum(activePage)}`}
                </div>
              </div>

              {/* Lead Story */}
              {leadItem && (
                <div className="epaper-lead-card card mb-4 border-0 border-bottom pb-4">
                  <div className="row g-3 align-items-center">
                    {leadItem.image && (
                      <div className="col-md-7">
                        <Link to={leadItem.path || `/news/${leadItem.slug || leadItem.id}`}>
                          <div className="img-zoom-hover rounded overflow-hidden">
                            <SafeImage src={leadItem.image} alt={text(leadItem.title, leadItem.titleEn)} className="img-fluid w-100" />
                          </div>
                        </Link>
                      </div>
                    )}
                    <div className={leadItem.image ? 'col-md-5' : 'col-12'}>
                      {leadItem.categoryName && (
                        <span className="badge bg-success mb-2">
                          {text(leadItem.categoryName, leadItem.categoryNameEn)}
                        </span>
                      )}
                      <h4 className="fw-bold mb-2">
                        <Link to={leadItem.path || `/news/${leadItem.slug || leadItem.id}`} className="text-dark text-decoration-none hover-primary">
                          {text(leadItem.title, leadItem.titleEn)}
                        </Link>
                      </h4>
                      <p className="text-muted small mb-3" style={{ lineHeight: '1.7' }}>
                        {text(leadItem.excerpt || leadItem.metaDescription, leadItem.excerptEn || leadItem.metaDescription) ||
                          (leadItem.body ? String(leadItem.body).replace(/<[^>]+>/g, ' ').slice(0, 180) + '...' : '')}
                      </p>
                      <Link to={leadItem.path || `/news/${leadItem.slug || leadItem.id}`} className="btn btn-sm btn-outline-danger">
                        {isEn ? 'Read Full Story' : 'সম্পূর্ণ সংবাদ পড়ুন'} <i className="fa-solid fa-arrow-right ms-1" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* News Grid on Current Page */}
              <div className="row g-4">
                {gridItems.map((item) => (
                  <div key={item.id} className="col-md-6">
                    <article className="card h-100 border p-3 rounded shadow-xs hover-card">
                      {item.image && (
                        <div className="img-zoom-hover rounded mb-2 overflow-hidden" style={{ aspectRatio: '16/10' }}>
                          <SafeImage src={item.image} alt={text(item.title, item.titleEn)} className="img-fluid w-100 h-100 object-fit-cover" />
                        </div>
                      )}
                      <h5 className="fw-bold fs-6 mb-2">
                        <Link to={item.path || `/news/${item.slug || item.id}`} className="text-dark text-decoration-none hover-primary">
                          {text(item.title, item.titleEn)}
                        </Link>
                      </h5>
                      <p className="text-secondary small mb-2 flex-grow-1" style={{ lineHeight: '1.6' }}>
                        {text(item.excerpt || item.metaDescription, item.excerptEn || item.metaDescription) ||
                          (item.body ? String(item.body).replace(/<[^>]+>/g, ' ').slice(0, 120) + '...' : '')}
                      </p>
                      <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                        <small className="text-muted">
                          <i className="fa-regular fa-clock me-1" />
                          {item.date || todayDateStr}
                        </small>
                        <Link to={item.path || `/news/${item.slug || item.id}`} className="btn btn-sm btn-link p-0 text-decoration-none fw-bold text-success">
                          {isEn ? 'Read More' : 'বিস্তারিত'} →
                        </Link>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
