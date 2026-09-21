import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Article from '../models/Article.js'
import Opinion from '../models/Opinion.js'
import Media from '../models/Media.js'
import SiteSetting from '../models/SiteSetting.js'
import { stripHtml } from './seoContent.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getBaseHtml() {
  const candidates = [
    path.resolve(__dirname, '../generated-spa.html'),
    path.resolve(process.cwd(), 'dist', 'index.html'),
    path.resolve(process.cwd(), 'index.html'),
    path.resolve(__dirname, '../../dist/index.html'),
    path.resolve(__dirname, '../../index.html'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8')
      }
    } catch {}
  }
  return `<!doctype html><html lang="bn"><head><meta charset="UTF-8" /><title>কৃষিকাগজ</title></head><body><div id="root"></div></body></html>`
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function getCleanArticleSlug(article) {
  if (!article) return ''
  const id = String(article._id || article.id || '')
  const rawSlug = article.slug ? String(article.slug).trim() : ''
  const isCleanAscii =
    rawSlug &&
    /^[a-zA-Z0-9_-]+$/.test(rawSlug) &&
    !/[^\x00-\x7F]/.test(rawSlug) &&
    rawSlug.length >= 3 &&
    !/^[0-9a-fA-F]{24}$/.test(rawSlug)
  return isCleanAscii ? rawSlug : id
}

function guessImageType(url, mime = '') {
  if (mime && mime.startsWith('image/')) return mime
  const lower = String(url || '').toLowerCase()
  if (lower.includes('.png') || lower.includes('image/png')) return 'image/png'
  if (lower.includes('.webp')) return 'image/webp'
  if (lower.includes('.gif')) return 'image/gif'
  if (lower.includes('.svg')) return 'image/jpeg'
  return 'image/jpeg'
}

function toAbsoluteUrl(raw, siteUrl) {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (value.startsWith('data:')) return ''
  let url = value
  if (!/^https?:\/\//i.test(url)) {
    url = `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`
  }
  return url
    .replace('https://krishikagoj-two.vercel.app', 'https://krishikagoj.com')
    .replace('http://krishikagoj.com', 'https://krishikagoj.com')
}

function socialSafeUrl(url, siteUrl) {
  const abs = toAbsoluteUrl(url, siteUrl)
  if (!abs || /\.svg(\?|$)/i.test(abs) || abs.startsWith('data:')) {
    return `${siteUrl}/logo.png`
  }
  return abs
}

async function resolveShareImage(rawImage, siteUrl) {
  const fallback = `${siteUrl}/logo.png`
  const raw = String(rawImage || '').trim()
  if (!raw) {
    try {
      const settings = await SiteSetting.findOne().select('defaultNewsImage logo favicon').lean()
      const candidate = settings?.defaultNewsImage || settings?.logo || settings?.favicon || ''
      const safe = socialSafeUrl(candidate, siteUrl)
      return { imgUrl: safe, imageType: guessImageType(safe, 'image/png') }
    } catch {
      return { imgUrl: fallback, imageType: 'image/png' }
    }
  }

  const mediaId = raw.match(/\/api\/media\/([0-9a-fA-F]{24})/)?.[1] || (/^[0-9a-fA-F]{24}$/.test(raw) ? raw : null)
  if (mediaId) {
    try {
      const media = await Media.findById(mediaId).select('secureUrl url mimeType').lean()
      const direct = media?.secureUrl || media?.url || ''
      if (direct && /^https?:\/\//i.test(direct) && !/\.svg(\?|$)/i.test(direct)) {
        return { imgUrl: direct, imageType: guessImageType(direct, media?.mimeType) }
      }
    } catch {}
    return { imgUrl: `${siteUrl}/api/media/${mediaId}`, imageType: 'image/jpeg' }
  }

  const imgUrl = socialSafeUrl(raw, siteUrl) || fallback
  return { imgUrl, imageType: guessImageType(imgUrl) }
}

function decodeSlug(raw) {
  let s = String(raw || '').trim()
  if (!s) return ''
  try {
    s = decodeURIComponent(s)
  } catch {}
  return s.replace(/\/+$/, '').split('?')[0].split('#')[0]
}

