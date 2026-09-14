import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, mapArticle } from '../api/client'

const SiteDataContext = createContext(null)
export { SiteDataContext }
function clearAllLegacyHomeCaches() {
  if (typeof window === 'undefined') return
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && (k.startsWith('kk_home_cache') || k.startsWith('kk_cache_'))) {
        localStorage.removeItem(k)
      }
    }
  } catch {}
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (k && (k.startsWith('kk_home_cache') || k.startsWith('kk_cache_'))) {
        sessionStorage.removeItem(k)
      }
    }
  } catch {}
}

let siteRefreshFn = null
let siteLoadMoreNews = null

export function refreshSiteData() {
  return siteRefreshFn ? siteRefreshFn() : Promise.resolve()
}

export function loadMoreSiteNews() {
  return siteLoadMoreNews ? siteLoadMoreNews() : Promise.resolve()
}

function mapSlot(a) {
  return a ? mapArticle(a) : null
}

function normalize(data) {
  const categories = (data.categories || []).filter((c) => c.slug && c.slug !== 'home')
  const rawLead = data.leadLayout
  return {
    categories: data.categories || [],
    contentCategories: categories,
    headlines: (data.headlines || []).map(mapArticle),
    featured: (data.featured || []).map(mapArticle),
    latest: (data.latest || []).map(mapArticle),
    popular: (data.popular || []).map(mapArticle),
    recent: (data.recent || data.latest || []).map(mapArticle),
    leadLayout: rawLead
      ? {
          lead: mapSlot(rawLead.lead),
          grid: (rawLead.grid || []).map(mapSlot),
          mid: (rawLead.mid || []).map(mapSlot),
          story: mapSlot(rawLead.story),
          storyList: (rawLead.storyList || []).map(mapSlot),
        }
      : null,
    byCategory: data.byCategory || {},
    photos: data.photos || [],
    videos: data.videos || [],
    websites: data.websites || [],
    staff: data.staff || [],
    ads:
      data.settings?.adsEnabled === false || data.settings?.ads_enabled === false
        ? []
        : data.ads || [],
    settings: data.settings || null,
    categoryBlocks: categories.map((cat) => ({
      cat,
      articles: (data.byCategory?.[cat.slug] || []).map(mapArticle),
    })),
    topicGrid: (data.topicGrid || []).map((col) => ({
      ...col,
      items: (col.items || []).map(mapArticle).filter(Boolean),
    })),
    breakingNews: data.breakingNews || [],
    opinions: data.opinions || [],
    layoutTopics: data.layoutTopics || [],
    hasMoreNews: data.hasMoreNews !== false,
  }
}

function articleKey(item) {
  return String(item?.id || item?._id || item?.slug || '')
}

function uniqueAppend(existing = [], incoming = []) {
  const seen = new Set(existing.map(articleKey).filter(Boolean))
  const extra = []
  incoming.forEach((item) => {
    const key = articleKey(item)
    if (!key || seen.has(key)) return
    seen.add(key)
    extra.push(item)
  })
  return existing.concat(extra)
}

function mergeMoreNews(prev, incoming) {
  if (!prev) return prev
  const mapped = (incoming || []).map(mapArticle).filter(Boolean)
  const byCategory = { ...(prev.byCategory || {}) }
  mapped.forEach((item) => {
    const slug = item.category || item.raw?.category?.slug
    if (!slug) return
    const list = byCategory[slug] || []
    byCategory[slug] = uniqueAppend(list, [item])
  })
  const categories = prev.contentCategories || prev.categories || []
  return {
    ...prev,
    latest: uniqueAppend(prev.latest, mapped),
    recent: uniqueAppend(prev.recent, mapped),
    headlines: uniqueAppend(prev.headlines, mapped.filter((a) => a.headline)),
    featured: uniqueAppend(prev.featured, mapped.filter((a) => a.featured)),
    byCategory,
    categoryBlocks: categories
      .filter((c) => c.slug && c.slug !== 'home')
      .map((cat) => ({
        cat,
        articles: uniqueAppend(
          prev.categoryBlocks?.find((b) => b.cat?.slug === cat.slug)?.articles || [],
          mapped.filter((a) => a.category === cat.slug),
        ),
      })),
  }
}

const empty = {
  categories: [],
  contentCategories: [],
  headlines: [],
  featured: [],
  latest: [],
  popular: [],
  recent: [],
  leadLayout: null,
  byCategory: {},
  opinions: [],
  layoutTopics: [],
  photos: [],
  videos: [],
  websites: [],
  staff: [],
  ads: [],
  settings: null,
  categoryBlocks: [],
  topicGrid: [],
  breakingNews: [],
  hasMoreNews: true,
}

const SYNC_CHANNEL_NAME = 'kk_news_sync_channel'
let syncChannel = null
if (typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function') {
  try {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME)
  } catch {
    syncChannel = null
  }
}

