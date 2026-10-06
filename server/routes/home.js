import { Router } from 'express'
import Article from '../models/Article.js'
import Category from '../models/Category.js'
import PhotoGallery from '../models/PhotoGallery.js'
import VideoGallery from '../models/VideoGallery.js'
import SiteSetting from '../models/SiteSetting.js'
import Subcategory from '../models/Subcategory.js'
import ImportantWebsite from '../models/ImportantWebsite.js'
import Staff from '../models/Staff.js'
import Ad from '../models/Ad.js'
import { slimAd, isLive } from './ads.js'
import { cacheGet, cacheSet } from '../utils/cache.js'
import { isAdsGloballyEnabled } from '../utils/adsEnabled.js'
import BreakingNews from '../models/BreakingNews.js'
import Opinion from '../models/Opinion.js'
import LayoutTopic from '../models/LayoutTopic.js'
import { HOME_LIST_SELECT } from '../utils/articleFields.js'
import Media from '../models/Media.js'

const router = Router()
const CACHE_KEY = 'home:v48'
const CACHE_TTL = 180_000
const NEWS_BATCH = 20
const EXCERPT_LEN = 280

const SLIM =
  'title titleEn slug excerpt excerptEn metaDescription image author views featured headline latest popular bigthumbnail publishedAt category subcategory'
const CATEGORY_CARD_SELECT =
  'title titleEn slug excerpt excerptEn metaDescription image author views featured headline latest popular bigthumbnail publishedAt category subcategory'

function extractText(htmlOrText, maxLen = 800) {
  if (!htmlOrText) return ''
  const clean = String(htmlOrText)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return clean.slice(0, maxLen)
}

function getFullDescription(excerpt, body, metaDesc, maxLen = EXCERPT_LEN) {
  const cleanExcerpt = extractText(excerpt, maxLen)
  const cleanBody = extractText(body || metaDesc, maxLen)
  if (!cleanExcerpt && !cleanBody) return ''
  if (!cleanBody) return cleanExcerpt
  if (!cleanExcerpt) return cleanBody
  if (cleanBody.startsWith(cleanExcerpt) || cleanBody.includes(cleanExcerpt)) {
    return cleanBody
  }
  return `${cleanExcerpt} — ${cleanBody}`.slice(0, maxLen)
}

function thumb(url, w = 480) {
  if (!url || typeof url !== 'string') return url || ''
  if (url.includes('res.cloudinary.com')) {
    const parts = url.split('/upload/')
    if (parts.length === 2) {
      return `${parts[0]}/upload/f_auto,q_auto,w_${w},c_fill,g_auto/${parts[1]}`
    }
  }
  if (url.includes('images.unsplash.com')) {
    const base = url.split('?')[0]
    return `${base}?auto=format&fit=crop&w=${w}&h=${Math.round(w * 0.66)}&q=70`
  }
  return url
}

function ytThumb(embed) {
  if (!embed) return ''
  const m = String(embed).match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : ''
}

function slimArticle(a, imageW = 480) {
  if (!a) return a
  const rawBn = getFullDescription(a.excerpt, a.body, a.metaDescription, EXCERPT_LEN)
  const rawEn = getFullDescription(a.excerptEn, a.bodyEn, a.metaDescription, EXCERPT_LEN)
  return {
    _id: a._id,
    title: a.title,
    titleEn: a.titleEn || '',
    slug: a.slug,
    excerpt: rawBn,
    excerptEn: rawEn,
    image: thumb(a.image, imageW),
    author: a.author,
    views: a.views || 0,
    featured: !!a.featured,
    headline: !!a.headline,
    latest: !!a.latest,
    popular: !!a.popular,
    bigthumbnail: !!a.bigthumbnail,
    publishedAt: a.publishedAt,
    category: a.category
      ? { _id: a.category._id, name: a.category.name, nameEn: a.category.nameEn || '', slug: a.category.slug }
      : null,
    subcategory: a.subcategory
      ? {
          _id: a.subcategory._id || a.subcategory,
          slug: a.subcategory.slug || '',
          nameBn: a.subcategory.nameBn || '',
          nameEn: a.subcategory.nameEn || '',
        }
      : null,
  }
}

function isOid(id) {
  return /^[0-9a-fA-F]{24}$/.test(String(id || '').trim())
}