export function extractNewsSlug(req) {
  const candidates = []
  const q = req.query || {}
  if (q.__newsSlug) candidates.push(q.__newsSlug)
  if (q.slug) candidates.push(Array.isArray(q.slug) ? q.slug.join('/') : q.slug)

  const headerSlug = req.headers['x-news-slug']
  if (headerSlug) candidates.push(headerSlug)

  const urls = [
    req.originalUrl,
    req.url,
    req.path,
    req.headers['x-matched-path'],
    req.headers['x-vercel-matched-path'],
    req.headers['x-invoke-path'],
    req.headers['x-forwarded-uri'],
  ].filter(Boolean).map(String)

  for (const u of urls) {
    if (u.includes('__newsSlug=')) {
      candidates.push(u.slice(u.indexOf('__newsSlug=') + 11).split('&')[0])
    }
    const newsMatch = u.match(/\/(?:ssr-news|news)\/([^/?#]+)/)
    if (newsMatch) candidates.push(newsMatch[1])
  }

  for (const raw of candidates) {
    const s = decodeSlug(raw)
    if (s && s !== 'api' && s !== 'index' && s !== '$1') return s
  }
  return null
}

function getProductionSiteUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || ''
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')
    return `${proto}://${host}`
  }
  return 'https://krishikagoj.com'
}

function getCleanOgDescription(article, isEn = false) {
  const cleanBody = stripHtml(isEn && article.bodyEn ? article.bodyEn : article.body)
    .replace(/\s+/g, ' ')
    .trim()

  const explicitDesc = (
    isEn
      ? (article.excerptEn || '')
      : (article.metaDescription || article.excerpt || '')
  ).replace(/\s+/g, ' ').trim()

  let desc = ''
  if (explicitDesc && explicitDesc.length >= 60) {
    desc = explicitDesc
  } else if (cleanBody) {
    if (explicitDesc && !cleanBody.startsWith(explicitDesc)) {
      desc = `${explicitDesc} — ${cleanBody}`
    } else {
      desc = cleanBody
    }
  } else {
    desc = explicitDesc || (isEn
      ? 'Krishi Kagoj — Agriculture news, crops, livestock, fisheries, technology and farmers stories.'
      : 'কৃষিকাগজ — বাংলাদেশের কৃষি খবর, ফসল, প্রাণিসম্পদ, মৎস্য, প্রযুক্তি ও কৃষকের কথা।')
  }

  // Target 3-4 lines: 160-220 characters, ending cleanly at a word boundary
  if (desc.length > 220) {
    const cut = desc.slice(0, 220)
    const lastSpace = cut.lastIndexOf(' ')
    desc = (lastSpace > 120 ? cut.slice(0, lastSpace) : cut) + '...'
  }
  return desc
}

export async function renderArticleOgHtml(req, res, idOrSlug) {
  try {
    const rawIdOrSlug = String(idOrSlug || '').trim()
    let decoded = rawIdOrSlug
    try {
      decoded = decodeURIComponent(rawIdOrSlug)
    } catch {}

    const requestBlob = [
      rawIdOrSlug,
      decoded,
      req.params?.idOrSlug,
      req.url,
      req.originalUrl,
      req.headers['x-invoke-path'],
      req.headers['x-vercel-original-url'],
      req.headers['x-matched-path'],
      req.query?.kkNews,
      req.query?.__newsSlug,
    ]
      .filter(Boolean)
      .join(' ')
    const hexFromRaw = String(requestBlob).match(/[0-9a-fA-F]{24}/)?.[0] || null
    const isId = /^[0-9a-fA-F]{24}$/.test(rawIdOrSlug) || /^[0-9a-fA-F]{24}$/.test(decoded)
    const targetId = isId ? (rawIdOrSlug.length === 24 ? rawIdOrSlug : decoded) : hexFromRaw

    const slugCandidates = [...new Set([rawIdOrSlug, decoded].filter(Boolean))]
    let article = null
    const ogSelect = 'title titleEn slug excerpt excerptEn metaDescription image publishedAt author body'
    if (targetId) {
      article = await Article.findOne({ _id: targetId }).select(ogSelect).lean()
    }
    if (!article) {
      article = await Article.findOne({
        $or: [
          { slug: { $in: slugCandidates } },
          { title: { $in: slugCandidates } },
          { titleEn: { $in: slugCandidates } },
        ],
      })
        .select(ogSelect)
        .lean()
    }

    if (!article && targetId) {
      const op = await Opinion.findById(targetId).lean()
      if (op) {
        article = {
          _id: op._id,
          title: op.title,
          titleEn: op.titleEn,
          excerpt: op.details ? op.details.slice(0, 160) : '',
          body: op.details || '',
          image: op.image || '',
          slug: String(op._id),
          publishedAt: op.createdAt,
        }
      }
    }

    const baseHtml = getBaseHtml()
    res.set('X-KK-OG-Lookup', String(targetId || rawIdOrSlug || '').slice(0, 80))
    res.set('X-KK-OG-Found', article ? '1' : '0')
    if (!article) {
      return res.status(200).type('html').send(baseHtml)
    }

    const siteUrl = getProductionSiteUrl(req)

    const requestUrl = [req.originalUrl, req.url, req.headers['x-vercel-original-url'], req.headers['x-invoke-path']]
      .filter(Boolean)
      .join(' ')
    const isEn =
      req.query.lang === 'en' ||
      /[?&]lang=en(?:&|$)/.test(requestUrl) ||
      (req.headers.cookie && req.headers.cookie.includes('kk_lang=en'))

    const siteName = isEn ? 'Krishi Kagoj' : 'কৃষিকাগজ'
    const activeTitle = (isEn && article.titleEn ? article.titleEn : article.title) || siteName
    const pageTitle = `${activeTitle} | ${siteName}`

    const desc = getCleanOgDescription(article, isEn)
    const cleanSlug = getCleanArticleSlug(article)
    const canonicalUrl = isEn
      ? `${siteUrl}/news/${cleanSlug}?lang=en`
      : `${siteUrl}/news/${cleanSlug}`

    const { imgUrl, imageType } = await resolveShareImage(article.image, siteUrl)
    res.set('X-KK-OG-Image', String(imgUrl || '').slice(0, 200))

    let html = baseHtml

    // Title
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(pageTitle)}</title>`)

    // Description
    if (html.includes('name="description"')) {
      html = html.replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${escapeAttr(desc)}" />`,
      )
    } else {
      html = html.replace(
        '</head>',
        `<meta name="description" content="${escapeAttr(desc)}" />\n</head>`,
      )
    }

    // Canonical
    if (html.includes('rel="canonical"')) {
      html = html.replace(
        /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
        `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`,
      )
    } else {
      html = html.replace(
        '</head>',
        `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />\n</head>`,
      )
    }

    // Strip existing static OG and Twitter tags to prevent duplicates
    html = html.replace(/<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")\s+content="[^"]*"\s*\/?>\s*/gi, '')

    // Open Graph & Twitter meta tags to inject
    const logoUrl = `${siteUrl}/logo.png`
    const faviconUrl = `${siteUrl}/api/settings/favicon`
    const dynamicTags = [
      `<link rel="icon" href="${escapeAttr(faviconUrl)}" />`,
      `<link rel="shortcut icon" href="${escapeAttr(faviconUrl)}" />`,
      `<link rel="apple-touch-icon" href="${escapeAttr(faviconUrl)}" />`,
      `<meta property="og:site_name" content="${escapeAttr(siteName)}" />`,
      `<meta property="og:logo" content="${escapeAttr(logoUrl)}" />`,
      `<meta property="og:type" content="article" />`,
      `<meta property="og:title" content="${escapeAttr(activeTitle)}" />`,
      `<meta property="og:description" content="${escapeAttr(desc)}" />`,
      `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
      `<meta property="og:image" content="${escapeAttr(imgUrl)}" />`,
      `<meta property="og:image:secure_url" content="${escapeAttr(imgUrl)}" />`,
      `<meta property="og:image:type" content="${imageType}" />`,
      imgUrl.includes('images.unsplash.com') ? `<meta property="og:image:width" content="1200" />` : '',
      imgUrl.includes('images.unsplash.com') ? `<meta property="og:image:height" content="630" />` : '',
      `<meta property="og:image:alt" content="${escapeAttr(activeTitle)}" />`,
      `<meta property="og:locale" content="${isEn ? 'en_US' : 'bn_BD'}" />`,
      `<link rel="image_src" href="${escapeAttr(imgUrl)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeAttr(activeTitle)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(desc)}" />`,
      `<meta name="twitter:image" content="${escapeAttr(imgUrl)}" />`,
      article.publishedAt ? `<meta property="article:published_time" content="${new Date(article.publishedAt).toISOString()}" />` : '',
    ].filter(Boolean).join('\n    ')

    html = html.replace(/<link\s+rel="(?:shortcut )?icon"[^>]*>\s*/gi, '')
    html = html.replace(/<link\s+rel="apple-touch-icon"[^>]*>\s*/gi, '')
    html = html.replace('</head>', `    ${dynamicTags}\n  </head>`)

    res.set('Cache-Control', 'public, max-age=0, s-maxage=0, must-revalidate')
    res.set('Vary', 'Cookie, Accept-Language')
    return res.status(200).type('html').send(html)
  } catch (err) {
    console.error('SSR OG Meta Error:', err)
    return res.status(200).type('html').send(getBaseHtml())
  }
}
