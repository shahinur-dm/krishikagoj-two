import { Router } from 'express'
import multer from 'multer'
import Article from '../models/Article.js'
import Category from '../models/Category.js'
import Subcategory from '../models/Subcategory.js'
import Media from '../models/Media.js'
import { requireAuth, requirePermission, canSeeAllPosts } from '../middleware/auth.js'
import { ARTICLE_LIST_SELECT, ARTICLE_DETAIL_SELECT } from '../utils/articleFields.js'
import { cacheDel, cacheGet, cacheSet } from '../utils/cache.js'
import { applyArticleSeoDefaults, slugify } from '../utils/seoContent.js'
import Opinion from '../models/Opinion.js'
import SiteSetting from '../models/SiteSetting.js'
import { translateArticleFields } from '../utils/translator.js'
import { renderArticleOgHtml } from '../utils/ssrOgMeta.js'

const router = Router()

const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
})

const WRITE_FIELDS = [
  'title',
  'titleEn',
  'slug',
  'excerpt',
  'excerptEn',
  'metaDescription',
  'body',
  'bodyEn',
  'image',
  'imageCaption',
  'images',
  'showImageInDetails',
  'tags',
  'author',
  'category',
  'subcategory',
  'printViewLink',
  'headline',
  'bigthumbnail',
  'firstSection',
  'firstSectionThumbnail',
  'categoryHomepage',
  'featured',
  'latest',
  'popular',
  'publishedAt',
  'isPublished',
]

function pickWriteFields(body) {
  const src = { ...body }
  if (src.meta_description != null && src.metaDescription == null) {
    src.metaDescription = src.meta_description
  }
  const data = {}
  for (const key of WRITE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, key)) data[key] = src[key]
  }
  return data
}