function mediaIdFromUrl(url) {
  return String(url || '').match(/\/api\/media\/([0-9a-fA-F]{24})/)?.[1] || null
}

async function publicImageMap(urls) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) return new Map()
  const ids = [...new Set((urls || []).map(mediaIdFromUrl).filter(Boolean))]
  if (!ids.length) return new Map()
  const docs = await Media.find({ _id: { $in: ids } }).select('secureUrl url').lean()
  const map = new Map()
  docs.forEach((doc) => {
    const direct = doc.secureUrl || doc.url || ''
    if (/^https?:\/\//i.test(direct)) map.set(String(doc._id), direct)
  })
  return map
}

function applyPublicImage(url, map, width) {
  const id = mediaIdFromUrl(url)
  const direct = id ? map.get(id) : ''
  return thumb(direct || url, width)
}

async function buildTopicGrid(settings) {
  const limit = Math.min(16, Math.max(1, Number(settings?.topicGridLimit) || 8))
  const topics = await Subcategory.find({ isActive: { $ne: false }, showOnHome: true })
    .populate('category', 'name nameEn slug')
    .sort({ homeOrder: 1, order: 1, nameBn: 1 })
    .limit(limit)
    .lean()
  if (!topics.length) return []

  const pickedIds = []
  topics.forEach((topic) => {
    if (isOid(topic.homeFeatured)) pickedIds.push(String(topic.homeFeatured).trim())
    ;(topic.homeSecondary || []).forEach((id) => {
      if (isOid(id)) pickedIds.push(String(id).trim())
    })
  })

  const extra = await Article.find({
    isPublished: { $ne: false },
    $or: [{ subcategory: { $in: topics.map((topic) => topic._id) } }, { _id: { $in: pickedIds } }],
  })
    .select(HOME_LIST_SELECT)
    .populate('category', 'name nameEn slug')
    .populate('subcategory', 'nameBn nameEn slug')
    .sort({ publishedAt: -1 })
    .limit(80)
    .lean()

  const byId = new Map(extra.map((article) => [String(article._id), slimArticle(article, 400)]))
  const bySub = {}
  extra.forEach((article) => {
    const sid = String(article.subcategory?._id || article.subcategory || '')
    if (!sid) return
    if (!bySub[sid]) bySub[sid] = []
    bySub[sid].push(slimArticle(article, 400))
  })

  return topics
    .map((topic) => {
      const used = new Set()
      const items = []
      const push = (id) => {
        const art = byId.get(String(id || '').trim())
        if (!art) return
        const key = String(art._id)
        if (used.has(key)) return
        used.add(key)
        items.push(art)
      }
      push(topic.homeFeatured)
      ;(topic.homeSecondary || []).forEach(push)
      ;(bySub[String(topic._id)] || []).forEach((art) => {
        if (items.length >= 8) return
        push(art._id)
      })
      if (!items.length) return null
      return {
        _id: topic._id,
        nameBn: topic.nameBn,
        nameEn: topic.nameEn || '',
        slug: topic.slug,
        parentSlug: topic.category?.slug || settings?.topicGridSlug || 'motso',
        hasSub: true,
        items,
      }
    })
    .filter(Boolean)
}

