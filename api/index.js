import app, { connectDb } from '../server/app.js'
import { extractNewsSlug, renderArticleOgHtml } from '../server/utils/ssrOgMeta.js'

function incomingPath(req) {
  const headers = req.headers || {}
  return String(
    headers['x-invoke-path'] ||
      headers['x-vercel-original-url'] ||
      headers['x-matched-path'] ||
      headers['x-vercel-matched-path'] ||
      req.originalUrl ||
      req.url ||
      '',
  )
}

function newsSlugFromPath(raw) {
  const text = String(raw || '')
  const ssr = text.match(/\/(?:articles\/og|ssr-news|news)\/([^?#]+)/)
  if (!ssr) return ''
  try {
    return decodeURIComponent(ssr[1].split('/')[0] || '')
  } catch {
    return ssr[1].split('/')[0] || ''
  }
}

async function handler(req, res) {
  try {
    await connectDb()
  } catch (err) {
    console.error('DB connect failed:', err.message)
    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        message: 'ডাটাবেস সংযোগ ব্যর্থ। Atlas cluster চালু আছে এবং Network Access-এ 0.0.0.0/0 আছে কিনা দেখুন।',
        error: err.message,
      })
    }
    return
  }

  const incoming = incomingPath(req)
  const isApi = req.url && req.url.startsWith('/api')
  const newsSlug = !isApi ? (newsSlugFromPath(incoming) || extractNewsSlug(req)) : ''
  if ((req.method === 'GET' || req.method === 'HEAD') && newsSlug && !isApi) {
    return renderArticleOgHtml(req, res, newsSlug)
  }

  // Ensure req.url starts with /api so Express routes always match under Vercel serverless functions
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/news')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`
  }

  return app(req, res)
}

export default handler
