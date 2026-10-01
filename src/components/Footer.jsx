import { Link } from 'react-router-dom'
import { useSiteData } from '../context/SiteDataContext'
import { useLang } from '../context/LanguageContext'
import { BrandLogo } from './BrandLogo'

export default function Footer() {
  const { contentCategories, settings, websites, staff } = useSiteData()
  const { t, text } = useLang()
  const categories = contentCategories || []

  const footerStyle = {
    backgroundColor: '#0a101d',
    color: '#a0aec0',
    paddingTop: '3rem',
    paddingBottom: '1rem',
    borderTop: '4px solid var(--bs-primary)'
  }

  const linkStyle = { color: '#e2e8f0', textDecoration: 'none', transition: '0.2s ease' }
  const titleStyle = { color: '#ffffff', fontWeight: 600, fontSize: '1.1rem', marginBottom: '1.25rem', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', display: 'inline-block' }

  return (
    <>
      <footer className="footer-desktop mt-5" style={footerStyle}>
        <div className="container">
          <div className="row gy-4">
            {/* Branding Column */}
            <div className="col-lg-4 col-md-6 pr-lg-4">
              <div className="mb-3">
                <BrandLogo className="footer-logo" />
              </div>
              <p style={{ lineHeight: '1.6', fontSize: '0.95rem' }}>
                {text(
                  settings?.aboutUs ||
                    'কৃষিকাগজ — বাংলাদেশের নির্ভরযোগ্য কৃষি সংবাদ। ফসল, প্রাণিসম্পদ, মৎস্য, কৃষি প্রযুক্তি ও কৃষকের কথা সবার আগে মানুষের কাছে পৌঁছে দিতে আমরা অঙ্গীকারবদ্ধ।',
                  settings?.aboutUsEn,
                )}
              </p>
              <div className="d-flex gap-3 mt-3">
                {settings?.facebookPage && (
                  <a href={settings.facebookPage} target="_blank" rel="noreferrer" style={{ color: '#a0aec0', fontSize: '1.25rem' }}><i className="fa-brands fa-facebook" /></a>
                )}
                {/* Social Placeholders if needed */}
                <a href="#" style={{ color: '#a0aec0', fontSize: '1.25rem' }}><i className="fa-brands fa-twitter" /></a>
                <a href="#" style={{ color: '#a0aec0', fontSize: '1.25rem' }}><i className="fa-brands fa-youtube" /></a>
              </div>
            </div>

            {/* Categories & Links */}
            <div className="col-lg-2 col-md-6">
              <h4 style={titleStyle}>{t.categories}</h4>
              <ul className="list-unstyled" style={{ lineHeight: '2' }}>
                {categories.slice(0, 6).map((c) => (
                  <li key={c._id}>
                    <Link to={`/category/${c.slug}`} style={linkStyle} onMouseOver={(e) => e.target.style.color = 'var(--bs-primary)'} onMouseOut={(e) => e.target.style.color = '#e2e8f0'}>{text(c.name, c.nameEn)}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Editorial Team */}
            {(staff?.length > 0 || websites?.length > 0) && (
              <div className="col-lg-3 col-md-6">
                <h4 style={titleStyle}>{t.importantLinks}</h4>
                <ul className="list-unstyled" style={{ lineHeight: '2' }}>
                  {websites?.slice(0, 4).map((w) => (
                    <li key={w._id}>
                      <a href={w.websiteLink} target="_blank" rel="noreferrer" style={linkStyle} onMouseOver={(e) => e.target.style.color = 'var(--bs-primary)'} onMouseOut={(e) => e.target.style.color = '#e2e8f0'}>
                        {w.websiteName}
                      </a>
                    </li>
                  ))}
                  {staff?.slice(0, 3).map((s) => (
                    <li key={s._id}>
                      <span style={{ color: '#e2e8f0' }}>{s.name}</span> <small style={{ color: '#718096' }}>({s.designation})</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contact Info */}
            <div className="col-lg-3 col-md-6">
              <h4 style={titleStyle}>{t.contact}</h4>
              <address style={{ fontStyle: 'normal', lineHeight: '1.8', fontSize: '0.95rem' }}>
                <div className="d-flex align-items-start mb-2">
                  <i className="fa-solid fa-location-dot mt-1 me-2" style={{ color: 'var(--bs-primary)' }} />
                  <span>{text(settings?.addressBn || 'ঢাকা, বাংলাদেশ', settings?.addressEn)}</span>
                </div>
                <div className="d-flex align-items-center mb-2">
                  <i className="fa-solid fa-phone me-2" style={{ color: 'var(--bs-primary)' }} />
                  <span>{text(settings?.phoneBn || settings?.hotline || '১৬১২৩', settings?.phoneEn)}</span>
                </div>
                <div className="d-flex align-items-center mb-3">
                  <i className="fa-solid fa-envelope me-2" style={{ color: 'var(--bs-primary)' }} />
                  <span>{settings?.email || 'info@krishikagoj.com'}</span>
                </div>
                <div className="pt-2 border-top" style={{ borderColor: 'rgba(255,255,255,0.05) !important' }}>
                  <small className="d-block mb-1"><strong>{t.chiefAdvisor}</strong> {settings?.chiefAdvisor || '—'}</small>
                  <small className="d-block mb-1"><strong>{t.publisher}</strong> {settings?.publisher || '—'}</small>
                  <small className="d-block mb-1"><strong>{t.editor}</strong> {settings?.managingEditor || '—'}</small>
                </div>
              </address>
            </div>
          </div>
        </div>

        <div className="container mt-4 pt-3 border-top text-center" style={{ borderColor: 'rgba(255,255,255,0.1) !important' }}>
          <p className="mb-0 small text-uppercase" style={{ letterSpacing: '0.5px' }}>
            © {new Date().getFullYear()} {t.allRightsReserved} <span style={{ color: 'var(--bs-primary)', fontWeight: 'bold' }}>{settings?.siteName || 'কৃষিকাগজ'}</span> | {t.unauthorizedCopying}
          </p>
        </div>
      </footer>

      {/* Mobile Footer */}
      <footer className="footer-mobile d-lg-none mt-4" style={{ backgroundColor: '#0a101d', color: '#a0aec0', paddingTop: '2rem', paddingBottom: '1.5rem', borderTop: '4px solid var(--bs-primary)' }}>
        <div className="container">
          {/* Section 1: Branding, Description, Socials */}
          <div className="mb-4">
            <div className="mb-3">
              <BrandLogo className="footer-logo" />
            </div>
            <p style={{ lineHeight: '1.6', fontSize: '0.92rem', color: '#a0aec0', marginBottom: '1rem', wordBreak: 'break-word' }}>
              {text(
                settings?.aboutUs ||
                  'কৃষিকাগজ — বাংলাদেশের নির্ভরযোগ্য কৃষি সংবাদ। ফসল, প্রাণিসম্পদ, মৎস্য, কৃষি প্রযুক্তি ও কৃষকের কথা সবার আগে মানুষের কাছে পৌঁছে দিতে আমরা অঙ্গীকারবদ্ধ।',
                settings?.aboutUsEn,
              )}
            </p>
            <div className="d-flex gap-3 mt-2">
              <a href={settings?.facebookPage || '#'} target={settings?.facebookPage ? '_blank' : undefined} rel="noreferrer" style={{ color: '#a0aec0', fontSize: '1.25rem' }} aria-label="Facebook">
                <i className="fa-brands fa-facebook" />
              </a>
              <a href={settings?.twitterPage || '#'} target={settings?.twitterPage ? '_blank' : undefined} rel="noreferrer" style={{ color: '#a0aec0', fontSize: '1.25rem' }} aria-label="Twitter">
                <i className="fa-brands fa-twitter" />
              </a>
              <a href={settings?.youtubePage || '#'} target={settings?.youtubePage ? '_blank' : undefined} rel="noreferrer" style={{ color: '#a0aec0', fontSize: '1.25rem' }} aria-label="YouTube">
                <i className="fa-brands fa-youtube" />
              </a>
            </div>
          </div>

          {/* Section 2: Contact & Editorial Info */}
          <div className="mb-3">
            <h4 style={titleStyle}>{t.contact}</h4>
            <address style={{ fontStyle: 'normal', lineHeight: '1.8', fontSize: '0.92rem' }}>
              <div className="d-flex align-items-start mb-2">
                <i className="fa-solid fa-location-dot mt-1 me-2" style={{ color: 'var(--bs-primary)' }} />
                <span>{text(settings?.addressBn || 'ঢাকা, বাংলাদেশ', settings?.addressEn)}</span>
              </div>
              <div className="d-flex align-items-center mb-2">
                <i className="fa-solid fa-phone me-2" style={{ color: 'var(--bs-primary)' }} />
                <span>{text(settings?.phoneBn || settings?.hotline || '১৬১২৩', settings?.phoneEn)}</span>
              </div>
              <div className="d-flex align-items-center mb-3">
                <i className="fa-solid fa-envelope me-2" style={{ color: 'var(--bs-primary)' }} />
                <span style={{ wordBreak: 'break-all' }}>{settings?.email || 'info@krishikagoj.com'}</span>
              </div>
              <div className="pt-2 border-top" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <small className="d-block mb-1"><strong>{t.chiefAdvisor}</strong> {settings?.chiefAdvisor || '—'}</small>
                <small className="d-block mb-1"><strong>{t.publisher}</strong> {settings?.publisher || '—'}</small>
                <small className="d-block mb-1"><strong>{t.editor}</strong> {settings?.managingEditor || '—'}</small>
              </div>
            </address>
          </div>

          {/* Section 3: Quick Category links */}
          {categories.length > 0 && (
            <div className="d-flex flex-wrap gap-2 pt-2 mb-3">
              {categories.slice(0, 4).map((c) => (
                <Link key={c._id} to={`/category/${c.slug}`} className="small" style={{ color: '#e2e8f0', textDecoration: 'none', borderRight: '1px solid #2d3748', paddingRight: '0.5rem' }}>
                  {text(c.name, c.nameEn)}
                </Link>
              ))}
            </div>
          )}

          {/* Section 4: Copyright & Bottom Text */}
          <div className="pt-3 border-top text-center" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <p className="mb-0 small text-uppercase" style={{ letterSpacing: '0.5px', lineHeight: '1.5' }}>
              © {new Date().getFullYear()} {t.allRightsReserved} <span style={{ color: 'var(--bs-primary)', fontWeight: 'bold' }}>{settings?.siteName || 'কৃষিকাগজ'}</span> | {t.unauthorizedCopying}
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
