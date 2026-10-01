import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import SafeImage from './SafeImage'
import { useLang } from '../context/LanguageContext'
import { useSiteData } from '../context/SiteDataContext'

/** 3 equal-height columns: left grid | mid list | news stories */
const GRID_COUNT = 6
const MID_COUNT = 6
const STORY_LIST_COUNT = 6

function NewsSm({ item, label }) {
  if (!item) return null
  return (
    <div className="news-sm">
      <Link to={item.path || `/news/${item.slug || item.id}`}>
        <div className="img-zoom-hover">
          <SafeImage src={item.image} alt={label} className="img-fluid" />
        </div>
        <h4 className="title">{label}</h4>
      </Link>
    </div>
  )
}

import { formatBnDate } from '../api/client'

function MidNewsRow({ item, label, lang }) {
  if (!item) return null
  const dateStr = item.publishedAt ? formatBnDate(item.publishedAt, lang) : item.date
  return (
    <article className="lead-mid-item">
      <Link to={item.path || `/news/${item.slug || item.id}`}>
        <div className="lead-mid-thumb img-zoom-hover">
          <SafeImage src={item.image} alt={label} className="img-fluid" />
        </div>
        <div className="lead-mid-body">
          <h4 className="title">{label}</h4>
          {dateStr ? (
            <span className="lead-mid-date">
              <i className="fa-regular fa-clock" /> {dateStr}
            </span>
          ) : null}
        </div>
      </Link>
    </article>
  )
}

function StoryListRow({ item, label, lang }) {
  if (!item) return null
  const dateStr = item.publishedAt ? formatBnDate(item.publishedAt, lang) : item.date
  return (
    <article className="lead-story-item">
      <Link to={item.path || `/news/${item.slug || item.id}`}>
        <div className="lead-story-thumb img-zoom-hover">
          <SafeImage src={item.image} alt={label} className="img-fluid" />
        </div>
        <div className="lead-story-body">
          <h4 className="title">{label}</h4>
          {dateStr ? (
            <span className="lead-story-date">
              <i className="fa-regular fa-clock" /> {dateStr}
            </span>
          ) : null}
        </div>
      </Link>
    </article>
  )
}

function articleKey(a) {
  return String(a?.id || a?._id || '')
}

function uniqueArticles(...groups) {
  const map = new Map()
  groups.flat(2).forEach((a) => {
    if (!a || typeof a !== 'object') return
    const id = articleKey(a)
    if (id && !map.has(id)) map.set(id, a)
  })
  return [...map.values()]
}

function take(pool, used, n) {
  const out = []
  for (const a of pool) {
    if (out.length >= n) break
    const id = articleKey(a)
    if (!id || used.has(id)) continue
    used.add(id)
    out.push(a)
  }
  return out
}

function fillPreferred(manualList, count, prefer, pool, used) {
  const out = []
  for (let i = 0; i < count; i++) {
    const m = prefer(manualList?.[i])
    if (m) out.push(m)
  }
  if (out.length < count) out.push(...take(pool, used, count - out.length))
  return out
}

function resolveSlots(leadLayout, featured, headlines, latest, popular, recent = []) {
  const pool = uniqueArticles(
    recent,
    featured,
    headlines,
    popular,
    latest,
    leadLayout?.lead,
    leadLayout?.grid,
    leadLayout?.mid,
    leadLayout?.story,
    leadLayout?.storyList,
  )

  const used = new Set()
  const prefer = (manual) => {
    const id = articleKey(manual)
    if (!id || used.has(id)) return null
    const found = pool.find((a) => articleKey(a) === id) || manual
    used.add(id)
    return found
  }

  const lead = prefer(leadLayout?.lead) || take(pool, used, 1)[0] || null
  const grid = fillPreferred(leadLayout?.grid, GRID_COUNT, prefer, pool, used)
  const mid = fillPreferred(leadLayout?.mid, MID_COUNT, prefer, pool, used)
  const story = prefer(leadLayout?.story) || take(pool, used, 1)[0] || null
  const storyList = fillPreferred(leadLayout?.storyList, STORY_LIST_COUNT, prefer, pool, used)

  return { lead, grid, mid, story, storyList }
}

