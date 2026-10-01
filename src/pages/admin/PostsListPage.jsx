import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, articlePath } from '../../api/client'
import { refreshSiteData } from '../../context/SiteDataContext'
import SafeImage from '../../components/SafeImage'

function isoDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toISOString().slice(0, 10)
}

function postLanguage(item) {
  const title = String(item.title || '')
  if (/[\u0980-\u09FF]/.test(title)) return 'Bengali/Bangla'
  if (item.titleEn && !title) return 'English'
  return item.titleEn ? 'Bengali/Bangla' : 'Bengali/Bangla'
}

function downloadBlob(filename, mime, text) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function rowsToCsv(rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}

const PAGE_SIZES = [10, 25, 50, 100]

export default function PostsListPage() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortKey, setSortKey] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [filterOpen, setFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [postingFbId, setPostingFbId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const restoreFileInputRef = useRef(null)

  async function load() {
    const data = await api.getAdminArticles()
    setItems(Array.isArray(data) ? data : [])
  }

  async function handleBackup() {
    if (isBackingUp) return
    setIsBackingUp(true)
    setError('')
    setMessage('')
    try {
      const data = await api.backupArticles({ from: fromDate || undefined, to: toDate || undefined })
      const jsonStr = JSON.stringify(data, null, 2)
      const dateTag =
        fromDate || toDate
          ? `${fromDate || 'start'}_to_${toDate || 'end'}`
          : new Date().toISOString().slice(0, 10)
      const fileName = `krishikagoj-news-backup-${dateTag}.json`
      downloadBlob(fileName, 'application/json', jsonStr)
      setMessage(`সফলভাবে ${data.postCount || 0} টি পোস্টের ব্যাকআপ ডাউনলোড হয়েছে`)
    } catch (err) {
      setError(err.message || 'ব্যাকআপ ডাউনলোড ব্যর্থ হয়েছে')
    } finally {
      setIsBackingUp(false)
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const confirmRestore = window.confirm(
      `আপনি কি "${file.name}" ব্যাকআপ ফাইলটি আপলোড করে খবর রিস্টোর করতে চান?\n\nএটি ব্যাকআপে থাকা পোস্ট ও ছবিসমূহ ডাটাবেসে রিস্টোর করবে।`,
    )
    if (!confirmRestore) return

    setIsRestoring(true)
    setError('')
    setMessage('')
    try {
      const res = await api.restoreArticles(file)
      setMessage(res.message || 'সফলভাবে পোস্ট রিস্টোর সম্পন্ন হয়েছে')
      await load()
      await refreshSiteData().catch(() => {})
    } catch (err) {
      setError(err.message || 'রিস্টোর ব্যর্থ হয়েছে')
    } finally {
      setIsRestoring(false)
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  const categories = useMemo(() => {
    const map = new Map()
    items.forEach((item) => {
      const id = item.category?._id || item.category
      const name = item.category?.name
      if (id && name) map.set(String(id), name)
    })
    return [...map.entries()]
  }, [items])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return items.filter((item) => {
      if (statusFilter === 'publish' && item.isPublished === false) return false
      if (statusFilter === 'draft' && item.isPublished !== false) return false
      if (categoryFilter && String(item.category?._id || item.category) !== categoryFilter) return false
      if (!term) return true
      const hay = [
        item.title,
        item.titleEn,
        item.category?.name,
        item.subcategory?.nameBn,
        item.author,
        item.authorUser?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(term)
    })
  }, [items, q, statusFilter, categoryFilter])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return list
  }, [filtered, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [q, pageSize, statusFilter, categoryFilter])

  function sortValue(item, key) {
    switch (key) {
      case 'title':
        return String(item.title || '').toLowerCase()
      case 'category':
        return String(item.category?.name || '').toLowerCase()
      case 'sub':
        return String(item.subcategory?.nameBn || '').toLowerCase()
      case 'hit':
        return Number(item.views || 0)
      case 'author':
        return String(item.authorUser?.name || item.author || '').toLowerCase()
      case 'release':
        return new Date(item.publishedAt || 0).getTime()
      case 'createdAt':
        return new Date(item.createdAt || 0).getTime()
      case 'status':
        return item.isPublished === false ? 0 : 1
      default:
        return 0
    }
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function exportRows(kind) {
    const header = [
      'SI',
      'Title',
      'Category',
      'Sub category',
      'Hit',
      'Post by',
      'Release date',
      'Post date',
      'Language',
      'Status',
    ]
    const body = sorted.map((item, i) => [
      i + 1,
      item.title || '',
      item.category?.name || '',
      item.subcategory?.nameBn || '',
      item.views || 0,
      item.authorUser?.name || item.author || '',
      isoDate(item.publishedAt),
      isoDate(item.createdAt),
      postLanguage(item),
      item.isPublished === false ? 'Draft' : 'Publish',
    ])
    const csv = `\uFEFF${rowsToCsv([header, ...body])}`
    if (kind === 'excel') {
      downloadBlob('krishikagoj-posts.xls', 'application/vnd.ms-excel;charset=utf-8', csv)
    } else {
      downloadBlob('krishikagoj-posts.csv', 'text/csv;charset=utf-8', csv)
    }
  }

  async function handleDelete(id) {
    if (!confirm('পোস্ট মুছে ফেলবেন?')) return
    try {
      await api.deleteArticle(id)
      setMessage('পোস্ট মুছে ফেলা হয়েছে')
      setSelectedIds((prev) => prev.filter((it) => it !== id))
      await load()
      await refreshSiteData().catch(() => {})
    } catch (err) {
      setError(err.message)
    }
  }

  const allPageSelected = pageRows.length > 0 && pageRows.every((item) => selectedIds.includes(item._id))
  const somePageSelected = pageRows.some((item) => selectedIds.includes(item._id))

  function toggleSelectAll(checked) {
    if (checked) {
      const pageIds = pageRows.map((item) => item._id)
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])])
    } else {
      const pageIdsSet = new Set(pageRows.map((item) => item._id))
      setSelectedIds((prev) => prev.filter((id) => !pageIdsSet.has(id)))
    }
  }

  function toggleSelectItem(id, checked) {
    if (checked) {
      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    } else {
      setSelectedIds((prev) => prev.filter((it) => it !== id))
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0 || isBulkDeleting) return
    setIsBulkDeleting(true)
    setError('')
    setMessage('')
    try {
      const res = await api.bulkDeleteArticles(selectedIds)
      setMessage(res.message || `${selectedIds.length} টি পোস্ট সফলভাবে মুছে ফেলা হয়েছে`)
      setSelectedIds([])
      setShowBulkModal(false)
      await load()
      await refreshSiteData().catch(() => {})
    } catch (err) {
      setError(err.message || 'পোস্ট মুছে ফেলতে সমস্যা হয়েছে')
      setShowBulkModal(false)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  function sharePost(item) {
    if (item.isPublished === false) {
      setError('This post is not published yet')
      return
    }
    const url = `${window.location.origin}${articlePath(item)}`
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      'Share Post',
      'width=640,height=450',
    )
  }

  async function handleFacebookPost(item) {
    if (postingFbId) return
    if (item.isPublished === false) {
      setError('ড্রাফট পোস্ট ফেসবুকে প্রকাশ করা যাবে না। প্রথমে পোস্টটি পাবলিশ করুন।')
      return
    }
    if (item.facebookPostStatus === 'posted' || item.facebookPostId) {
      const confirmRepost = window.confirm(
        'এই খবরটি ইতিমধ্যে ফেসবুক পেজে পোস্ট করা হয়েছে। আপনি কি আবার পোস্ট করতে চান?',
      )
      if (!confirmRepost) return
    }

    setPostingFbId(item._id)
    setError('')
    setMessage('')
    try {
      const res = await api.postToFacebook(item._id)
      setMessage(res.message || 'Facebook Page-এ সফলভাবে পোস্ট প্রকাশিত হয়েছে')
      setItems((prev) =>
        prev.map((it) =>
          it._id === item._id
            ? {
                ...it,
                facebookPostId: res.facebookPostId || 'posted',
                facebookPostStatus: 'posted',
                facebookPostedAt: res.facebookPostedAt || new Date().toISOString(),
              }
            : it,
        ),
      )
    } catch (err) {
      setError(err.message || 'Facebook post failed. Please try again.')
      setItems((prev) =>
        prev.map((it) =>
          it._id === item._id
            ? { ...it, facebookPostStatus: 'failed' }
            : it,
        ),
      )
    } finally {
      setPostingFbId(null)
    }
  }

  function sortMark(key) {
    if (sortKey !== key) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const from = sorted.length ? (safePage - 1) * pageSize + 1 : 0
  const to = Math.min(safePage * pageSize, sorted.length)
  const pageNums = (() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, n) => n + 1)
    const start = Math.max(1, safePage - 2)
    const end = Math.min(pageCount, start + 4)
    const fromPage = Math.max(1, end - 4)
    return Array.from({ length: end - fromPage + 1 }, (_, n) => fromPage + n)
  })()

  return (
    <div className="post-list-page">
      {message && <div className="admin-alert admin-alert-success">{message}</div>}
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <div className="pl-head">
        <h3>Post list</h3>
        <div className="pl-head-actions">
          <button
            type="button"
            className="pl-backup-btn"
            onClick={handleBackup}
            disabled={isBackingUp || isRestoring}
            title={
              fromDate || toDate
                ? `Backup news from ${fromDate || 'start'} to ${toDate || 'now'}`
                : 'Backup all news'
            }
          >
            {isBackingUp ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" /> Backing up…
              </>
            ) : (
              <>
                <i className="fa-solid fa-download" /> Backup All News
              </>
            )}
          </button>

          <button
            type="button"
            className="pl-upload-btn"
            onClick={() => restoreFileInputRef.current?.click()}
            disabled={isBackingUp || isRestoring}
            title="Upload previously downloaded backup file to restore news"
          >
            {isRestoring ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" /> Uploading…
              </>
            ) : (
              <>
                <i className="fa-solid fa-upload" /> Upload All News
              </>
            )}
          </button>
          <input
            ref={restoreFileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />

          <div className="pl-date-range">
            <input
              type="date"
              className="pl-date-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              title="From Date"
              placeholder="From Date"
              aria-label="From Date"
            />
            <span className="pl-date-sep">to</span>
            <input
              type="date"
              className="pl-date-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              title="To Date"
              placeholder="To Date"
              aria-label="To Date"
            />
          </div>

          <button type="button" className="pl-filter-btn" onClick={() => setFilterOpen((v) => !v)}>
            <i className="fa-solid fa-filter" /> Filter
          </button>
        </div>
      </div>

      {filterOpen ? (
        <div className="pl-filter-box">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All status</option>
            <option value="publish">Publish</option>
            <option value="draft">Draft</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="pl-controls">
        <label className="pl-show">
          Show{' '}
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>{' '}
          entries
        </label>
        <div className="pl-export">
          <button type="button" onClick={() => exportRows('csv')}>
            <i className="fa-regular fa-file-lines" /> CSV
          </button>
          <button type="button" onClick={() => exportRows('excel')}>
            <i className="fa-regular fa-file-excel" /> Excel
          </button>
          <button
            type="button"
            className="pl-bulk-del-btn"
            disabled={selectedIds.length === 0}
            onClick={() => setShowBulkModal(true)}
            title={selectedIds.length === 0 ? 'Select posts to delete' : `Delete ${selectedIds.length} selected posts`}
          >
            <i className="fa-solid fa-trash-can" /> Delete Selected {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </button>
        </div>
        <label className="pl-search">
          Search:
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="admin-table-wrap pl-table-wrap">
        <table className="pl-table">
          <thead>
            <tr>
              <th style={{ width: '38px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allPageSelected && somePageSelected
                  }}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  title="Select all on this page"
                  aria-label="Select all on this page"
                />
              </th>
              <th>SI</th>
              <th>Image</th>
              <th onClick={() => toggleSort('title')}>Title{sortMark('title')}</th>
              <th onClick={() => toggleSort('category')}>Category{sortMark('category')}</th>
              <th onClick={() => toggleSort('sub')}>Sub category{sortMark('sub')}</th>
              <th onClick={() => toggleSort('hit')}>Hit{sortMark('hit')}</th>
              <th onClick={() => toggleSort('author')}>Post by{sortMark('author')}</th>
              <th onClick={() => toggleSort('release')}>Release date{sortMark('release')}</th>
              <th onClick={() => toggleSort('createdAt')}>Post date{sortMark('createdAt')}</th>
              <th>Language</th>
              <th onClick={() => toggleSort('status')}>Status{sortMark('status')}</th>
              <th>Social post</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={14}>No posts found</td>
              </tr>
            ) : null}
            {pageRows.map((item, i) => {
              const published = item.isPublished !== false
              const isPosting = postingFbId === item._id
              const isPosted = item.facebookPostStatus === 'posted' || Boolean(item.facebookPostId)
              const isFailed = item.facebookPostStatus === 'failed'
              const isSelected = selectedIds.includes(item._id)

              return (
                <tr key={item._id} className={isSelected ? 'is-row-selected' : ''}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelectItem(item._id, e.target.checked)}
                      aria-label={`Select ${item.title}`}
                    />
                  </td>
                  <td>{(safePage - 1) * pageSize + i + 1}</td>
                  <td>
                    {item.image ? <SafeImage src={item.image} alt="" className="pl-thumb" /> : '—'}
                  </td>
                  <td className="pl-title" title={item.title || ''}>
                    <span className="pl-title-text" title={item.title || ''}>{item.title}</span>
                  </td>
                  <td className="pl-cat-cell">
                    {item.category?.name ? <span className="pl-cat">{item.category.name}</span> : '—'}
                  </td>
                  <td>{item.subcategory?.nameBn || ''}</td>
                  <td>{item.views || 0}</td>
                  <td>{item.authorUser?.name || item.author || '—'}</td>
                  <td>{isoDate(item.publishedAt)}</td>
                  <td>{isoDate(item.createdAt)}</td>
                  <td>{postLanguage(item)}</td>
                  <td>
                    <span className={published ? 'pl-status' : 'pl-status pl-status-draft'}>
                      {published ? 'Publish' : 'Draft'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`pl-social ${
                        isPosting ? 'is-loading' : isPosted ? 'is-posted' : isFailed ? 'is-failed' : ''
                      }`}
                      disabled={isPosting}
                      onClick={() => handleFacebookPost(item)}
                      title={
                        isPosting
                          ? 'Posting to Facebook...'
                          : isPosted
                            ? 'Already posted on Facebook Page (Click to repost)'
                            : isFailed
                              ? 'Facebook post failed (Click to retry)'
                              : 'Post to Facebook Page'
                      }
                    >
                      {isPosting ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin" /> Posting…
                        </>
                      ) : isPosted ? (
                        <>
                          <i className="fa-solid fa-check" /> Posted
                        </>
                      ) : isFailed ? (
                        <>
                          <i className="fa-solid fa-rotate-right" /> Retry
                        </>
                      ) : (
                        'Post'
                      )}
                    </button>
                  </td>
                  <td className="pl-actions">
                    <Link to={`/admin/posts/${item._id}`} className="pl-ico pl-ico-edit" title="Edit">
                      <i className="fa-solid fa-pen" />
                    </Link>
                    <button
                      type="button"
                      className="pl-ico pl-ico-del"
                      title="Delete"
                      onClick={() => handleDelete(item._id)}
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                    {published ? (
                      <a
                        href={articlePath(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pl-ico pl-ico-view"
                        title="View"
                      >
                        <i className="fa-regular fa-eye" />
                      </a>
                    ) : (
                      <button type="button" className="pl-ico pl-ico-view" disabled title="This post is not published yet">
                        <i className="fa-regular fa-eye" />
                      </button>
                    )}
                    <button
                      type="button"
                      className={`pl-ico pl-ico-fb ${
                        isPosting ? 'is-loading' : isPosted ? 'is-posted' : isFailed ? 'is-failed' : ''
                      }`}
                      disabled={isPosting}
                      onClick={() => handleFacebookPost(item)}
                      title={
                        isPosting
                          ? 'Posting to Facebook...'
                          : isPosted
                            ? 'Already posted on Facebook Page (Click to repost)'
                            : isFailed
                              ? 'Facebook post failed (Click to retry)'
                              : 'Post directly to Facebook Page'
                      }
                    >
                      {isPosting ? (
                        <i className="fa-solid fa-spinner fa-spin" />
                      ) : isPosted ? (
                        <i className="fa-solid fa-check" />
                      ) : isFailed ? (
                        <i className="fa-solid fa-triangle-exclamation" />
                      ) : (
                        <i className="fa-brands fa-facebook-f" />
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showBulkModal && (
        <div className="pl-modal-overlay" onClick={() => !isBulkDeleting && setShowBulkModal(false)}>
          <div className="pl-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="pl-modal-header">
              <h4>Confirm Bulk Delete</h4>
              <button
                type="button"
                className="pl-modal-close"
                onClick={() => !isBulkDeleting && setShowBulkModal(false)}
                disabled={isBulkDeleting}
              >
                &times;
              </button>
            </div>
            <div className="pl-modal-body">
              <p style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>
                Are you sure you want to delete the <strong>{selectedIds.length}</strong> selected posts?
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '13.5px', color: '#dc2626', fontWeight: 500 }}>
                This action cannot be undone.
              </p>
            </div>
            <div className="pl-modal-footer">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setShowBulkModal(false)}
                disabled={isBulkDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" /> Deleting…
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pl-foot">
        <p>
          Showing {from} to {to} of {sorted.length} entries
        </p>
        <div className="pl-pages">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            Previous
          </button>
          {pageNums.map((n) => (
            <button
              key={n}
              type="button"
              className={n === safePage ? 'is-active' : ''}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button type="button" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
