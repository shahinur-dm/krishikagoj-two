import { Router } from 'express'
import Category from '../models/Category.js'
import Subcategory from '../models/Subcategory.js'
import Article from '../models/Article.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { cacheGet, cacheSet, cacheDel } from '../utils/cache.js'
import { makeSlug } from '../utils/slug.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const cached = cacheGet('categories:active')
    if (cached) {
      res.set('Cache-Control', 'public, max-age=60, s-maxage=120')
      return res.json(cached)
    }
    const categories = await Category.find({ isActive: true }).sort({ order: 1, name: 1 }).lean()
    cacheSet('categories:active', categories, 180_000)
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120')
    res.json(categories)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/all', requireAuth, requirePermission('category', 'post'), async (_req, res) => {
  try {
    const categories = await Category.find().sort({ order: 1, name: 1 }).lean()
    res.json(categories)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params
    const category = idOrSlug.match(/^[0-9a-fA-F]{24}$/)
      ? await Category.findOne({ _id: idOrSlug, isActive: true }).lean()
      : await Category.findOne({ slug: idOrSlug, isActive: true }).lean()
    if (!category) return res.status(404).json({ message: 'Category not found' })
    res.json(category)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/', requireAuth, requirePermission('category'), async (req, res) => {
  try {
    const body = req.body || {}
    const name = String(body.name || body.nameBn || '').trim()
    if (!name) return res.status(400).json({ message: 'ক্যাটাগরির নাম আবশ্যক' })
    const slug = String(body.slug || '').trim().toLowerCase() || makeSlug(body.nameEn, name, 'category')
    const category = await Category.create({
      name,
      nameEn: String(body.nameEn || '').trim(),
      slug,
      description: String(body.description || ''),
      order: Number(body.order) || 0,
      isActive: body.isActive !== false && body.isActive !== 'false',
    })
    cacheDel('categories:')
    cacheDel('home')
    res.status(201).json(category)
  } catch (err) {
    res.status(400).json({ message: categoryError(err) })
  }
})

function categoryError(err) {
  if (err?.code === 11000) return 'এই স্লাগ ইতিমধ্যে ব্যবহার করা হয়েছে। অন্য স্লাগ দিন।'
  return err.message || 'ক্যাটাগরি সংরক্ষণ করা যায়নি'
}

router.put('/:id', requireAuth, requirePermission('category'), async (req, res) => {
  try {
    const body = req.body || {}
    const name = String(body.name || body.nameBn || '').trim()
    const slug = String(body.slug || '').trim().toLowerCase() || makeSlug(body.nameEn, name, 'category')
    if (!name) return res.status(400).json({ message: 'ক্যাটাগরির নাম আবশ্যক' })

    const category = await Category.findById(req.params.id)
    if (!category) return res.status(404).json({ message: 'Category not found' })

    category.name = name
    category.nameEn = String(body.nameEn || '').trim()
    category.slug = slug
    if (body.description !== undefined) category.description = String(body.description || '')
    if (body.order !== undefined) category.order = Number(body.order) || 0
    if (body.isActive !== undefined) category.isActive = body.isActive !== false && body.isActive !== 'false'
    await category.save()

    cacheDel('categories:')
    cacheDel('home')
    res.json(category)
  } catch (err) {
    res.status(400).json({ message: categoryError(err) })
  }
})

router.delete('/:id', requireAuth, requirePermission('category'), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) return res.status(404).json({ message: 'Category not found' })

    const [articleCount, subCount] = await Promise.all([
      Article.countDocuments({ category: category._id }),
      Subcategory.countDocuments({ category: category._id }),
    ])
    if (articleCount > 0 || subCount > 0) {
      return res.status(400).json({
        message: `Cannot delete: ${articleCount} article(s) and ${subCount} subcategory(ies) linked. Move or delete them first.`,
      })
    }

    await Category.findByIdAndDelete(category._id)
    cacheDel('categories:')
    cacheDel('home')
    res.json({ message: 'Category deleted', id: category._id })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