async function resolveCategoryId(category) {
  if (!category) return null
  if (String(category).match(/^[0-9a-fA-F]{24}$/)) return category
  const cacheKey = `catslug:${category}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached
  const cat = await Category.findOne({ slug: category, isActive: true }).select('_id').lean()
  if (!cat) return null
  cacheSet(cacheKey, String(cat._id), 300_000)
  return String(cat._id)
}

async function resolveSubcategoryId(subcategory, categoryId) {
  if (!subcategory) return null
  if (String(subcategory).match(/^[0-9a-fA-F]{24}$/)) return subcategory
  const filter = { slug: subcategory, isActive: true }
  if (categoryId) filter.category = categoryId
  const sub = await Subcategory.findOne(filter).select('_id').lean()
  return sub ? String(sub._id) : null
}

async function assertSubcategoryBelongs(categoryId, subcategoryId) {
  if (!subcategoryId) return null
  const sub = await Subcategory.findById(subcategoryId).select('category').lean()
  if (!sub) throw new Error('Subcategory not found')
  if (String(sub.category) !== String(categoryId)) {
    throw new Error('Subcategory does not belong to selected category')
  }
  return subcategoryId
}

function canEditArticle(user, article) {
  if (canSeeAllPosts(user)) return true
  const authorId = article.authorUser?._id || article.authorUser
  if (!authorId) return false
  return String(authorId) === String(user._id)
}

function bustCaches() {
  cacheDel('home')
  cacheDel('articles')
  cacheDel('categories')
  cacheDel('catslug')
}

function populateArticle(q) {
  return q
    .populate('category', 'name nameEn slug')
    .populate('subcategory', 'nameBn nameEn slug')
    .populate('authorUser', 'name email')
}

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')

    const {
      category,
      subcategory,
      featured,
      headline,
      latest,
      popular,
      limit,
      q,
      skip,
      exclude,
      excludeCategory,
    } = req.query
    const filter = { isPublished: { $ne: false } }
    const lim = Math.min(Number(limit) || 20, 100)
    const skipN = Math.max(0, Number(skip) || 0)
    const excludeIds = String(exclude || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^[0-9a-fA-F]{24}$/.test(id))

    const usePaging = skipN > 0 || excludeIds.length > 0 || Boolean(excludeCategory)
    const cacheKey = `articles:${JSON.stringify({
      category,
      subcategory,
      featured,
      headline,
      latest,
      popular,
      lim,
      q,
      skipN,
      excludeIds,
      excludeCategory,
    })}`
    if (!usePaging) {
      const cached = cacheGet(cacheKey)
      if (cached) {
        res.set('Cache-Control', 'public, max-age=5, s-maxage=15')
        return res.json(cached)
      }
    }

    let catId = null
    if (category) {
      catId = await resolveCategoryId(category)
      if (!catId) return res.json([])
      filter.category = catId
    } else if (excludeCategory) {
      const excludeCatId = await resolveCategoryId(excludeCategory)
      if (excludeCatId) filter.category = { $ne: excludeCatId }
    }

    if (subcategory) {
      const subId = await resolveSubcategoryId(subcategory, catId)
      if (!subId) return res.json([])
      filter.subcategory = subId
    }

    if (excludeIds.length) {
      filter._id = { $nin: excludeIds }
    }

    if (featured === 'true') filter.featured = true
    if (headline === 'true') filter.headline = true
    if (latest === 'true') filter.latest = true
    if (popular === 'true') filter.popular = true
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { excerpt: { $regex: q, $options: 'i' } },
      ]
    }

    const articles = await populateArticle(
      Article.find(filter)
        .select(ARTICLE_LIST_SELECT)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skipN)
        .limit(lim),
    ).lean()

    if (!usePaging) cacheSet(cacheKey, articles, 45_000)
    res.set('Cache-Control', usePaging ? 'no-store' : 'public, max-age=5, s-maxage=15')
    res.json(articles)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/admin/all', requireAuth, requirePermission('post', 'allpost'), async (req, res) => {
  try {
    const filter = {}
    if (!canSeeAllPosts(req.user)) filter.authorUser = req.user._id
    const articles = await populateArticle(
      Article.find(filter).select(ARTICLE_LIST_SELECT).sort({ createdAt: -1 }),
    ).lean()
    res.json(articles)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/admin/backup', requireAuth, requirePermission('post', 'allpost'), async (req, res) => {
  try {
    const filter = {}
    if (!canSeeAllPosts(req.user)) filter.authorUser = req.user._id

    const { from, to } = req.query
    if (from || to) {
      const dateFilter = {}
      if (from) {
        const fDate = new Date(`${from}T00:00:00.000Z`)
        if (!Number.isNaN(fDate.getTime())) {
          dateFilter.$gte = fDate
        }
      }
      if (to) {
        const tDate = new Date(`${to}T23:59:59.999Z`)
        if (!Number.isNaN(tDate.getTime())) {
          dateFilter.$lte = tDate
        }
      }
      if (Object.keys(dateFilter).length > 0) {
        filter.$or = [{ publishedAt: dateFilter }, { createdAt: dateFilter }]
      }
    }

    const articles = await Article.find(filter)
      .populate('category', 'name nameEn slug')
      .populate('subcategory', 'nameBn nameEn slug')
      .populate('authorUser', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    const mediaIdSet = new Set()
    for (const art of articles) {
      if (art.image && typeof art.image === 'string') {
        const match = art.image.match(/\/api\/media\/([0-9a-fA-F]{24})/)
        if (match) mediaIdSet.add(match[1])
      }
      if (Array.isArray(art.images)) {
        for (const img of art.images) {
          if (typeof img === 'string') {
            const match = img.match(/\/api\/media\/([0-9a-fA-F]{24})/)
            if (match) mediaIdSet.add(match[1])
          }
        }
      }
      if (art.body && typeof art.body === 'string') {
        const bodyMatches = art.body.matchAll(/\/api\/media\/([0-9a-fA-F]{24})/g)
        for (const m of bodyMatches) {
          if (m[1]) mediaIdSet.add(m[1])
        }
      }
      if (art.bodyEn && typeof art.bodyEn === 'string') {
        const bodyEnMatches = art.bodyEn.matchAll(/\/api\/media\/([0-9a-fA-F]{24})/g)
        for (const m of bodyEnMatches) {
          if (m[1]) mediaIdSet.add(m[1])
        }
      }
    }

    let mediaDocs = []
    if (mediaIdSet.size > 0) {
      mediaDocs = await Media.find({ _id: { $in: [...mediaIdSet] } }).lean()
    }

    const exportedMedia = mediaDocs.map((doc) => {
      let base64Data = null
      if (doc.data) {
        const buf = doc.data.buffer || doc.data
        base64Data = Buffer.from(buf).toString('base64')
      }
      return {
        _id: String(doc._id),
        filename: doc.filename || 'image',
        mimeType: doc.mimeType || 'image/jpeg',
        size: doc.size || (base64Data ? base64Data.length : 0),
        provider: doc.provider || 'local',
        url: doc.url || '',
        secureUrl: doc.secureUrl || '',
        publicId: doc.publicId || '',
        dataBase64: base64Data,
        createdAt: doc.createdAt,
      }
    })

    const dateStr = new Date().toISOString().slice(0, 10)
    const backupPayload = {
      version: '1.0',
      system: 'krishikagoj-news-backup',
      exportedAt: new Date().toISOString(),
      dateRange: {
        from: from || null,
        to: to || null,
      },
      postCount: articles.length,
      mediaCount: exportedMedia.length,
      posts: articles,
      media: exportedMedia,
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="krishikagoj-news-backup-${dateStr}.json"`)
    res.json(backupPayload)
  } catch (err) {
    console.error('Backup error:', err)
    res.status(500).json({ message: err.message || 'ব্যাকআপ তৈরি ব্যর্থ হয়েছে' })
  }
})