export function SiteDataProvider({ children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subs, setSubs] = useState([])
  const [loadingMoreNews, setLoadingMoreNews] = useState(false)

  useEffect(() => {
    let alive = true
    let lastFetchTime = 0
    const newsLock = { current: false }
    const newsSkip = { current: 0 }
    const newsDone = { current: false }
    clearAllLegacyHomeCaches()

    async function loadHome(forceBust = false) {
      const now = Date.now()
      if (!forceBust && now - lastFetchTime < 8000) return
      lastFetchTime = now
      try {
        if (!data) setLoading(true)
        const home = await api.getHome(forceBust ? { bust: Date.now() } : {})
        if (!alive) return
        const next = normalize(home)
        if (Array.isArray(home.subcategories) && home.subcategories.length) {
          setSubs(home.subcategories)
        } else {
          loadSubs()
        }
        newsSkip.current = (next.recent || []).length
        newsDone.current = next.hasMoreNews === false
        setData((prev) => {
          if (!forceBust && prev?.recent?.length > (next.recent || []).length) {
            return {
              ...next,
              latest: uniqueAppend(next.latest, prev.latest),
              recent: uniqueAppend(next.recent, prev.recent),
              headlines: uniqueAppend(next.headlines, prev.headlines),
              featured: uniqueAppend(next.featured, prev.featured),
              categoryBlocks: (next.categoryBlocks || []).map((block) => ({
                ...block,
                articles: uniqueAppend(
                  block.articles,
                  prev.categoryBlocks?.find((b) => b.cat?.slug === block.cat?.slug)?.articles || [],
                ),
              })),
              hasMoreNews: prev.hasMoreNews && next.hasMoreNews !== false,
            }
          }
          return next
        })
        setError('')

        const seo = home?.settings?.seo
        if (seo?.metaTitle && window.location.pathname === '/') {
          document.title = seo.metaTitle
        }
        const desc = document.querySelector('meta[name="description"]')
        if (desc && seo?.metaDescription && window.location.pathname === '/') {
          desc.setAttribute('content', seo.metaDescription)
        }
      } catch (err) {
        if (alive && !data) setError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    }

    async function loadMoreNews() {
      if (!alive || newsLock.current || newsDone.current) return
      newsLock.current = true
      setLoadingMoreNews(true)
      try {
        const res = await api.getHomeNews({ skip: newsSkip.current, limit: 20 })
        if (!alive) return
        const items = res?.items || []
        newsSkip.current += items.length
        if (!items.length || res.hasMore === false || items.length < 20) {
          newsDone.current = true
        }
        setData((prev) => {
          const merged = mergeMoreNews(prev || empty, items)
          return { ...merged, hasMoreNews: !newsDone.current }
        })
      } catch {
        /* keep already loaded news */
      } finally {
        newsLock.current = false
        if (alive) setLoadingMoreNews(false)
      }
    }
    siteLoadMoreNews = loadMoreNews

    async function loadSubs() {
      try {
        const subcategories = await api.getSubcategories()
        if (alive) setSubs(subcategories || [])
      } catch {
        /* ignore */
      }
    }

    loadHome(false)

    // 2. Global refresh function (for Admin and manual triggers)
    siteRefreshFn = async () => {
      clearAllLegacyHomeCaches()
      newsSkip.current = 0
      newsDone.current = false
      await loadHome(true)
      try {
        if (syncChannel) syncChannel.postMessage({ type: 'REFRESH', at: Date.now() })
        localStorage.setItem('kk_last_sync_trigger', String(Date.now()))
      } catch {
        /* ignore */
      }
    }

    // 3. Listen for sync broadcasts across tabs/windows
    function handleSyncMessage(event) {
      if (event?.data?.type === 'REFRESH') {
        loadHome(true)
        loadSubs()
      }
    }
    if (syncChannel) {
      syncChannel.addEventListener('message', handleSyncMessage)
    }

    // 4. Storage event fallback for cross-tab sync
    function handleStorageEvent(e) {
      if (e.key === 'kk_last_sync_trigger') {
        loadHome(true)
      }
    }
    window.addEventListener('storage', handleStorageEvent)

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadHome(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadHome(false)
      }
    }, 120000)

    return () => {
      alive = false
      clearInterval(interval)
      if (syncChannel) syncChannel.removeEventListener('message', handleSyncMessage)
      window.removeEventListener('storage', handleStorageEvent)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (siteRefreshFn) siteRefreshFn = null
      siteLoadMoreNews = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({
      ...(data || empty),
      subs,
      loading,
      error,
      ready: Boolean(data),
      refresh: refreshSiteData,
      loadingMoreNews,
      loadMoreNews: loadMoreSiteNews,
    }),
    [data, subs, loading, error, loadingMoreNews],
  )

  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>
}

export function useSiteData() {
  const ctx = useContext(SiteDataContext)
  if (!ctx) throw new Error('useSiteData must be used within SiteDataProvider')
  return ctx
}