export default function LeadSection({
  featured = [],
  headlines = [],
  latest = [],
  popular = [],
  recent = [],
  leadLayout = null,
}) {
  const { t, text, isEn, lang } = useLang()
  const { settings } = useSiteData()
  const slots = resolveSlots(leadLayout, featured, headlines, latest, popular, recent)
  if (!slots.lead && !slots.story && !slots.grid.length) return null
  const labelOf = (item) => (item ? text(item.title, item.titleEn) : '')
  const summaryOf = (item) => {
    if (!item) return ''
    const exc = text(item.excerpt, item.excerptEn)
    const body = text(item.body || item.metaDescription, item.bodyEn || item.metaDescription)
    let textStr = exc || ''
    if (body) {
      const plain = String(body).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (plain && (!textStr || textStr.trim().length < 120)) {
        textStr = textStr && !plain.startsWith(textStr) ? `${textStr} — ${plain}` : plain
      }
    }
    if (textStr) {
      const clean = textStr.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return clean.length > 320 ? clean.slice(0, 320) + '...' : clean
    }
    return exc || ''
  }

  const customStoryTitle = isEn
    ? (settings?.newsStoriesTitleEn || settings?.newsStandingTitle || settings?.newsStoriesTitle || settings?.newsStoriesTitleBn)
    : (settings?.newsStandingTitle || settings?.newsStoriesTitle || settings?.newsStoriesTitleBn)
  const storyTitle = (customStoryTitle && String(customStoryTitle).trim()) || t.newsStories || 'নিউজ স্টোরিজ'

  return (
    <section className="heading-section mt-4" id="top-lead-content">
      <div className="container">
        <div className="lead-3col">
          {/* Column 1 — lead + 3×3 grid */}
          <div className="lead-3col-col lead-3col-left">
            {slots.lead ? (
              <div className="lead-news">
                <div className="common-border-box lead-3col-box">
                  <Link to={slots.lead.path || `/news/${slots.lead.slug || slots.lead.id}`}>
                    <div className="row">
                      <div className="col-lg-7 pe-lg-0">
                        <SafeImage
                          className="img-fluid"
                          src={slots.lead.image}
                          alt={labelOf(slots.lead)}
                          width={800}
                          priority
                        />
                      </div>
                      <div className="col-lg-5 mt-2 mt-lg-0">
                        <h3 className="title">{labelOf(slots.lead)}</h3>
                        <p className="news-summary">{summaryOf(slots.lead)}</p>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="common-border-box lead-3col-box lead-3col-grid-box">
              <div className="row equal-news-grid">
                {[0, 3].map((start, row) => {
                  const rowItems = slots.grid.slice(start, start + 3)
                  if (rowItems.length < 3) return null
                  return (
                    <Fragment key={`grid-row-${row}`}>
                      {row > 0 ? <div className="col-12 d-none d-lg-block py-2" /> : null}
                      {rowItems.map((item, i) => (
                        <div
                          key={item.id || `g-${start + i}`}
                          className={`col-12 col-lg-4${row > 0 ? ' border-sm-top' : ''}${
                            i < 2 ? ' border-right' : ''
                          }`}
                        >
                          <NewsSm item={item} label={labelOf(item)} />
                        </div>
                      ))}
                    </Fragment>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Column 2 — mid list */}
          <div className="lead-3col-col lead-3col-mid">
            <div className="common-border-box lead-3col-box lead-side-panel lead-side-mid">
              {slots.mid.map((item, i) => (
                <MidNewsRow key={item.id || `m-${i}`} item={item} label={labelOf(item)} lang={lang} />
              ))}
            </div>
          </div>

          {/* Column 3 — news stories */}
          <div className="lead-3col-col lead-3col-story">
            <div className="common-border-box lead-3col-box lead-side-panel lead-side-story">
              <div className="section-title-flex">
                <h3>{storyTitle}</h3>
              </div>
              {slots.story ? (
                <div className="news-md-grid lead-side-story-hero">
                  <Link to={slots.story.path || `/news/${slots.story.slug || slots.story.id}`}>
                    <div className="img-zoom-hover">
                      <SafeImage
                        src={slots.story.image}
                        alt={labelOf(slots.story)}
                        className="img-fluid"
                      />
                      <div className="floating-title">
                        <h4 className="title">{labelOf(slots.story)}</h4>
                      </div>
                    </div>
                  </Link>
                </div>
              ) : null}
              <div className="lead-side-story-list">
                {slots.storyList.map((item, i) => (
                  <StoryListRow key={item.id || `s-${i}`} item={item} label={labelOf(item)} lang={lang} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
