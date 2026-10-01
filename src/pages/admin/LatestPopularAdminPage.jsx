import { useEffect, useMemo, useState } from 'react'
import { api, articlePath } from '../../api/client'
import { useLang } from '../../context/LanguageContext'
import { refreshSiteData } from '../../context/SiteDataContext'
import SafeImage from '../../components/SafeImage'

const BN_NUM = ['১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯', '১০', '১১', '১২', '১৩', '১৪', '১৫']

function isoDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toISOString().slice(0, 10)
}

export default function LatestPopularAdminPage() {
  const { isEn } = useLang()
  const [activeTab, setActiveTab] = useState('latest') // 'latest' | 'popular'

  const [latestMode, setLatestMode] = useState('auto') // 'auto' | 'manual'
  const [popularMode, setPopularMode] = useState('auto') // 'auto' | 'manual'

  const [latestItems, setLatestItems] = useState([]) // array of article IDs (strings)
  const [popularItems, setPopularItems] = useState([]) // array of article IDs (strings)

  const [allArticles, setAllArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Search & Filter in Article Picker
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerCategory, setPickerCategory] = useState('')
  const [showPickerModal, setShowPickerModal] = useState(false)

  // Auto fallback lists
  const [autoLatest, setAutoLatest] = useState([])
  const [autoPopular, setAutoPopular] = useState([])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [settingsData, articlesData, categoriesData] = await Promise.all([
        api.getSettings().catch(() => ({})),
        api.getAdminArticles().catch(() => api.getArticles({ limit: '100' })),
        api.getAllCategories().catch(() => []),
      ])

      const pubArticles = (Array.isArray(articlesData) ? articlesData : []).filter(
        (a) => a.isPublished !== false,
      )
      setAllArticles(pubArticles)
      setCategories(Array.isArray(categoriesData) ? categoriesData : [])

      // Auto lists
      const sortedLatest = [...pubArticles].sort(
        (a, b) => new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0),
      )
      setAutoLatest(sortedLatest.slice(0, 12))

      const sortedPopular = [...pubArticles].sort((a, b) => (b.views || 0) - (a.views || 0))
      setAutoPopular(sortedPopular.slice(0, 12))

      const config = settingsData?.latestPopularConfig || {}
      setLatestMode(config.latestMode === 'manual' ? 'manual' : 'auto')
      setPopularMode(config.popularMode === 'manual' ? 'manual' : 'auto')

      const lItems = Array.isArray(config.latestItems)
        ? config.latestItems.map(String).filter((id) => /^[0-9a-fA-F]{24}$/.test(id))
        : []
      const pItems = Array.isArray(config.popularItems)
        ? config.popularItems.map(String).filter((id) => /^[0-9a-fA-F]{24}$/.test(id))
        : []

      setLatestItems(lItems)
      setPopularItems(pItems)
    } catch (err) {
      setError(err.message || 'ডাটা লোড করতে সমস্যা হয়েছে')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const articleMap = useMemo(() => {
    const map = new Map()
    allArticles.forEach((a) => map.set(String(a._id), a))
    return map
  }, [allArticles])

  // Current active list & setters
  const currentMode = activeTab === 'latest' ? latestMode : popularMode
  const currentItems = activeTab === 'latest' ? latestItems : popularItems
  const setCurrentMode = activeTab === 'latest' ? setLatestMode : setPopularMode
  const setCurrentItems = activeTab === 'latest' ? setLatestItems : setPopularItems

  // Resolved article objects for current manual list
  const currentArticleList = useMemo(() => {
    return currentItems.map((id) => articleMap.get(String(id))).filter(Boolean)
  }, [currentItems, articleMap])

  // Filtered articles for the picker
  const pickerCandidates = useMemo(() => {
    const term = pickerSearch.trim().toLowerCase()
    const selectedSet = new Set(currentItems.map(String))

    return allArticles.filter((a) => {
      if (selectedSet.has(String(a._id))) return false // exclude already selected
      if (pickerCategory && String(a.category?._id || a.category) !== pickerCategory) return false
      if (!term) return true
      const hay = [a.title, a.titleEn, a.category?.name, a.author].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(term)
    })
  }, [allArticles, currentItems, pickerSearch, pickerCategory])

  function handleAddItem(id) {
    if (!id || currentItems.includes(String(id))) return
    setCurrentItems((prev) => [...prev, String(id)])
  }

  function handleRemoveItem(index) {
    setCurrentItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleMoveUp(index) {
    if (index <= 0) return
    setCurrentItems((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  function handleMoveDown(index) {
    if (index >= currentItems.length - 1) return
    setCurrentItems((prev) => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  function handlePopulateFromAuto() {
    const list = activeTab === 'latest' ? autoLatest : autoPopular
    const ids = list.map((a) => String(a._id)).filter(Boolean)
    setCurrentItems(ids)
    setCurrentMode('manual')
    setMessage(
      isEn
        ? `Added ${ids.length} news items to manual list`
        : `বর্তমান ${ids.length} টি খবর তালিকায় যুক্ত করা হয়েছে`,
    )
    setTimeout(() => setMessage(''), 3000)
  }

  function handleClearList() {
    if (window.confirm(isEn ? 'Clear all items from this list?' : 'এই তালিকার সব খবর মুছে ফেলবেন?')) {
      setCurrentItems([])
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const payload = {
        latestPopularConfig: {
          latestMode,
          popularMode,
          latestItems,
          popularItems,
        },
      }

      await api.updateSettings(payload)
      await refreshSiteData().catch(() => {})

      setMessage(
        isEn
          ? 'Latest / Popular news configuration saved successfully!'
          : 'সর্বশেষ / জনপ্রিয় কনফিগারেশন সফলভাবে সংরক্ষিত হয়েছে!',
      )
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setError(err.message || 'সংরক্ষণ করতে ব্যর্থ হয়েছে')
    } finally {
      setSaving(false)
    }
  }

  // Preview items
  const previewItems = useMemo(() => {
    if (currentMode === 'manual') {
      if (currentArticleList.length > 0) {
        const remaining = (activeTab === 'latest' ? autoLatest : autoPopular).filter(
          (a) => !currentItems.includes(String(a._id)),
        )
        return [...currentArticleList, ...remaining].slice(0, 10)
      }
      return (activeTab === 'latest' ? autoLatest : autoPopular).slice(0, 10)
    }
    return (activeTab === 'latest' ? autoLatest : autoPopular).slice(0, 10)
  }, [currentMode, currentArticleList, currentItems, activeTab, autoLatest, autoPopular])

  if (loading) {
    return (
      <div className="admin-loading" style={{ minHeight: '300px' }}>
        <div className="admin-spinner" />
      </div>
    )
  }

  return (
    <div className="admin-page-container" style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      {message && <div className="admin-alert admin-alert-success">{message}</div>}
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <div
        className="admin-card-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
          background: '#fff',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-fire-flame-curved" style={{ color: '#ea580c' }} />
            {isEn ? 'Latest & Popular News Controller' : 'সর্বশেষ ও জনপ্রিয় সংবাদ নিয়ন্ত্রণ'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#64748b' }}>
            {isEn
              ? 'Configure which news articles appear under Latest and Popular sections on the website.'
              : 'ওয়েবসাইটের ডান সাইডবারে থাকা "সর্বশেষ" এবং "জনপ্রিয়" সেকশনের খবর নিয়ন্ত্রণ ও ক্রমানুসার সাজান।'}
          </p>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          {saving ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" /> {isEn ? 'Saving...' : 'সংরক্ষণ হচ্ছে...'}
            </>
          ) : (
            <>
              <i className="fa-solid fa-floppy-disk" /> {isEn ? 'Save Changes' : 'সংরক্ষণ করুন'}
            </>
          )}
        </button>
      </div>

      {/* Main Tabs (সর্বশেষ / জনপ্রিয়) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('latest')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: activeTab === 'latest' ? '#0f172a' : '#cbd5e1',
            background: activeTab === 'latest' ? '#0f172a' : '#fff',
            color: activeTab === 'latest' ? '#fff' : '#475569',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <i className="fa-regular fa-clock" />
          {isEn ? 'Latest News (সর্বশেষ)' : 'সর্বশেষ সংবাদ (Latest)'}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              background: activeTab === 'latest' ? '#334155' : '#f1f5f9',
              color: activeTab === 'latest' ? '#fff' : '#64748b',
            }}
          >
            {latestMode === 'manual' ? `${latestItems.length} টি ম্যানুয়াল` : 'স্বয়ংক্রিয়'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('popular')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: activeTab === 'popular' ? '#ea580c' : '#cbd5e1',
            background: activeTab === 'popular' ? '#ea580c' : '#fff',
            color: activeTab === 'popular' ? '#fff' : '#475569',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <i className="fa-solid fa-fire" />
          {isEn ? 'Popular News (জনপ্রিয়)' : 'জনপ্রিয় সংবাদ (Popular)'}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              background: activeTab === 'popular' ? '#c2410c' : '#f1f5f9',
              color: activeTab === 'popular' ? '#fff' : '#64748b',
            }}
          >
            {popularMode === 'manual' ? `${popularItems.length} টি ম্যানুয়াল` : 'স্বয়ংক্রিয়'}
          </span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.25rem', alignItems: 'start' }}>
        {/* Main Control Panel */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* Mode Selector */}
          <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
            <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
              {activeTab === 'latest' ? 'সর্বশেষ সংবাদ প্রদর্শনের মোড:' : 'জনপ্রিয় সংবাদ প্রদর্শনের মোড:'}
            </label>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: `2px solid ${currentMode === 'auto' ? '#16a34a' : '#e2e8f0'}`,
                  background: currentMode === 'auto' ? '#f0fdf4' : '#fafafa',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                <input
                  type="radio"
                  name={`${activeTab}-mode`}
                  checked={currentMode === 'auto'}
                  onChange={() => setCurrentMode('auto')}
                />
                <span>
                  <strong>স্বয়ংক্রিয় মোড (Automatic)</strong>
                  <small style={{ display: 'block', fontWeight: 400, color: '#64748b' }}>
                    {activeTab === 'latest'
                      ? 'সর্বশেষ প্রকাশিত খবরগুলো সময়ানুসারে স্বয়ংক্রিয়ভাবে দেখাবে'
                      : 'সর্বোচ্চ ভিউ সংখ্যা অনুযায়ী স্বয়ংক্রিয়ভাবে জনপ্রিয় খবর দেখাবে'}
                  </small>
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: `2px solid ${currentMode === 'manual' ? '#2563eb' : '#e2e8f0'}`,
                  background: currentMode === 'manual' ? '#eff6ff' : '#fafafa',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                <input
                  type="radio"
                  name={`${activeTab}-mode`}
                  checked={currentMode === 'manual'}
                  onChange={() => setCurrentMode('manual')}
                />
                <span>
                  <strong>ম্যানুয়াল নির্বাচন (Manual Selection)</strong>
                  <small style={{ display: 'block', fontWeight: 400, color: '#64748b' }}>
                    নির্দিষ্ট খবর বাছাই করে পজিশন ও ক্রম নিয়ন্ত্রণ করুন
                  </small>
                </span>
              </label>
            </div>
          </div>

          {/* Mode Specific Body */}
          {currentMode === 'auto' ? (
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                <i className="fa-solid fa-circle-info" style={{ color: '#0284c7', marginRight: '6px' }} />
                বর্তমানে এই সেকশনে <strong>স্বয়ংক্রিয়ভাবে</strong> খবর প্রদর্শিত হচ্ছে। আপনি চাইলে নির্দিষ্ট খবর
                বাছাই করার জন্য উপরের <strong>"ম্যানুয়াল নির্বাচন"</strong> অপশন সিলেক্ট করতে পারেন।
              </p>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={handlePopulateFromAuto}
                style={{ fontSize: '0.85rem' }}
              >
                <i className="fa-solid fa-hand-pointer" style={{ marginRight: '6px' }} />
                বর্তমান খবরগুলো দিয়ে ম্যানুয়াল তালিকা শুরু করুন
              </button>
            </div>
          ) : (
            <div>
              {/* Toolbar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                    নির্বাচিত খবরের তালিকা ({currentItems.length} টি)
                  </h4>
                  <small style={{ color: '#64748b' }}>
                    ক্রম পরিবর্তন করতে উপরে (↑) ও নিচে (↓) তীর ব্যবহার করুন
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={() => setShowPickerModal(true)}
                    style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="fa-solid fa-plus" /> খবর যোগ করুন
                  </button>
                  {currentItems.length > 0 && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger"
                      onClick={handleClearList}
                      style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <i className="fa-solid fa-trash-can" /> সব মুছুন
                    </button>
                  )}
                </div>
              </div>

              {/* Items List */}
              {currentItems.length === 0 ? (
                <div
                  style={{
                    padding: '2.5rem 1rem',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                  }}
                >
                  <i className="fa-regular fa-newspaper" style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '8px' }} />
                  <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: '0.9rem' }}>
                    এখনো কোনো খবর যোগ করা হয়নি।
                  </p>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={() => setShowPickerModal(true)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <i className="fa-solid fa-plus" /> খবর যোগ করুন
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {currentItems.map((id, index) => {
                    const article = articleMap.get(String(id))
                    if (!article) {
                      return (
                        <div
                          key={id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: '#fee2e2',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span style={{ color: '#dc2626' }}>খবর খুঁজে পাওয়া যায়নি (ID: {id})</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={article._id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Position Badge */}
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: activeTab === 'latest' ? '#0f172a' : '#ea580c',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            flexShrink: 0,
                          }}
                        >
                          {isEn ? index + 1 : BN_NUM[index] || index + 1}
                        </div>

                        {/* Thumbnail */}
                        <div style={{ width: '56px', height: '42px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: '#f1f5f9' }}>
                          {article.image ? (
                            <SafeImage
                              src={article.image}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
                              No Pic
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h5
                            style={{
                              margin: '0 0 3px',
                              fontSize: '0.92rem',
                              fontWeight: 600,
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={article.title}
                          >
                            {article.title}
                          </h5>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem', color: '#64748b', alignItems: 'center' }}>
                            {article.category?.name && (
                              <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '3px', color: '#334155' }}>
                                {article.category.name}
                              </span>
                            )}
                            <span>{isoDate(article.publishedAt || article.createdAt)}</span>
                            <span>• {article.views || 0} ভিউ</span>
                          </div>
                        </div>

                        {/* Reorder & Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: index === 0 ? '#cbd5e1' : '#334155',
                              cursor: index === 0 ? 'not-allowed' : 'pointer',
                            }}
                            title="Move Up"
                          >
                            <i className="fa-solid fa-arrow-up" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === currentItems.length - 1}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: index === currentItems.length - 1 ? '#cbd5e1' : '#334155',
                              cursor: index === currentItems.length - 1 ? 'not-allowed' : 'pointer',
                            }}
                            title="Move Down"
                          >
                            <i className="fa-solid fa-arrow-down" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: '1px solid #fecaca',
                              background: '#fee2e2',
                              color: '#dc2626',
                              cursor: 'pointer',
                              marginLeft: '4px',
                            }}
                            title="Remove"
                          >
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Widget Preview */}
        <div>
          <div
            style={{
              background: '#fff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              position: 'sticky',
              top: '80px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                <i className="fa-solid fa-eye" style={{ marginRight: '5px' }} />
                Website Preview
              </span>
              <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                {activeTab === 'latest' ? 'সর্বশেষ ট্যাব' : 'জনপ্রিয় ট্যাব'}
              </span>
            </div>

            {/* Simulated Widget Box */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', overflow: 'hidden' }}>
              {/* Widget Header Tabs */}
              <div style={{ display: 'flex', borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
                <div
                  style={{
                    padding: '8px 14px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    background: activeTab === 'latest' ? '#0f172a' : 'transparent',
                    color: activeTab === 'latest' ? '#fff' : '#64748b',
                  }}
                >
                  সর্বশেষ
                </div>
                <div
                  style={{
                    padding: '8px 14px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    background: activeTab === 'popular' ? '#ea580c' : 'transparent',
                    color: activeTab === 'popular' ? '#fff' : '#64748b',
                  }}
                >
                  জনপ্রিয়
                </div>
              </div>

              {/* Items List in Widget */}
              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                {previewItems.slice(0, 6).map((item, i) => (
                  <div
                    key={item._id || i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 0',
                      borderBottom: i < 5 ? '1px solid #f1f5f9' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {BN_NUM[i] || i + 1}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#1e293b',
                        lineHeight: 1.35,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <small style={{ display: 'block', marginTop: '10px', color: '#64748b', fontSize: '0.75rem', textAlign: 'center' }}>
              ওয়েবসাইটের ডান সাইডবারে এই ক্রমেই খবর প্রদর্শিত হবে।
            </small>
          </div>
        </div>
      </div>

      {/* Article Picker Modal */}
      {showPickerModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setShowPickerModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                খবর নির্বাচন করুন ({activeTab === 'latest' ? 'সর্বশেষ' : 'জনপ্রিয়'})
              </h3>
              <button
                type="button"
                onClick={() => setShowPickerModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div style={{ padding: '0.75rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="শিরোনাম দিয়ে খুঁজুন..."
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                }}
              />
              <select
                value={pickerCategory}
                onChange={(e) => setPickerCategory(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  maxWidth: '160px',
                }}
              >
                <option value="">সকল ক্যাটাগরি</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Candidates List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem' }}>
              {pickerCandidates.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  কোনো খবর পাওয়া যায়নি।
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pickerCandidates.slice(0, 50).map((article) => (
                    <div
                      key={article._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #f1f5f9',
                        background: '#fafafa',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <div style={{ width: '48px', height: '36px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: '#e2e8f0' }}>
                          {article.image ? (
                            <SafeImage
                              src={article.image}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : null}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p
                            style={{
                              margin: '0 0 2px',
                              fontSize: '0.88rem',
                              fontWeight: 600,
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={article.title}
                          >
                            {article.title}
                          </p>
                          <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            {article.category?.name} • {isoDate(article.publishedAt || article.createdAt)} •{' '}
                            {article.views || 0} ভিউ
                          </small>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="admin-btn admin-btn-primary"
                        onClick={() => {
                          handleAddItem(article._id)
                        }}
                        style={{ padding: '4px 10px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                      >
                        + যোগ করুন
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#f8fafc',
              }}
            >
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setShowPickerModal(false)}
              >
                সম্পন্ন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