function slimSettings(s) {
  if (!s) return null
  return {
    siteName: s.siteName,
    breakingTitle: s.breakingTitle || s.breakingTitleBn || '',
    breakingTitleBn: s.breakingTitleBn || s.breakingTitle || '',
    breakingTitleEn: s.breakingTitleEn || '',
    newsStoriesTitle: s.newsStoriesTitle || s.newsStoriesTitleBn || 'নিউজ স্টোরিজ',
    newsStoriesTitleBn: s.newsStoriesTitleBn || s.newsStoriesTitle || 'নিউজ স্টোরিজ',
    newsStoriesTitleEn: s.newsStoriesTitleEn || 'News Stories',
    homepageLayout: s.homepageLayout,
    homepageSlots: s.homepageSlots || null,
    sectionSlots: s.sectionSlots || {},
    sectionSidebars: s.sectionSidebars || {},
    discussedConfig: s.discussedConfig || {},
    tagline: s.tagline,
    hotline: s.hotline,
    notice: s.notice,
    logo: s.logo,
    email: s.email,
    phoneBn: s.phoneBn,
    addressBn: s.addressBn,
    addressEn: s.addressEn,
    phoneEn: s.phoneEn,
    aboutUs: (s.aboutUs || '').slice(0, 220),
    facebookPage: s.facebookPage,
    themeColor: s.themeColor,
    liveTvLink: s.liveTvLink || '',
    liveTvEmbed: s.liveTvEmbed || '',
    chiefAdvisor: s.chiefAdvisor,
    publisher: s.publisher,
    managingEditor: s.managingEditor,
    social: s.social,
    namaz: s.namaz,
    seo: s.seo
      ? {
          metaTitle: s.seo.metaTitle || '',
          metaDescription: s.seo.metaDescription || '',
          metaKeyword: s.seo.metaKeyword || '',
          metaAuthor: s.seo.metaAuthor || '',
          googleAnalytics: s.seo.googleAnalytics || '',
          googleVerification: s.seo.googleVerification || '',
          ogImage: s.seo.ogImage || '',
          horizontal1: s.seo.horizontal1 || '',
          horizontal2: s.seo.horizontal2 || '',
          horizontal3: s.seo.horizontal3 || '',
          horizontalBig1: s.seo.horizontalBig1 || '',
          bottomPopup: s.seo.bottomPopup || '',
          vertical: s.seo.vertical || '',
        }
      : null,
    favicon: s.favicon || s.logo || '/logo.png',
    faviconRev: s.faviconRev || '',
    adsEnabled: isAdsGloballyEnabled(s),
    ads_enabled: isAdsGloballyEnabled(s),
    topicGridLimit: Number(s.topicGridLimit) > 0 ? Number(s.topicGridLimit) : 8,
    topicGridSlug: s.topicGridSlug || 'motso',
  }
}

function setHomeCacheHeaders(res, bust) {
  if (bust) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Surrogate-Control', 'no-store')
    return
  }
  res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300')
}