router.post(
  '/admin/restore',
  requireAuth,
  requirePermission('post', 'allpost'),
  backupUpload.single('file'),
  async (req, res) => {
    try {
      let rawPayload = null
      if (req.file?.buffer) {
        try {
          rawPayload = JSON.parse(req.file.buffer.toString('utf-8'))
        } catch (parseErr) {
          return res.status(400).json({ message: 'ব্যাকআপ ফাইলটি সঠিক JSON ফরম্যাটে নেই (Invalid JSON file)' })
        }
      } else if (req.body && (req.body.posts || Array.isArray(req.body))) {
        rawPayload = req.body
      } else {
        return res.status(400).json({ message: 'কোনো ব্যাকআপ ফাইল পাওয়া যায়নি (No backup file uploaded)' })
      }

      const postsToRestore = Array.isArray(rawPayload.posts)
        ? rawPayload.posts
        : Array.isArray(rawPayload)
          ? rawPayload
          : null

      if (!postsToRestore || postsToRestore.length === 0) {
        return res.status(400).json({ message: 'ব্যাকআপ ফাইলে কোনো পোস্ট ডাটা পাওয়া যায়নি (No posts found in backup)' })
      }

      const mediaToRestore = Array.isArray(rawPayload.media) ? rawPayload.media : []

      // 1. Restore Media items with bulkWrite
      let restoredMediaCount = 0
      const mediaOps = []
      for (const m of mediaToRestore) {
        if (m._id && /^[0-9a-fA-F]{24}$/.test(m._id) && m.dataBase64) {
          try {
            const buffer = Buffer.from(m.dataBase64, 'base64')
            mediaOps.push({
              updateOne: {
                filter: { _id: m._id },
                update: {
                  $set: {
                    filename: m.filename || 'restored-image',
                    mimeType: m.mimeType || 'image/jpeg',
                    size: m.size || buffer.length,
                    data: buffer,
                    provider: m.provider || 'local',
                    url: m.url || '',
                    secureUrl: m.secureUrl || '',
                    publicId: m.publicId || '',
                    uploadedBy: req.user._id,
                  },
                },
                upsert: true,
              },
            })
          } catch (mErr) {
            console.warn('Failed parsing media item:', m._id, mErr.message)
          }
        }
      }
      if (mediaOps.length > 0) {
        const mRes = await Media.bulkWrite(mediaOps, { ordered: false })
        restoredMediaCount = (mRes.upsertedCount || 0) + (mRes.modifiedCount || 0) + (mRes.matchedCount || 0)
      }

      // 2. Categories & subcategories mapping
      const categoryMap = new Map()
      const allCats = await Category.find().lean()
      for (const cat of allCats) {
        categoryMap.set(String(cat._id), cat)
        if (cat.slug) categoryMap.set(cat.slug.toLowerCase(), cat)
        if (cat.name) categoryMap.set(cat.name.trim().toLowerCase(), cat)
      }

      const subcategoryMap = new Map()
      const allSubs = await Subcategory.find().lean()
      for (const sub of allSubs) {
        subcategoryMap.set(String(sub._id), sub)
        const key = `${sub.category}:${(sub.slug || sub.nameBn || '').toLowerCase()}`
        subcategoryMap.set(key, sub)
      }

      // 3. Pre-fetch existing articles to detect duplicates by _id or slug
      const postIds = postsToRestore
        .map((p) => p._id)
        .filter((id) => id && /^[0-9a-fA-F]{24}$/.test(id))
      const postSlugs = postsToRestore
        .map((p) => (p.slug ? String(p.slug).trim().toLowerCase() : p.title ? slugify(p.title) : null))
        .filter(Boolean)

      const existingArticles = await Article.find({
        $or: [{ _id: { $in: postIds } }, { slug: { $in: postSlugs } }],
      })
        .select('_id slug')
        .lean()

      const existingIdMap = new Map()
      const existingSlugMap = new Map()
      for (const art of existingArticles) {
        existingIdMap.set(String(art._id), art._id)
        if (art.slug) existingSlugMap.set(art.slug.toLowerCase(), art._id)
      }

      let createdCount = 0
      let updatedCount = 0
      let failedCount = 0
      const articleOps = []

      for (const post of postsToRestore) {
        if (!post.title) {
          failedCount++
          continue
        }

        try {
          // Resolve Category
          let targetCatId = null
          const catData = post.category
          if (catData) {
            if (typeof catData === 'object' && catData !== null) {
              const cId = catData._id ? String(catData._id) : null
              const cSlug = catData.slug ? String(catData.slug).toLowerCase() : null
              const cName = catData.name ? String(catData.name).trim().toLowerCase() : null

              let foundCat =
                (cId && categoryMap.get(cId)) ||
                (cSlug && categoryMap.get(cSlug)) ||
                (cName && categoryMap.get(cName))

              if (!foundCat && catData.name) {
                const newSlug = catData.slug || slugify(catData.name)
                const newCat = await Category.create({
                  ...(cId && /^[0-9a-fA-F]{24}$/.test(cId) ? { _id: cId } : {}),
                  name: catData.name,
                  nameEn: catData.nameEn || '',
                  slug: newSlug,
                  isActive: true,
                })
                categoryMap.set(String(newCat._id), newCat)
                if (newCat.slug) categoryMap.set(newCat.slug.toLowerCase(), newCat)
                if (newCat.name) categoryMap.set(newCat.name.trim().toLowerCase(), newCat)
                foundCat = newCat
              }
              if (foundCat) targetCatId = foundCat._id
            } else if (typeof catData === 'string') {
              const foundCat = categoryMap.get(catData) || categoryMap.get(catData.toLowerCase())
              if (foundCat) targetCatId = foundCat._id
              else if (/^[0-9a-fA-F]{24}$/.test(catData)) targetCatId = catData
            }
          }

          if (!targetCatId) {
            const defaultCat = allCats[0] || (await Category.findOne().lean())
            if (defaultCat) targetCatId = defaultCat._id
          }

          if (!targetCatId) {
            const defaultCat = await Category.create({
              name: 'জাতীয়',
              nameEn: 'National',
              slug: 'national',
              isActive: true,
            })
            categoryMap.set(String(defaultCat._id), defaultCat)
            targetCatId = defaultCat._id
          }

          // Resolve Subcategory
          let targetSubId = null
          const subData = post.subcategory
          if (subData && targetCatId) {
            if (typeof subData === 'object' && subData !== null) {
              const sId = subData._id ? String(subData._id) : null
              const sSlug = subData.slug ? String(subData.slug).toLowerCase() : null
              const sName = subData.nameBn ? String(subData.nameBn).trim().toLowerCase() : null

              let foundSub =
                (sId && subcategoryMap.get(sId)) ||
                subcategoryMap.get(`${targetCatId}:${sSlug}`) ||
                subcategoryMap.get(`${targetCatId}:${sName}`)

              if (!foundSub && (subData.nameBn || subData.slug)) {
                const newSlug = subData.slug || slugify(subData.nameBn || 'sub')
                const newSub = await Subcategory.create({
                  ...(sId && /^[0-9a-fA-F]{24}$/.test(sId) ? { _id: sId } : {}),
                  category: targetCatId,
                  nameBn: subData.nameBn || subData.name || 'সাবক্যাটাগরি',
                  nameEn: subData.nameEn || '',
                  slug: newSlug,
                  isActive: true,
                })
                subcategoryMap.set(String(newSub._id), newSub)
                subcategoryMap.set(`${targetCatId}:${newSlug.toLowerCase()}`, newSub)
                foundSub = newSub
              }
              if (foundSub) targetSubId = foundSub._id
            } else if (typeof subData === 'string') {
              const foundSub =
                subcategoryMap.get(subData) || subcategoryMap.get(`${targetCatId}:${subData.toLowerCase()}`)
              if (foundSub) targetSubId = foundSub._id
              else if (/^[0-9a-fA-F]{24}$/.test(subData)) targetSubId = subData
            }
          }

          const slugValue = post.slug ? String(post.slug).trim().toLowerCase() : slugify(post.title)

          const articleDoc = {
            title: post.title,
            titleEn: post.titleEn || '',
            slug: slugValue,
            excerpt: post.excerpt || '',
            excerptEn: post.excerptEn || '',
            metaDescription: post.metaDescription || post.meta_description || '',
            body: post.body || '',
            bodyEn: post.bodyEn || '',
            image: post.image || '',
            imageCaption: post.imageCaption || '',
            images: Array.isArray(post.images) ? post.images : [],
            showImageInDetails: post.showImageInDetails !== false,
            tags: post.tags || '',
            author: post.author || 'কৃষি ডেস্ক',
            authorUser:
              post.authorUser?._id && /^[0-9a-fA-F]{24}$/.test(post.authorUser._id)
                ? post.authorUser._id
                : req.user._id,
            category: targetCatId,
            subcategory: targetSubId || undefined,
            printViewLink: post.printViewLink || '',
            views: typeof post.views === 'number' ? post.views : 0,
            headline: Boolean(post.headline),
            bigthumbnail: Boolean(post.bigthumbnail),
            firstSection: Boolean(post.firstSection),
            firstSectionThumbnail: Boolean(post.firstSectionThumbnail),
            categoryHomepage: Boolean(post.categoryHomepage),
            featured: Boolean(post.featured),
            latest: post.latest !== false,
            popular: Boolean(post.popular),
            publishedAt: post.publishedAt ? new Date(post.publishedAt) : new Date(),
            createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
            isPublished: post.isPublished !== false,
            facebookPostId: post.facebookPostId || '',
            facebookPostStatus: post.facebookPostStatus || 'idle',
            facebookPostedAt: post.facebookPostedAt ? new Date(post.facebookPostedAt) : undefined,
          }

          const matchedExistingId =
            (post._id && existingIdMap.get(String(post._id))) || (slugValue && existingSlugMap.get(slugValue))

          if (matchedExistingId) {
            articleOps.push({
              updateOne: {
                filter: { _id: matchedExistingId },
                update: { $set: articleDoc },
              },
            })
            updatedCount++
          } else {
            if (post._id && /^[0-9a-fA-F]{24}$/.test(post._id)) {
              articleDoc._id = post._id
            }
            articleOps.push({
              insertOne: {
                document: articleDoc,
              },
            })
            createdCount++
          }
        } catch (postErr) {
          console.error('Error preparing post item:', post.title, postErr.message)
          failedCount++
        }
      }

      if (articleOps.length > 0) {
        await Article.bulkWrite(articleOps, { ordered: false })
      }

      bustCaches()

      return res.json({
        success: true,
        message: `ব্যাকআপ সফলভাবে রিস্টোর সম্পন্ন হয়েছে। মোট পোস্ট: ${createdCount + updatedCount} (নতুন: ${createdCount}, আপডেট: ${updatedCount}, মিডিয়া: ${restoredMediaCount})`,
        stats: {
          total: createdCount + updatedCount,
          created: createdCount,
          updated: updatedCount,
          mediaRestored: restoredMediaCount,
          failed: failedCount,
        },
      })
    } catch (err) {
      console.error('Restore endpoint error:', err)
      return res.status(500).json({ message: err.message || 'ব্যাকআপ রিস্টোর ব্যর্থ হয়েছে' })
    }
  },
)

