import handler from './index.js'

export default function faviconHandler(req, res) {
  req.url = '/api/settings/favicon'
  if (req.originalUrl) req.originalUrl = '/api/settings/favicon'
  return handler(req, res)
}