router.get('/news', async (req, res) => {
  try {
    const skip = Math.max(0, Number(req.query.skip) || 0)
    const limit = Math.min(NEWS_BATCH, Math.max(1, Number(req.query.limit) || NEWS_BATCH))
    const articles = await Article.find({ isPublished: { $ne: false } })
      .select(SLIM)
      .populate('category', 'name nameEn slug')
      .populate('subcategory', 'nameBn nameEn slug')
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    res.set('Cache-Control', 'public, max-age=5, s-maxage=15')
    res.json({
      items: articles.map((a) => slimArticle(a, 400)),
      hasMore: articles.length === limit,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const bust = Boolean(req.query.bust)
    setHomeCacheHeaders(res, bust)

    const cached = bust ? null : cacheGet(CACHE_KEY)
    if (cached) {
      res.set('X-Cache', 'HIT')
      return res.json(cached)
    }

    const started = Date.now()
    const [
      categories,
      articles,
      photos,
      videos,
      settings,
      websites,
      staff,
      breakingNews,
      opinions,
      layoutTopics,
      ads,
      subcategories,
    ] = await Promise.all([
      Category.find({ isActive: true })
        .select('name nameEn slug order')
        .sort({ order: 1, name: 1 })
        .lean()
        .catch(() => []),
      Article.find({ isPublished: { $ne: false } })
        .select(HOME_LIST_SELECT)
        .populate('category', 'name nameEn slug')
        .populate('subcategory', 'nameBn nameEn slug')
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(NEWS_BATCH)
        .lean()
        .catch(() => []),
      PhotoGallery.find().select('title photo type').sort({ createdAt: -1 }).limit(12).lean().catch(() => []),
      VideoGallery.find()
        .select('title embedCode thumbnail type')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .catch(() => []),
      SiteSetting.findOne({ key: 'site' })
        .select(
          'siteName tagline hotline notice logo favicon faviconRev email phoneBn addressBn addressEn phoneEn aboutUs facebookPage liveTvLink liveTvEmbed chiefAdvisor publisher managingEditor social namaz seo themeColor homepageLayout homepageSlots sectionSlots sectionSidebars discussedConfig latestPopularConfig adsEnabled topicGridLimit topicGridSlug breakingTitle breakingTitleBn breakingTitleEn newsStoriesTitle newsStoriesTitleBn newsStoriesTitleEn newsStandingTitle',
        )
        .lean()
        .catch(() => null),
      ImportantWebsite.find({ isActive: { $ne: false } })
        .select('websiteName websiteLink order')
        .sort({ order: 1 })
        .limit(12)
        .lean()
        .catch(() => []),
      Staff.find({ isActive: { $ne: false }, type: { $in: ['Staff', 'Management'] } })
        .select('name designation image link type order')
        .sort({ order: 1 })
        .limit(8)
        .lean()
        .catch(() => []),
      BreakingNews.find({ isActive: { $ne: false }, status: 'published' })
        .select('titleBn titleEn order publishedAt')
        .sort({ order: 1, publishedAt: -1 })
        .limit(20)
        .lean()
        .catch(() => []),
      Opinion.find({ status: 'published', isActive: { $ne: false } })
        .select('name title titleEn details image createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .catch(() => []),
      LayoutTopic.find({ isActive: { $ne: false } })
        .populate('category', 'name nameEn slug')
        .populate('subcategory', 'nameBn nameEn slug')
        .sort({ order: 1, createdAt: 1 })
        .lean()
        .catch(() => []),
      Ad.find({ isActive: { $ne: false } })
        .sort({ position: 1, order: 1, createdAt: -1 })
        .lean()
        .catch(() => []),
      Subcategory.find({ isActive: true })
        .populate('category', 'name slug')
        .select('nameBn nameEn slug category order isActive showOnHome homeOrder homeFeatured homeSecondary')
        .sort({ order: 1, nameBn: 1 })
        .lean()
        .catch(() => []),
    ])

    const contentCats = (categories || []).filter((c) => c.slug && c.slug !== 'home')
    const gridSlug = settings?.topicGridSlug || 'motso'
    const subMap = new Map((subcategories || []).map((s) => [String(s._id), s]))

    // Fetch latest published articles for every active content category in parallel (lean, indexed)
    const categoryArticlesLists = await Promise.all(
      contentCats.map((cat) =>
        Article.find({
          category: cat._id,
          isPublished: { $ne: false },
        })
          .select(CATEGORY_CARD_SELECT)
          .sort({ publishedAt: -1 })
          .limit(cat.slug === gridSlug ? 16 : 10)
          .lean()
          .catch((err) => {
            console.warn(`Category news query failed for ${cat.slug}:`, err.message)
            return []
          }),
      ),
    )

    const allCatRawArts = categoryArticlesLists.flat()
    const imageUrls = [
      ...articles.map((a) => a.image),
      ...allCatRawArts.map((a) => a.image),
      ...photos.map((p) => p.photo),
      ...opinions.map((o) => o.image),
      ...staff.map((s) => s.image),
    ]
    const [cdnImages, topicGridEarly] = await Promise.all([
      publicImageMap(imageUrls),
      buildTopicGrid(settings).catch((err) => {
        console.warn('topicGrid failed:', err.message)
        return []
      }),
    ])

    const slimArts = articles.map((a, i) => {
      const row = slimArticle(a, i === 0 ? 800 : 400)
      row.image = applyPublicImage(a.image, cdnImages, i === 0 ? 800 : 400)
      return row
    })
    const popular = [...slimArts]
      .sort((a, b) => (b.views || 0) - (a.views || 0) || (b.popular ? 1 : 0) - (a.popular ? 1 : 0))
      .slice(0, 12)

    const headlines = slimArts.filter((a) => a.headline).slice(0, 12)
    const featured = slimArts.filter((a) => a.featured).slice(0, 12)
    const latest = slimArts.filter((a) => a.latest).slice(0, 20)
    const bigThumb = slimArts.find((a) => a.bigthumbnail)

    // Build byCategory map for each category with proper articles and public CDN images
    const byCategory = {}
    for (let i = 0; i < contentCats.length; i++) {
      const cat = contentCats[i]
      const rawList = categoryArticlesLists[i] || []
      byCategory[cat.slug] = rawList.map((a) => {
        const sub = a.subcategory ? subMap.get(String(a.subcategory._id || a.subcategory)) : null
        const row = slimArticle(
          {
            ...a,
            category: {
              _id: cat._id,
              name: cat.name,
              nameEn: cat.nameEn || '',
              slug: cat.slug,
            },
            subcategory: sub || a.subcategory,
          },
          400,
        )
        row.image = applyPublicImage(a.image, cdnImages, 400)
        return row
      })
    }

    // Merge in any recent slimArts that belong to category if not already in list
    for (const article of slimArts) {
      const slug = article.category?.slug
      if (!slug || !byCategory[slug]) continue
      const id = String(article._id)
      if (!byCategory[slug].some((a) => String(a._id) === id)) {
        byCategory[slug].unshift(article)
        const cap = slug === gridSlug ? 16 : 10
        if (byCategory[slug].length > cap) {
          byCategory[slug] = byCategory[slug].slice(0, cap)
        }
      }
    }

    const sectionSlots =
      settings?.sectionSlots && typeof settings.sectionSlots === 'object'
        ? settings.sectionSlots
        : {}
    const extraIds = []
    for (const slug of Object.keys(byCategory)) {
      const ids = (sectionSlots[slug]?.items || sectionSlots[slug] || [])
        .map((id) => String(id || '').trim())
        .filter((id) => /^[0-9a-fA-F]{24}$/.test(id))
      ids.forEach((id) => extraIds.push(id))
    }
    const known = new Map(slimArts.map((a) => [String(a._id), a]))
    Object.values(byCategory)
      .flat()
      .forEach((a) => known.set(String(a._id), a))

    const need = [...new Set(extraIds)].filter((id) => !known.has(id))
    if (need.length) {
      const extra = await Article.find({ _id: { $in: need }, isPublished: { $ne: false } })
        .select(HOME_LIST_SELECT)
        .populate('category', 'name nameEn slug')
        .populate('subcategory', 'nameBn nameEn slug')
        .lean()
        .catch(() => [])
      extra.forEach((a) => {
        const row = slimArticle(a, 400)
        row.image = applyPublicImage(a.image, cdnImages, 400)
        known.set(String(a._id), row)
      })
    }
    for (const slug of Object.keys(byCategory)) {
      const ids = (sectionSlots[slug]?.items || sectionSlots[slug] || [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
      if (!ids.length) continue
      const used = new Set()
      const next = []
      ids.forEach((id) => {
        const item = known.get(id)
        if (item && !used.has(id)) {
          next.push(item)
          used.add(id)
        }
      })
      ;(byCategory[slug] || []).forEach((item) => {
        const id = String(item._id)
        if (!used.has(id)) next.push(item)
      })
      byCategory[slug] = next.slice(0, slug === gridSlug ? 16 : 12)
    }

    const topicGrid = topicGridEarly || []

    // Prefer bigthumbnail as lead if present
    let featuredOut = featured.length ? featured : (headlines.length ? headlines : latest).slice(0, 16)
    if (bigThumb && featuredOut[0]?._id !== bigThumb._id) {
      featuredOut = [bigThumb, ...featuredOut.filter((a) => a._id !== bigThumb._id)].slice(0, 16)
    }

    const byId = new Map(slimArts.map((a) => [String(a._id), a]))
    popular.forEach((a) => byId.set(String(a._id), a))

    const slots = settings?.homepageSlots || {}
    const lpConfig = settings?.latestPopularConfig || {}
    const lpLatestIds = (Array.isArray(lpConfig.latestItems) ? lpConfig.latestItems : [])
      .map((id) => String(id || '').trim())
      .filter((id) => /^[0-9a-fA-F]{24}$/.test(id))
    const lpPopularIds = (Array.isArray(lpConfig.popularItems) ? lpConfig.popularItems : [])
      .map((id) => String(id || '').trim())
      .filter((id) => /^[0-9a-fA-F]{24}$/.test(id))

    const wantedIds = [
      slots.lead,
      ...(slots.grid || []),
      ...(slots.mid || []),
      slots.story,
      ...(slots.storyList || []),
      ...lpLatestIds,
      ...lpPopularIds,
    ]
      .map((id) => String(id || '').trim())
      .filter((id) => /^[0-9a-fA-F]{24}$/.test(id))

    const missing = [...new Set(wantedIds)].filter((id) => !byId.has(id))
    if (missing.length) {
      const extra = await Article.find({ _id: { $in: missing }, isPublished: true })
        .select(HOME_LIST_SELECT)
        .populate('category', 'name nameEn slug')
        .lean()
      extra.forEach((a) => byId.set(String(a._id), slimArticle(a, 400)))
    }

    const pickSlot = (id) => {
      const key = String(id || '').trim()
      return key && byId.get(key) ? byId.get(key) : null
    }

    const hasManualSlots = [
      slots.lead,
      ...(slots.grid || []),
      ...(slots.mid || []),
      slots.story,
      ...(slots.storyList || []),
    ].some((id) => /^[0-9a-fA-F]{24}$/.test(String(id || '').trim()))

    const leadLayout = hasManualSlots
      ? {
          lead: pickSlot(slots.lead),
          grid: Array.from({ length: 9 }, (_, i) => pickSlot((slots.grid || [])[i])),
          mid: Array.from({ length: 8 }, (_, i) => pickSlot((slots.mid || [])[i])),
          story: pickSlot(slots.story),
          storyList: Array.from({ length: 8 }, (_, i) => pickSlot((slots.storyList || [])[i])),
        }
      : null

    let finalLatest = latest.length >= 12 ? latest : slimArts.slice(0, NEWS_BATCH)
    if (lpConfig.latestMode === 'manual' && lpLatestIds.length > 0) {
      const manualLatest = []
      const usedId = new Set()
      lpLatestIds.forEach((id) => {
        const item = byId.get(id)
        if (item && !usedId.has(id)) {
          manualLatest.push(item)
          usedId.add(id)
        }
      })
      finalLatest.forEach((item) => {
        const id = String(item._id)
        if (!usedId.has(id)) {
          manualLatest.push(item)
          usedId.add(id)
        }
      })
      finalLatest = manualLatest.slice(0, NEWS_BATCH)
    }

    let finalPopular = popular.length ? popular : slimArts.slice(0, 16)
    if (lpConfig.popularMode === 'manual' && lpPopularIds.length > 0) {
      const manualPop = []
      const usedId = new Set()
      lpPopularIds.forEach((id) => {
        const item = byId.get(id)
        if (item && !usedId.has(id)) {
          manualPop.push(item)
          usedId.add(id)
        }
      })
      finalPopular.forEach((item) => {
        const id = String(item._id)
        if (!usedId.has(id)) {
          manualPop.push(item)
          usedId.add(id)
        }
      })
      finalPopular = manualPop.slice(0, 16)
    }

    const payload = {
      categories,
      headlines: headlines.length ? headlines : slimArts.slice(0, 16),
      featured: featuredOut.length ? featuredOut : slimArts.slice(0, 16),
      latest: finalLatest,
      popular: finalPopular,
      latestPopularConfig: lpConfig,
      recent: slimArts.slice(0, NEWS_BATCH),
      hasMoreNews: slimArts.length === NEWS_BATCH,
      leadLayout,
      byCategory,
      topicGrid,
      photos: photos.map((p) => ({ ...p, photo: applyPublicImage(p.photo, cdnImages, 400) })),
      videos: videos.map((v) => ({
        _id: v._id,
        title: v.title,
        embedCode: v.embedCode,
        thumbnail: thumb(v.thumbnail || '', 400) || ytThumb(v.embedCode),
        type: v.type,
      })),
      websites,
      staff,
      ads: isAdsGloballyEnabled(settings) ? (ads || []).filter((a) => isLive(a)).map(slimAd) : [],
      subcategories,
      settings: slimSettings(settings),
      breakingNews: (breakingNews || []).map((b) => ({
        _id: b._id,
        titleBn: b.titleBn,
        titleEn: b.titleEn || '',
        order: b.order ?? 1,
      })),
      opinions: (opinions || []).map((o) => ({
        _id: o._id,
        name: o.name,
        title: o.title,
        titleEn: o.titleEn || '',
        details: extractText(o.details || '', EXCERPT_LEN),
        image: applyPublicImage(o.image || '', cdnImages, 400),
        createdAt: o.createdAt,
      })),
      layoutTopics: (layoutTopics || []).map((t) => ({
        _id: t._id,
        title: t.title,
        titleEn: t.titleEn || '',
        slug: t.slug,
        icon: t.icon || 'fa-solid fa-leaf',
        image: t.image || '',
        url: t.url || '',
        category: t.category ? { _id: t.category._id, name: t.category.name, nameEn: t.category.nameEn || '', slug: t.category.slug } : null,
        subcategory: t.subcategory ? { _id: t.subcategory._id, nameBn: t.subcategory.nameBn, nameEn: t.subcategory.nameEn || '', slug: t.subcategory.slug } : null,
        order: t.order || 0,
        isActive: t.isActive !== false,
      })),
    }

    cacheSet(CACHE_KEY, payload, CACHE_TTL)
    res.set('X-Cache', bust ? 'BYPASS' : 'MISS')
    res.set('X-Home-Build-Ms', String(Date.now() - started))
    res.json(payload)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