router.get('/admin/:id', requireAuth, requirePermission('post', 'allpost'), async (req, res) => {
  try {
    const article = await populateArticle(
      Article.findById(req.params.id).select(ARTICLE_DETAIL_SELECT),
    ).lean()
    if (!article) return res.status(404).json({ message: 'Article not found' })
    if (!canEditArticle(req.user, article)) {
      return res.status(403).json({ message: 'You can only view your own posts' })
    }
    res.json(article)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/og/:idOrSlug', async (req, res) => {
  return renderArticleOgHtml(req, res, req.params.idOrSlug)
})

router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params
    const isId = /^[0-9a-fA-F]{24}$/.test(idOrSlug)
    let article = await populateArticle(
      isId
        ? Article.findOne({ _id: idOrSlug, isPublished: true }).select(ARTICLE_DETAIL_SELECT)
        : Article.findOne({ slug: idOrSlug, isPublished: true }).select(ARTICLE_DETAIL_SELECT),
    ).lean()

    if (!article && isId) {
      const opinion = await Opinion.findById(idOrSlug).lean()
      if (opinion) {
        article = {
          _id: opinion._id,
          title: opinion.title,
          titleEn: '',
          slug: String(opinion._id),
          body: opinion.details || '',
          bodyEn: '',
          excerpt: opinion.details ? opinion.details.slice(0, 160) : '',
          excerptEn: '',
          image: opinion.image || '',
          author: opinion.name,
          authorImage: opinion.image || '',
          category: { name: 'মতামত', nameEn: 'Opinion', slug: 'motamot' },
          subcategory: { nameBn: 'মতামত', slug: 'motamot' },
          publishedAt: opinion.createdAt,
          createdAt: opinion.createdAt,
          isPublished: opinion.status === 'published',
          views: 1,
        }
      }
    }

    if (!article) return res.status(404).json({ message: 'Article not found' })

    if (article._id && !article.category?.nameEn) {
      Article.updateOne({ _id: article._id }, { $inc: { views: 1 } }).exec().catch(() => {})
    }

    if (req.query.lang === 'en' && article && article._id && !article.bodyEn && article.body) {
      try {
        const trans = await translateArticleFields({
          title: article.title,
          excerpt: article.excerpt,
          body: article.body,
        })
        if (trans.titleEn) article.titleEn = trans.titleEn
        if (trans.excerptEn) article.excerptEn = trans.excerptEn
        if (trans.bodyEn) article.bodyEn = trans.bodyEn
        Article.updateOne({ _id: article._id }, { $set: trans }).exec().catch(() => {})
      } catch (transErr) {
        console.warn('On-demand translation failed:', transErr.message)
      }
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')
    res.json({ ...article, views: (article.views || 0) + 1 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/', requireAuth, requirePermission('post'), async (req, res) => {
  try {
    let data = applyArticleSeoDefaults(pickWriteFields(req.body), { isCreate: true })
    data.authorUser = req.user._id
    if (!data.category) return res.status(400).json({ message: 'Category is required' })
    data.subcategory = (await assertSubcategoryBelongs(data.category, data.subcategory || null)) || undefined
    if (!data.subcategory) delete data.subcategory

    if (data.title && (!data.titleEn || !data.bodyEn)) {
      try {
        const trans = await translateArticleFields({
          title: data.title,
          excerpt: data.excerpt,
          body: data.body,
        })
        if (!data.titleEn && trans.titleEn) data.titleEn = trans.titleEn
        if (!data.excerptEn && trans.excerptEn) data.excerptEn = trans.excerptEn
        if (!data.bodyEn && trans.bodyEn) data.bodyEn = trans.bodyEn
      } catch (tErr) {
        console.warn('Auto translation on create article failed:', tErr.message)
      }
    }

    const article = await Article.create(data)
    const populated = await populateArticle(Article.findById(article._id)).lean()
    bustCaches()
    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

router.put('/:id', requireAuth, requirePermission('post'), async (req, res) => {
  try {
    const existing = await Article.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Article not found' })
    if (!canEditArticle(req.user, existing)) {
      return res.status(403).json({ message: 'You can only edit your own posts' })
    }

    const data = applyArticleSeoDefaults(pickWriteFields(req.body), { isCreate: false })
    if (!data.excerpt && !existing.excerpt && (data.body || existing.body)) {
      data.excerpt = applyArticleSeoDefaults(
        { body: data.body || existing.body },
        { isCreate: false },
      ).excerpt
    }
    // Keep slug stable on edit unless explicitly provided
    if (!data.slug) delete data.slug
    const categoryId = data.category || existing.category
    if (Object.prototype.hasOwnProperty.call(data, 'subcategory')) {
      if (data.subcategory === '' || data.subcategory === null) {
        data.subcategory = null
      } else if (data.subcategory) {
        data.subcategory = await assertSubcategoryBelongs(categoryId, data.subcategory)
      }
    }

    const titleChanged = data.title && data.title !== existing.title
    const bodyChanged = data.body && data.body !== existing.body
    const excerptChanged = data.excerpt !== undefined && data.excerpt !== existing.excerpt
    if (titleChanged || bodyChanged || excerptChanged || (!existing.titleEn && (data.title || existing.title))) {
      try {
        const trans = await translateArticleFields({
          title: data.title || existing.title,
          excerpt: data.excerpt !== undefined ? data.excerpt : existing.excerpt,
          body: data.body || existing.body,
        })
        if (trans.titleEn && (!data.titleEn || titleChanged)) data.titleEn = trans.titleEn
        if (trans.excerptEn && (!data.excerptEn || excerptChanged)) data.excerptEn = trans.excerptEn
        if (trans.bodyEn && (!data.bodyEn || bodyChanged)) data.bodyEn = trans.bodyEn
      } catch (tErr) {
        console.warn('Auto translation on update article failed:', tErr.message)
      }
    }

    const article = await populateArticle(
      Article.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }),
    ).lean()

    bustCaches()
    res.json(article)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

async function handleBulkDelete(req, res) {
  try {
    const rawIds = req.body?.ids || req.body?.articleIds
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ message: 'মুছে ফেলার জন্য অন্তত একটি পোস্ট নির্বাচন করুন' })
    }

    const validIds = rawIds
      .map((id) => String(id || '').trim())
      .filter((id) => /^[0-9a-fA-F]{24}$/.test(id))

    if (validIds.length === 0) {
      return res.status(400).json({ message: 'সঠিক পোস্ট আইডি পাওয়া যায়নি' })
    }

    const filter = { _id: { $in: validIds } }
    if (!canSeeAllPosts(req.user)) {
      filter.authorUser = req.user._id
    }

    const deleteResult = await Article.deleteMany(filter)
    bustCaches()

    return res.json({
      success: true,
      message: `${deleteResult.deletedCount} টি পোস্ট সফলভাবে মুছে ফেলা হয়েছে`,
      deletedCount: deleteResult.deletedCount,
    })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'পোস্ট মুছে ফেলতে সমস্যা হয়েছে' })
  }
}

router.delete('/bulk', requireAuth, requirePermission('post'), handleBulkDelete)
router.post('/bulk-delete', requireAuth, requirePermission('post'), handleBulkDelete)

router.delete('/:id', requireAuth, requirePermission('post'), async (req, res) => {
  try {
    const existing = await Article.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Article not found' })
    if (!canEditArticle(req.user, existing)) {
      return res.status(403).json({ message: 'You can only delete your own posts' })
    }
    await Article.findByIdAndDelete(req.params.id)
    bustCaches()
    res.json({ message: 'Article deleted', id: existing._id })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

function stripHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

router.post('/admin/:id/facebook-post', requireAuth, requirePermission('post', 'allpost'), async (req, res) => {
  try {
    const settings = await SiteSetting.findOne({ key: 'site' }).lean()
    const pageId = settings?.facebookPageId || process.env.FACEBOOK_PAGE_ID || ''
    const accessToken = settings?.facebookPageAccessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || ''

    if (!pageId || !accessToken) {
      return res.status(400).json({
        message: 'Facebook Page ID অথবা Page Access Token কনফিগার করা নেই। অনুগ্রহ করে Admin Panel > Facebook Settings-এ গিয়ে অথবা সার্ভার .env ফাইলে Page ID ও Access Token যুক্ত করুন।',
      })
    }

    const article = await Article.findById(req.params.id).populate('category subcategory')
    if (!article) {
      return res.status(404).json({ message: 'Article not found' })
    }

    if (!canEditArticle(req.user, article)) {
      return res.status(403).json({ message: 'You can only publish your own posts to Facebook' })
    }

    if (article.isPublished === false) {
      return res.status(400).json({ message: 'ড্রাফট পোস্ট ফেসবুকে প্রকাশ করা যাবে না। প্রথমে পোস্টটি পাবলিশ করুন।' })
    }

    const rawHost = req.get('x-forwarded-host') || req.get('host') || 'localhost:5050'
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http'
    const defaultSiteUrl = `${proto}://${rawHost}`
    const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || defaultSiteUrl).replace(/\/$/, '')
    const articleUrl = `${siteUrl}/news/${article.slug || article._id}`

    const excerpt = article.excerpt || stripHtml(article.body).slice(0, 220)
    let caption = `${article.title}`
    if (excerpt) {
      caption += `\n\n${excerpt}`
    }
    caption += `\n\nপুরো article পড়তে:\n${articleUrl}\n\n#কৃষিকাগজ #কৃষি`

    let imageUrl = article.image || ''
    if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      imageUrl = `${siteUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`
    }

    let fbRes
    let fbData
    let postedSuccess = false

    // If there is an absolute image URL, try photo post
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      try {
        const fbEndpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`
        fbRes = await fetch(fbEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: imageUrl,
            caption: caption,
            access_token: accessToken,
          }),
          signal: AbortSignal.timeout(15000),
        })
        fbData = await fbRes.json().catch(() => ({}))
        if (fbRes.ok && !fbData?.error && (fbData?.id || fbData?.post_id)) {
          postedSuccess = true
        }
      } catch (err) {
        console.warn('Photo post request error, trying feed link post:', err.message)
      }
    }

    // Fallback to feed link post if photo post wasn't successful or no image
    if (!postedSuccess) {
      try {
        const fbEndpoint = `https://graph.facebook.com/v19.0/${pageId}/feed`
        fbRes = await fetch(fbEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: caption,
            link: articleUrl,
            access_token: accessToken,
          }),
          signal: AbortSignal.timeout(15000),
        })
        fbData = await fbRes.json().catch(() => ({}))
        if (fbRes.ok && !fbData?.error && (fbData?.id || fbData?.post_id)) {
          postedSuccess = true
        }
      } catch (err) {
        console.warn('Feed post request error:', err.message)
      }
    }

    if (!postedSuccess || fbData?.error) {
      const errMsg =
        fbData?.error?.message ||
        fbData?.error?.error_user_msg ||
        (fbRes?.status ? `HTTP ${fbRes.status}` : 'Connection timed out or failed')
      await Article.findByIdAndUpdate(article._id, {
        facebookPostStatus: 'failed',
      })
      return res.status(400).json({
        message: `Facebook-এ পোস্ট করা যায়নি। Page connection/token/API configuration পরীক্ষা করুন। (${errMsg})`,
        error: fbData?.error || { message: errMsg },
      })
    }

    const fbPostId = String(fbData.id || fbData.post_id || '')
    const updated = await Article.findByIdAndUpdate(
      article._id,
      {
        facebookPostId: fbPostId,
        facebookPostStatus: 'posted',
        facebookPostedAt: new Date(),
      },
      { new: true },
    )

    bustCaches()

    return res.json({
      success: true,
      message: 'Facebook-এ সফলভাবে পোস্ট হয়েছে',
      facebookPostId: updated.facebookPostId,
      facebookPostStatus: updated.facebookPostStatus,
      facebookPostedAt: updated.facebookPostedAt,
    })
  } catch (err) {
    console.error('Facebook post error:', err)
    return res.status(500).json({ message: err.message || 'ফেসবুক পোস্ট করার সময় অভ্যন্তরীণ সমস্যা হয়েছে' })
  }
})

export default router
