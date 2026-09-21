import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, formatBnDate, formatBnTime, mapArticle, getPublicShareUrl } from '../api/client'
import Sidebar from '../components/Sidebar'
import SafeImage from '../components/SafeImage'
import SeoHead from '../components/SeoHead'
import AdSlider from '../components/AdSlider'
import { BrandLogo } from '../components/BrandLogo'
import { useSiteData } from '../context/SiteDataContext'
import { useLang } from '../context/LanguageContext'
import { cleanArticleHtml } from '../utils/cleanArticleHtml'

const CANDIDATE_BATCH = 10
const MIN_FONT = 15
const MAX_FONT = 26
const DEFAULT_FONT = 18

const MEDIA_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
  : ''

function mediaUrl(img) {
  if (!img) return ''
  const src = String(img)
  if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('/')) return src
  return `${MEDIA_BASE}${src.startsWith('/') ? src : `/${src}`}`
}

function PostMeta({ article, authorName }) {
  const { t, lang, text } = useLang()
  const time = formatBnTime(article.publishedAt, lang)
  const dateStr = formatBnDate(article.publishedAt, lang)
  const published = [dateStr, time].filter(Boolean).join(' ')
  const authorLabel = text(authorName, authorName === 'কৃষি ডেস্ক' ? 'Krishi Desk' : authorName)

  return (
    <div className="kk-post-meta-inline">
      {authorLabel ? (
        <div className="kk-journalist">
          <i className="fa-solid fa-circle-user" aria-hidden="true" />
          <span>{authorLabel}</span>
        </div>
      ) : null}
      {published ? (
        <div className="kk-publish">
          <i className="fa-regular fa-clock" aria-hidden="true" />
          <span>{t.publishedOn} {published}</span>
        </div>
      ) : null}
    </div>
  )
}

