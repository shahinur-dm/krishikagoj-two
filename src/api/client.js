const API_URL = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'kk_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, options = {}) {
  const {
    cache: cacheMode = 'no-store',
    skipAuth = false,
    headers: extraHeaders,
    credentials = 'same-origin',
    ...fetchOpts
  } = options
  const headers = {
    'Content-Type': 'application/json',
    ...(cacheMode === 'no-store'
      ? {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        }
      : {}),
    ...(extraHeaders || {}),
  }
  const token = skipAuth ? null : getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...fetchOpts,
      cache: cacheMode,
      headers,
      credentials,
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.message || `Request failed (${res.status})`)
    }
    return data
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('সার্ভার সাড়া দিচ্ছে না। একটু পরে আবার চেষ্টা করুন।')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  visitorOAuth: (body) =>
    request('/auth/visitor/oauth', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  changePassword: (body) =>
    request('/auth/password', { method: 'PUT', body: JSON.stringify(body) }),
  getWriters: () => request('/auth/writers'),
  createWriter: (body) => request('/auth/writers', { method: 'POST', body: JSON.stringify(body) }),
  updateWriter: (id, body) =>
    request(`/auth/writers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteWriter: (id) => request(`/auth/writers/${id}`, { method: 'DELETE' }),

  getDashboard: () => request('/dashboard'),

  getHome: (params = {}) => {
    const bust = params.bust
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    return request(`/home${qs ? `?${qs}` : ''}`, {
      cache: bust ? 'no-store' : 'default',
      skipAuth: true,
      credentials: 'omit',
    })
  },
  getHomeNews: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    return request(`/home/news${qs ? `?${qs}` : ''}`, {
      cache: 'default',
      skipAuth: true,
      credentials: 'omit',
    })
  },

  getCategories: () => request('/categories'),
  getAllCategories: () => request('/categories/all'),
  getCategory: (idOrSlug) => request(`/categories/${idOrSlug}`),
  createCategory: (body) => request('/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id, body) =>
    request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  getSubcategories: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/subcategories${qs ? `?${qs}` : ''}`)
  },
  getAllSubcategories: () => request('/subcategories/all'),
  updateTopicGridConfig: (body) =>
    request('/subcategories/grid-config', { method: 'PUT', body: JSON.stringify(body) }),
  createSubcategory: (body) =>
    request('/subcategories', { method: 'POST', body: JSON.stringify(body) }),
  updateSubcategory: (id, body) =>
    request(`/subcategories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSubcategory: (id) => request(`/subcategories/${id}`, { method: 'DELETE' }),

  getArticles: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    return request(`/articles${qs ? `?${qs}` : ''}`)
  },
  getAdminArticles: () => request('/articles/admin/all'),
  getAdminArticle: (id) => request(`/articles/admin/${id}`),
  getArticle: (idOrSlug) => request(`/articles/${idOrSlug}`),
  createArticle: (body) => request('/articles', { method: 'POST', body: JSON.stringify(body) }),
  updateArticle: (id, body) =>
    request(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteArticle: (id) => request(`/articles/${id}`, { method: 'DELETE' }),
  bulkDeleteArticles: (ids) =>
    request('/articles/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  postToFacebook: (id) =>
    request(`/articles/admin/${id}/facebook-post`, { method: 'POST' }),
  backupArticles: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    return request(`/articles/admin/backup${qs ? `?${qs}` : ''}`)
  },
  restoreArticles: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const headers = {}
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${API_URL}/articles/admin/restore`, {
      method: 'POST',
      headers,
      body: form,
      credentials: 'same-origin',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || `Restore failed (${res.status})`)
    return data
  },

  getLayoutTopics: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/layout-topics${qs ? `?${qs}` : ''}`)
  },
  createLayoutTopic: (body) =>
    request('/layout-topics', { method: 'POST', body: JSON.stringify(body) }),
  updateLayoutTopic: (id, body) =>
    request(`/layout-topics/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteLayoutTopic: (id) =>
    request(`/layout-topics/${id}`, { method: 'DELETE' }),
  reorderLayoutTopics: (topics) =>
    request('/layout-topics/reorder', { method: 'PUT', body: JSON.stringify({ topics }) }),

  getSettings: () => request('/settings'),
  updateSettings: (body) => request('/settings', { method: 'PUT', body: JSON.stringify(body) }),
  updateLoginLogo: (loginLogo) =>
    request('/settings/login-logo', { method: 'PUT', body: JSON.stringify({ loginLogo }) }),

  getPhotos: () => request('/photos'),
  createPhoto: (body) => request('/photos', { method: 'POST', body: JSON.stringify(body) }),
  updatePhoto: (id, body) =>
    request(`/photos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePhoto: (id) => request(`/photos/${id}`, { method: 'DELETE' }),

  getVideos: () => request('/videos'),
  createVideo: (body) => request('/videos', { method: 'POST', body: JSON.stringify(body) }),
  updateVideo: (id, body) =>
    request(`/videos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteVideo: (id) => request(`/videos/${id}`, { method: 'DELETE' }),

  getStaff: () => request('/staff'),
  getAdminStaff: () => request('/staff/admin/all'),
  createStaff: (body) => request('/staff', { method: 'POST', body: JSON.stringify(body) }),
  updateStaff: (id, body) =>
    request(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteStaff: (id) => request(`/staff/${id}`, { method: 'DELETE' }),

  getWebsites: () => request('/websites'),
  getAdminWebsites: () => request('/websites/admin/all'),
  createWebsite: (body) => request('/websites', { method: 'POST', body: JSON.stringify(body) }),
  updateWebsite: (id, body) =>
    request(`/websites/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteWebsite: (id) => request(`/websites/${id}`, { method: 'DELETE' }),

  getAds: () => request('/ads/public'),
  getAdsGlobal: () => request('/ads/global'),
  updateAdsGlobal: (adsEnabled) =>
    request('/ads/global', { method: 'PUT', body: JSON.stringify({ ads_enabled: adsEnabled }) }),
  getAdminAds: () => request('/ads/admin/all'),
  createAd: (body) => request('/ads', { method: 'POST', body: JSON.stringify(body) }),
  updateAd: (id, body) => request(`/ads/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAd: (id) => request(`/ads/${id}`, { method: 'DELETE' }),

  getBreakingPublic: () => request('/breaking/public'),
  getBreaking: () => request('/breaking'),
  createBreaking: (body) => request('/breaking', { method: 'POST', body: JSON.stringify(body) }),
  updateBreaking: (id, body) => request(`/breaking/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteBreaking: (id) => request(`/breaking/${id}`, { method: 'DELETE' }),

  getAiSettings: () => request('/settings/ai-writer'),
  saveAiSettings: (body) => request('/settings/ai-writer', { method: 'PUT', body: JSON.stringify(body) }),
  generateAiArticle: (body) =>
    request('/settings/ai-writer/generate', { method: 'POST', body: JSON.stringify(body) }),
  getFacebookSettings: () => request('/settings/facebook'),
  saveFacebookSettings: (body) =>
    request('/settings/facebook', { method: 'PUT', body: JSON.stringify(body) }),
  testFacebookConnection: (body = {}) =>
    request('/settings/facebook/test', { method: 'POST', body: JSON.stringify(body) }),

  getOpinions: () => request('/opinions'),
  getOpinion: (id) => request(`/opinions/${id}`),
  createOpinion: (body) => request('/opinions', { method: 'POST', body: JSON.stringify(body) }),
  updateOpinion: (id, body) => request(`/opinions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteOpinion: (id) => request(`/opinions/${id}`, { method: 'DELETE' }),

  getPolls: () => request('/polls'),
  getPoll: (id) => request(`/polls/${id}`),
  getPublicPoll: () => request('/polls/public'),
  createPoll: (body) => request('/polls', { method: 'POST', body: JSON.stringify(body) }),
  updatePoll: (id, body) => request(`/polls/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePoll: (id) => request(`/polls/${id}`, { method: 'DELETE' }),
  votePoll: (id, optionIndex) =>
    request(`/polls/${id}/vote`, { method: 'POST', body: JSON.stringify({ optionIndex }) }),

  getSurveys: () => request('/surveys'),
  getSurvey: (id) => request(`/surveys/${id}`),
  getPublicSurveys: () => request('/surveys/public'),
  getPublicSurvey: (id) => request(`/surveys/public/${id}`),
  getSurveyResults: (id) => request(`/surveys/${id}/results`),
  createSurvey: (body) => request('/surveys', { method: 'POST', body: JSON.stringify(body) }),
  updateSurvey: (id, body) => request(`/surveys/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSurvey: (id) => request(`/surveys/${id}`, { method: 'DELETE' }),
  respondSurvey: (id, answers) =>
    request(`/surveys/${id}/respond`, { method: 'POST', body: JSON.stringify({ answers }) }),

  getCmsPages: () => request('/pages'),
  getCmsPage: (id) => request(`/pages/${id}`),
  getPublicPage: (slug) => request(`/pages/public/${slug}`),
  createCmsPage: (body) => request('/pages', { method: 'POST', body: JSON.stringify(body) }),
  updateCmsPage: (id, body) => request(`/pages/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCmsPage: (id) => request(`/pages/${id}`, { method: 'DELETE' }),


  getUsers: () => request('/users'),
  getUsersMeta: () => request('/users/meta'),
  createUser: (body) => request('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  listMedia: (params = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.q) query.set('q', params.q)
    const qs = query.toString()
    return request(`/upload${qs ? `?${qs}` : ''}`)
  },

  uploadImage: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const headers = {}
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers,
      body: form,
      credentials: 'same-origin',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || `Upload failed (${res.status})`)
    return data
  },

  translateArticle: (body) => request('/translate/article', { method: 'POST', body: JSON.stringify(body) }),
  translateText: (body) => request('/translate/text', { method: 'POST', body: JSON.stringify(body) }),
}

export function articlePath(article) {
  return getArticlePath(article)
}

export function getPublicShareUrl(path = '') {
  const p = path.startsWith('/') ? path : `/${path}`
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.origin}${p}`
    }
  }
  return `https://krishikagoj.com${p}`
}

export function getArticlePath(article) {
  if (!article) return '/'
  const id = String(article.id || article._id || '')
  const rawSlug = article.slug ? String(article.slug).trim() : ''
  const isCleanAscii =
    rawSlug &&
    /^[a-zA-Z0-9_-]+$/.test(rawSlug) &&
    !/[^\x00-\x7F]/.test(rawSlug) &&
    rawSlug.length >= 3 &&
    !/^[0-9a-fA-F]{24}$/.test(rawSlug)
  const cleanKey = isCleanAscii ? rawSlug : id
  return `/news/${cleanKey || 'article'}`
}

export function formatBnDate(value, lang = 'bn') {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

export function formatBnTime(value, lang = 'bn') {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: lang === 'en',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

export function mapArticle(a) {
  if (!a) return null
  const id = String(a._id || a.id || '')
  const rawSlug = a.slug ? String(a.slug).trim() : ''
  const isCleanAscii =
    rawSlug &&
    /^[a-zA-Z0-9_-]+$/.test(rawSlug) &&
    !/[^\x00-\x7F]/.test(rawSlug) &&
    rawSlug.length >= 3 &&
    !/^[0-9a-fA-F]{24}$/.test(rawSlug)
  const slug = isCleanAscii ? rawSlug : id
  const path = `/news/${slug}`

  return {
    id,
    title: a.title,
    titleEn: a.titleEn || '',
    slug,
    path,
    excerpt: a.excerpt,
    excerptEn: a.excerptEn || '',
    metaDescription: a.metaDescription || a.meta_description || '',
    body: a.body,
    bodyEn: a.bodyEn || '',
    image: a.image,
    imageCaption: a.imageCaption || '',
    showImageInDetails: a.showImageInDetails !== false,
    author: a.author,
    tags: a.tags || '',
    category: a.category?.slug || a.category,
    categoryName: a.category?.name || '',
    categoryNameEn: a.category?.nameEn || '',
    categoryId: a.category?._id || a.category,
    subcategory: a.subcategory?.slug || a.subcategory || '',
    subcategoryId: a.subcategory?._id || a.subcategoryId || '',
    subcategoryName: a.subcategory?.nameBn || a.subcategoryName || '',
    views: a.views || 0,
    featured: a.featured,
    headline: a.headline,
    latest: a.latest,
    popular: a.popular,
    date: formatBnDate(a.publishedAt || a.createdAt),
    publishedAt: a.publishedAt || a.createdAt,
    raw: a,
  }
}