function ShareRow({ url, title, textSnippet, image, onFontChange }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  const [isShareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    if (!isShareOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') setShareOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isShareOpen])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked */
    }
  }

  function popup(target) {
    window.open(target, 'Share This Post', 'width=640,height=450')
  }

  async function handleMainShare() {
    const isMobile =
      typeof navigator !== 'undefined' &&
      typeof window !== 'undefined' &&
      Boolean(navigator.share) &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(
        navigator.userAgent,
      ) ||
        window.matchMedia('(max-width: 991.98px)').matches ||
        navigator.maxTouchPoints > 1)

    if (isMobile && navigator.share) {
      try {
        const shareData = {
          title: title || '',
          url: url || (typeof window !== 'undefined' ? window.location.href : ''),
        }
        await navigator.share(shareData)
        return
      } catch (err) {
        if (err && err.name === 'AbortError') return
      }
    }
    // Desktop / Laptop or fallback
    setShareOpen(true)
  }

  return (
    <div className="kk-share-row">
      <div className="kk-share-icons">
        <button
          type="button"
          className="kk-share-btn kk-share-fb"
          aria-label="Facebook"
          onClick={() =>
            popup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)
          }
        >
          <i className="fa-brands fa-facebook-f" />
        </button>
        <button
          type="button"
          className="kk-share-btn kk-share-x"
          aria-label="X"
          onClick={() =>
            popup(
              `https://twitter.com/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
            )
          }
        >
          <i className="fa-brands fa-x-twitter" />
        </button>
        <button
          type="button"
          className="kk-share-btn kk-share-li"
          aria-label="LinkedIn"
          onClick={() =>
            popup(`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}`)
          }
        >
          <i className="fa-brands fa-linkedin-in" />
        </button>
        <a
          className="kk-share-btn kk-share-wa"
          aria-label="WhatsApp"
          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noreferrer"
        >
          <i className="fa-brands fa-whatsapp" />
        </a>
        <button
          type="button"
          className="kk-share-btn kk-share-copy"
          aria-label={t.copyLink}
          title={t.copyLink}
          onClick={copyLink}
        >
          <i className={copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'} />
        </button>
        <button
          type="button"
          className="kk-share-btn kk-share-print"
          aria-label={t.print}
          title={t.print}
          onClick={() => window.print()}
        >
          <i className="fa-solid fa-print" />
        </button>
        <button
          type="button"
          className="kk-share-btn kk-share-main"
          aria-label={t.share}
          title={t.share}
          onClick={handleMainShare}
        >
          <i className="fa-solid fa-share" />
        </button>
        {copied && <span className="kk-copied">{t.copied}</span>}
      </div>
      <div className="kk-font-btns">
        <button type="button" onClick={() => onFontChange(1)} aria-label={t.fontBigger} title={t.fontBigger}>
          A+
        </button>
        <button type="button" onClick={() => onFontChange(-1)} aria-label={t.fontSmaller} title={t.fontSmaller}>
          A-
        </button>
      </div>

      {isShareOpen && (
        <div className="kk-share-modal-backdrop" onClick={() => setShareOpen(false)}>
          <div
            className="kk-share-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t.share}
          >
            <div className="kk-share-modal-header">
              <h4 className="kk-share-modal-title">{t.share}</h4>
              <button
                type="button"
                className="kk-share-modal-close"
                onClick={() => setShareOpen(false)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="kk-share-modal-grid">
              {/* Facebook */}
              <button
                type="button"
                className="kk-share-option"
                onClick={() => {
                  popup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)
                  setShareOpen(false)
                }}
              >
                <span className="kk-share-opt-icon kk-share-opt-fb">
                  <i className="fa-brands fa-facebook-f" />
                </span>
                <span className="kk-share-opt-label">{t.shareFacebook}</span>
              </button>

              {/* LinkedIn */}
              <button
                type="button"
                className="kk-share-option"
                onClick={() => {
                  popup(
                    `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
                  )
                  setShareOpen(false)
                }}
              >
                <span className="kk-share-opt-icon kk-share-opt-li">
                  <i className="fa-brands fa-linkedin-in" />
                </span>
                <span className="kk-share-opt-label">{t.shareLinkedin}</span>
              </button>

              {/* Email */}
              <a
                className="kk-share-option"
                href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`}
                onClick={() => setShareOpen(false)}
              >
                <span className="kk-share-opt-icon kk-share-opt-email">
                  <i className="fa-solid fa-envelope" />
                </span>
                <span className="kk-share-opt-label">{t.shareEmail}</span>
              </a>

              {/* Twitter / X */}
              <button
                type="button"
                className="kk-share-option"
                onClick={() => {
                  popup(
                    `https://twitter.com/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
                  )
                  setShareOpen(false)
                }}
              >
                <span className="kk-share-opt-icon kk-share-opt-x">
                  <i className="fa-brands fa-x-twitter" />
                </span>
                <span className="kk-share-opt-label">{t.shareTwitter}</span>
              </button>

              {/* Copy Link */}
              <button
                type="button"
                className="kk-share-option"
                onClick={() => {
                  copyLink()
                }}
              >
                <span className="kk-share-opt-icon kk-share-opt-copy">
                  <i className={copied ? 'fa-solid fa-check' : 'fa-solid fa-link'} />
                </span>
                <span className="kk-share-opt-label">
                  {copied ? t.linkCopied : t.copyNewsLink}
                </span>
              </button>

              {/* WhatsApp */}
              <a
                className="kk-share-option"
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShareOpen(false)}
              >
                <span className="kk-share-opt-icon kk-share-opt-wa">
                  <i className="fa-brands fa-whatsapp" />
                </span>
                <span className="kk-share-opt-label">{t.shareWhatsapp}</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ArticleLeftRail({ currentId }) {
  const { latest } = useSiteData()
  const { t, text, lang } = useLang()
  const items = (latest || []).filter((item) => item.id !== currentId).slice(0, 8)

  return (
    <aside className="kk-post-left">
      <div className="common-border-box">
        <div className="section-title-flex">
          <h3>{t.latest}</h3>
        </div>
        {items.map((item) => (
          <div className="news-list kk-left-item" key={item.id}>
            <Link to={item.path}>
              <div className="kk-left-item-row">
                <div className="kk-left-thumb">
                  <div className="img-zoom-hover">
                    <SafeImage src={item.image} alt={text(item.title, item.titleEn)} width={160} />
                  </div>
                </div>
                <div className="kk-left-text">
                  <h4 className="title">{text(item.title, item.titleEn)}</h4>
                  {item.publishedAt ? <span>{formatBnDate(item.publishedAt, lang)}</span> : null}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </aside>
  )
}

function ArticleBlock({ article, isFirst, onFontChange, fontSize = DEFAULT_FONT, ads }) {
  const { t, text, isEn } = useLang()
  const { settings } = useSiteData()
  const url = getPublicShareUrl(article.path, isEn ? 'en' : 'bn')
  const gallery = article.raw?.images || []
  const title = text(article.title, article.titleEn)
  const shortHeadline = text(article.excerpt, article.excerptEn)?.trim()
  const authorName = String(article.author || article.raw?.authorUser?.name || '').trim()
  const hasUploadedImage = Boolean(String(article.image || '').trim())
  const showImageInDetails = article.showImageInDetails !== false
  const defaultNewsImage = String(settings?.defaultNewsImage || '/placeholder-news.svg').trim()
  let detailsImage = ''
  if (hasUploadedImage && showImageInDetails) {
    detailsImage = article.image
  } else if (!hasUploadedImage) {
    detailsImage = defaultNewsImage
  }

  return (
    <section className={`kk-news-body${isFirst ? '' : ' kk-news-next'}`}>
      <div className="container">
        <div className="kk-post-grid">
          <ArticleLeftRail currentId={article.id} />
          <div className="kk-post-mid">
            <article className="kk-post-content">
              <ul className="news-details-breadcrumb">
                <li>
                  <Link to="/" aria-label={t.home}>
                    <i className="fa-solid fa-house" />
                  </Link>
                </li>
                {article.categoryName && (
                  <>
                    <li>/</li>
                    <li>
                      <Link to={`/category/${article.category}`}>
                        {text(article.categoryName, article.categoryNameEn)}
                      </Link>
                    </li>
                  </>
                )}
              </ul>
              {shortHeadline ? <h2 className="post-short-title">{shortHeadline}</h2> : null}
              <h1 className="post-title">{title}</h1>

              <PostMeta article={article} authorName={authorName} />

              <ShareRow
                url={url}
                title={title}
                textSnippet={shortHeadline || activeExcerpt}
                image={detailsImage}
                onFontChange={onFontChange}
              />

              {detailsImage ? (
                <figure className="news-heading-pic">
                  <SafeImage src={detailsImage} alt={title} width={900} priority={isFirst} />
                  {article.imageCaption ? (
                    <figcaption className="news-image-caption">
                      {article.imageCaption}
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}

              {isEn && !article.bodyEn && <p className="kk-lang-note">{t.noEnglish}</p>}

              <div
                className="entry-content"
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: cleanArticleHtml(text(article.body, article.bodyEn)) }}
              />

              {gallery.length > 0 && (
                <div className="kk-post-gallery">
                  <h4>{t.photoGallery}</h4>
                  <div className="kk-post-gallery-grid">
                    {gallery.map((img, i) => (
                      <a key={i} href={mediaUrl(img)} target="_blank" rel="noreferrer">
                        <SafeImage src={img} alt={`${title} ${i + 1}`} width={480} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="kk-print-footer">
                <div className="kk-print-divider" />
                <div className="kk-print-logo-wrap">
                  <BrandLogo className="kk-print-logo" />
                </div>
                <div className="kk-print-contact">
                  <div className="kk-print-contact-item">
                    <i className="fa-solid fa-phone" /> {text(settings?.phoneBn || settings?.hotline || '১৬১২৩', settings?.phoneEn)}
                  </div>
                  <div className="kk-print-contact-item">
                    <i className="fa-solid fa-envelope" /> {settings?.email || 'info@krishikagoj.com'}
                  </div>
                </div>
                <div className="kk-print-divider" />
              </div>

              <div className="kk-post-tail">
                <span>
                  <i className="fa-regular fa-eye" /> {article.views} {t.views}
                </span>
                {article.tags && <span className="kk-post-tags">{article.tags}</span>}
              </div>
            </article>
          </div>

          <aside className="kk-post-right">
            <div className="kk-ad-area">
              <AdSlider ads={ads} position="sidebar" variant="card" />
            </div>
            <div className="kk-ad-area">
              <AdSlider ads={ads} position="mid_b" variant="card" startOffset={1} />
            </div>
            <Sidebar compact />
          </aside>
        </div>
      </div>
    </section>
  )
}

export default function ArticlePage() {
  const { id } = useParams()
  const { settings, ads } = useSiteData()
  const { t, isEn, text } = useLang()
  const [article, setArticle] = useState(null)
  const [nextArticles, setNextArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [noMore, setNoMore] = useState(false)
  const [error, setError] = useState('')
  const [fontSize, setFontSize] = useState(DEFAULT_FONT)

  const shownIdsRef = useRef(new Set())
  const queueRef = useRef([])
  const phaseRef = useRef('same')
  const categoryRef = useRef('')
  const busyRef = useRef(false)
  const sentinelRef = useRef(null)

  const changeFont = useCallback((step) => {
    setFontSize((size) => Math.min(MAX_FONT, Math.max(MIN_FONT, size + step)))
  }, [])

  const fetchCandidates = useCallback(async () => {
    const params = {
      limit: CANDIDATE_BATCH,
      exclude: [...shownIdsRef.current].join(','),
    }
    if (categoryRef.current) {
      if (phaseRef.current === 'same') params.category = categoryRef.current
      else params.excludeCategory = categoryRef.current
    }
    const rows = await api.getArticles(params)
    return (rows || []).map(mapArticle).filter((a) => a.id && !shownIdsRef.current.has(a.id))
  }, [])

  const loadNextArticle = useCallback(async () => {
    if (busyRef.current || noMore) return
    busyRef.current = true
    setLoadingMore(true)

    try {
      for (let attempt = 0; attempt < 3 && !queueRef.current.length; attempt += 1) {
        const batch = await fetchCandidates()
        if (batch.length) {
          queueRef.current = batch
          break
        }
        if (phaseRef.current === 'same' && categoryRef.current) {
          phaseRef.current = 'other'
        } else {
          setNoMore(true)
          return
        }
      }

      const candidate = queueRef.current.shift()
      if (!candidate) {
        setNoMore(true)
        return
      }

      shownIdsRef.current.add(candidate.id)
      const detail = await api.getArticle(candidate.slug || candidate.id)
      setNextArticles((prev) => [...prev, mapArticle(detail)])
    } catch {
      /* the next scroll retries */
    } finally {
      busyRef.current = false
      setLoadingMore(false)
    }
  }, [fetchCandidates, noMore])

  useEffect(() => {
    let alive = true
    shownIdsRef.current = new Set()
    queueRef.current = []
    phaseRef.current = 'same'
    setNextArticles([])
    setNoMore(false)

    async function load() {
      try {
        setLoading(true)
        setError('')
        const data = await api.getArticle(id)
        if (!alive) return
        const mapped = mapArticle(data)
        setArticle(mapped)
        categoryRef.current = mapped.category || ''
        phaseRef.current = mapped.category ? 'same' : 'other'
        shownIdsRef.current.add(mapped.id)

        if (typeof window !== 'undefined' && mapped.path) {
          try {
            const currentPath = window.location.pathname
            if (currentPath !== mapped.path && decodeURIComponent(currentPath) !== mapped.path) {
              window.history.replaceState(null, '', mapped.path)
            }
          } catch {}
        }
      } catch (err) {
        if (alive) setError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    window.scrollTo(0, 0)
    return () => {
      alive = false
    }
  }, [id])

  // Automatically trigger backend translation when English mode is active and translation is missing
  useEffect(() => {
    if (!isEn || !article?.id) return
    if (article.bodyEn && article.titleEn) return

    let cancelled = false
    api.translateArticle({ idOrSlug: article.id })
      .then((res) => {
        if (cancelled || !res) return
        setArticle((prev) => {
          if (!prev || prev.id !== article.id) return prev
          return {
            ...prev,
            titleEn: res.titleEn || prev.titleEn,
            excerptEn: res.excerptEn || prev.excerptEn,
            bodyEn: res.bodyEn || prev.bodyEn,
          }
        })
      })
      .catch((err) => console.warn('Auto translation fetch failed:', err.message))

    return () => {
      cancelled = true
    }
  }, [isEn, article?.id, article?.bodyEn, article?.titleEn])

  // Also translate any feed articles if in English mode
  useEffect(() => {
    if (!isEn || !nextArticles.length) return
    nextArticles.forEach((item) => {
      if (!item.bodyEn && item.id) {
        api.translateArticle({ idOrSlug: item.id })
          .then((res) => {
            if (!res) return
            setNextArticles((prev) =>
              prev.map((a) => (a.id === item.id ? { ...a, titleEn: res.titleEn || a.titleEn, excerptEn: res.excerptEn || a.excerptEn, bodyEn: res.bodyEn || a.bodyEn } : a)),
            )
          })
          .catch(() => {})
      }
    })
  }, [isEn, nextArticles])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || loading || noMore) return undefined

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadNextArticle()
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loading, noMore, loadNextArticle, nextArticles.length])

  if (loading) return <div className="container eb-loading">{t.loading}</div>

  if (error || !article) {
    return (
      <div className="container py-5 text-center">
        <p>{error || t.articleNotFound}</p>
        <Link to="/">{t.returnHome}</Link>
      </div>
    )
  }

  const siteName = isEn
    ? (settings?.siteNameEn || 'Krishi Kagoj')
    : (settings?.siteName || 'কৃষিকাগজ')
  const activeTitle = text(article.title, article.titleEn)
  const activeExcerpt = text(article.excerpt, article.excerptEn)
  const desc = (isEn
    ? (activeExcerpt || article.metaDescription || '')
    : (article.metaDescription || activeExcerpt || ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  const keywords = [text(article.categoryName, article.categoryNameEn), article.tags, settings?.seo?.metaKeyword]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="kk-article-page" style={{ '--post-font': `${fontSize}px` }}>
      <SeoHead
        title={`${activeTitle} | ${siteName}`}
        description={desc || settings?.seo?.metaDescription || activeTitle}
        keywords={keywords}
        author={article.author || settings?.seo?.metaAuthor || siteName}
        image={article.image || settings?.seo?.ogImage || settings?.logo}
        type="article"
        siteName={siteName}
        canonical={getPublicShareUrl(article.path, isEn ? 'en' : 'bn')}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: activeTitle,
          description: desc || activeTitle,
          image: article.image ? [article.image] : undefined,
          datePublished: article.publishedAt,
          author: { '@type': 'Person', name: article.author || siteName },
          publisher: {
            '@type': 'Organization',
            name: siteName,
            logo: { '@type': 'ImageObject', url: settings?.logo || '/logo.png' },
          },
          mainEntityOfPage: article.path,
          articleSection: text(article.categoryName, article.categoryNameEn) || undefined,
          keywords: keywords || undefined,
        }}
      />

      <ArticleBlock
        article={article}
        isFirst
        onFontChange={changeFont}
        fontSize={fontSize}
        ads={ads}
      />

      {nextArticles.map((next) => (
        <ArticleBlock
          key={next.id}
          article={next}
          onFontChange={changeFont}
          fontSize={fontSize}
          ads={ads}
        />
      ))}

      <div ref={sentinelRef} className="kk-feed-sentinel" aria-hidden="true" />
      <p className="kk-feed-status">
        {noMore
          ? t.noMoreArticles
          : loadingMore
            ? t.loadingNextArticle
            : t.scrollForMore}
      </p>
    </div>
  )
}
