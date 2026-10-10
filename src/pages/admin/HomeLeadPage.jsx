import { useEffect, useMemo, useState } from 'react'
import { api, mapArticle } from '../../api/client'
import SafeImage from '../../components/SafeImage'
import { useLang } from '../../context/LanguageContext'
import { refreshSiteData } from '../../context/SiteDataContext'
import { emptyItems, sectionSlotMeta, sectionVariant } from '../../lib/sectionLayouts'

const EMPTY = {
  lead: '',
  grid: Array(6).fill(''),
  mid: Array(6).fill(''),
  story: '',
  storyList: Array(6).fill(''),
}

function cloneSlots(s) {
  return {
    lead: s.lead || '',
    grid: Array.from({ length: 6 }, (_, i) => s.grid?.[i] || ''),
    mid: Array.from({ length: 6 }, (_, i) => s.mid?.[i] || ''),
    story: s.story || '',
    storyList: Array.from({ length: 6 }, (_, i) => s.storyList?.[i] || ''),
  }
}

function parseKey(key) {
  if (key.startsWith('pool:')) return { type: 'pool', id: key.slice(5) }
  if (key.includes(':')) {
    const [type, idx] = key.split(':')
    return { type, index: Number(idx) }
  }
  return { type: key }
}

function getAt(slots, ref, items = []) {
  if (ref.type === 'lead' || ref.type === 'story') return slots[ref.type] || ''
  if (ref.type === 'grid' || ref.type === 'mid' || ref.type === 'storyList') {
    return slots[ref.type][ref.index] || ''
  }
  if (ref.type === 'items') return items[ref.index] || ''
  return ''
}

function setAt(slots, ref, id) {
  const next = cloneSlots(slots)
  if (ref.type === 'lead' || ref.type === 'story') next[ref.type] = id || ''
  else if (ref.type === 'grid' || ref.type === 'mid' || ref.type === 'storyList') {
    next[ref.type][ref.index] = id || ''
  }
  return next
}

function SlotCard({ article, label, slotKey, variant = 'sm', onClear, onChoose, onDragStart, onDrop }) {
  const { t } = useLang()
  return (
    <div
      className={`hl-slot hl-slot--${variant}${article ? '' : ' is-empty'}`}
      draggable={Boolean(article)}
      onDragStart={(e) => {
        if (!article) return
        e.dataTransfer.setData('text/plain', slotKey)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.(slotKey)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(e.dataTransfer.getData('text/plain'), slotKey)
      }}
    >
      <span className="hl-slot-label">{label}</span>
      {article ? (
        <>
          <div className="hl-slot-media">
            <SafeImage src={article.image} alt={article.title} width={320} />
            {variant === 'story' ? <span className="hl-slot-overlay">{article.title}</span> : null}
          </div>
          {variant !== 'story' ? <p className="hl-slot-title">{article.title}</p> : null}
          <div className="hl-slot-actions">
            <button
              type="button"
              className="hl-slot-choose"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onChoose(slotKey)
              }}
            >
              বেছে নিন
            </button>
            {article?.path ? (
              <a
                className="hl-slot-choose"
                href={article.path}
                target="_blank"
                rel="noreferrer"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                দেখে নিন
              </a>
            ) : null}
            <button
              type="button"
              className="hl-slot-delete"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onClear(slotKey)
              }}
            >
              {t.delete}
            </button>
          </div>
        </>
      ) : (
        <div className="hl-slot-empty">
          <p className="hl-slot-placeholder">এখানে খবর টেনে আনুন</p>
          <button
            type="button"
            className="hl-slot-choose hl-slot-choose--empty"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onChoose(slotKey)
            }}
          >
            বেছে নিন
          </button>
        </div>
      )}
    </div>
  )
}

export default function HomeLeadPage() {
  const { t } = useLang()
  const [pageKey, setPageKey] = useState('home')
  const [categories, setCategories] = useState([])
  const [settingsDoc, setSettingsDoc] = useState(null)
  const [articles, setArticles] = useState([])
  const [slots, setSlots] = useState(EMPTY)
  const [storyTitle, setStoryTitle] = useState('নিউজ স্টোরিজ')
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState('')
  const [pickerSlot, setPickerSlot] = useState('')
  const [pickerQ, setPickerQ] = useState('')

  const selectedCat = useMemo(
    () => categories.find((c) => c.slug === pageKey) || null,
    [categories, pageKey],
  )
  const catIndex = Math.max(0, categories.findIndex((c) => c.slug === pageKey))
  const variant = pageKey === 'home' ? 'home' : sectionVariant(selectedCat, catIndex)
  const meta = pageKey === 'home' ? null : sectionSlotMeta(variant)

  const byId = useMemo(() => {
    const m = new Map()
    articles.forEach((a) => m.set(a.id, a))
    return m
  }, [articles])

  const used = useMemo(() => {
    const s = new Set()
    if (pageKey === 'home') {
      ;[slots.lead, slots.story, ...slots.grid, ...slots.mid, ...slots.storyList]
        .filter(Boolean)
        .forEach((id) => s.add(id))
    } else {
      items.filter(Boolean).forEach((id) => s.add(id))
    }
    return s
  }, [pageKey, slots, items])

  const pool = useMemo(() => {
    const term = q.trim().toLowerCase()
    return articles.filter((a) => {
      if (used.has(a.id)) return false
      if (!term) return true
      return (
        a.title.toLowerCase().includes(term) ||
        (a.categoryName || '').toLowerCase().includes(term)
      )
    })
  }, [articles, used, q])

  const pickerList = useMemo(() => {
    const term = pickerQ.trim().toLowerCase()
    const currentId = pickerSlot ? getAt(slots, parseKey(pickerSlot), items) : ''
    return articles.filter((a) => {
      if (used.has(a.id) && a.id !== currentId) return false
      if (!term) return true
      return (
        a.title.toLowerCase().includes(term) ||
        (a.categoryName || '').toLowerCase().includes(term)
      )
    })
  }, [articles, used, pickerQ, pickerSlot, slots, items])

  useEffect(() => {
    let alive = true
    api
      .getAllCategories()
      .then((rows) => {
        if (alive) setCategories((rows || []).filter((c) => c.slug && c.slug !== 'home'))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)
        setError('')
        setMessage('')
        const params = { limit: '80' }
        if (pageKey !== 'home') params.category = pageKey
        const [rows, settings] = await Promise.all([
          api.getArticles(params),
          api.getSettings(),
        ])
        if (!alive) return
        const mapped = (rows || []).map(mapArticle).filter(Boolean)
        setArticles(mapped)
        setSettingsDoc(settings || {})
        setStoryTitle(settings?.newsStoriesTitle || settings?.newsStoriesTitleBn || 'নিউজ স্টোরিজ')

        if (pageKey === 'home') {
          const saved = settings?.homepageSlots
          if (saved && (saved.lead || saved.story || (saved.grid || []).some(Boolean))) {
            setSlots(cloneSlots(saved))
          } else {
            const next = cloneSlots(EMPTY)
            next.lead = mapped[0]?.id || ''
            next.grid = mapped.slice(1, 7).map((a) => a.id)
            while (next.grid.length < 6) next.grid.push('')
            next.mid = mapped.slice(7, 13).map((a) => a.id)
            while (next.mid.length < 6) next.mid.push('')
            next.story = mapped[13]?.id || mapped[1]?.id || ''
            next.storyList = mapped.slice(14, 20).map((a) => a.id)
            while (next.storyList.length < 6) next.storyList.push('')
            setSlots(next)
          }
        } else {
          const count = sectionSlotMeta(sectionVariant({ slug: pageKey })).count
          const savedIds = settings?.sectionSlots?.[pageKey]?.items || settings?.sectionSlots?.[pageKey] || []
          const next = emptyItems(count)
          if (Array.isArray(savedIds) && savedIds.some(Boolean)) {
            savedIds.slice(0, count).forEach((id, i) => {
              next[i] = id || ''
            })
          } else {
            mapped.slice(0, count).forEach((a, i) => {
              next[i] = a.id
            })
          }
          setItems(next)
        }
      } catch (err) {
        if (alive) setError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [pageKey])

  function art(id) {
    return id ? byId.get(id) || null : null
  }

  function handleDrop(fromKey, toKey) {
    setDragging('')
    if (!fromKey || !toKey || fromKey === toKey) return
    const from = parseKey(fromKey)
    const to = parseKey(toKey)
    if (pageKey !== 'home') {
      setItems((prev) => {
        const next = [...prev]
        const incoming = from.type === 'pool' ? from.id : next[from.index] || ''
        if (!incoming && from.type === 'pool') return prev
        if (from.type === 'pool') {
          return next.map((id, i) => {
            if (i === to.index) return incoming
            return id === incoming ? '' : id
          })
        }
        if (from.type === 'items' && to.type === 'items') {
          const a = next[from.index] || ''
          const b = next[to.index] || ''
          next[to.index] = a
          next[from.index] = b
          return next
        }
        return prev
      })
      return
    }
    setSlots((prev) => {
      if (from.type === 'pool') {
        const incoming = from.id
        if (!incoming) return prev
        let next = cloneSlots(prev)
        if (next.lead === incoming) next.lead = ''
        if (next.story === incoming) next.story = ''
        next.grid = next.grid.map((id) => (id === incoming ? '' : id))
        next.mid = next.mid.map((id) => (id === incoming ? '' : id))
        next.storyList = next.storyList.map((id) => (id === incoming ? '' : id))
        return setAt(next, to, incoming)
      }
      const a = getAt(prev, from)
      const b = getAt(prev, to)
      return setAt(setAt(prev, to, a), from, b)
    })
  }

  function clearSlot(slotKey) {
    const ref = parseKey(slotKey)
    if (ref.type === 'items') {
      setItems((prev) => prev.map((id, i) => (i === ref.index ? '' : id)))
      return
    }
    setSlots((prev) => setAt(prev, ref, ''))
  }

  function openPicker(slotKey) {
    setPickerQ('')
    setPickerSlot(slotKey)
  }

  function pickArticle(id) {
    if (!pickerSlot || !id) return
    handleDrop(`pool:${id}`, pickerSlot)
    setPickerSlot('')
    setPickerQ('')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      if (pageKey === 'home') {
        const ids = [slots.lead, slots.story, ...slots.grid, ...slots.mid, ...slots.storyList].filter(Boolean)
        const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
        if (dup.length) throw new Error('একই খবর একাধিক পজিশনে রাখা যাবে না')
        await api.updateSettings({
          homepageSlots: cloneSlots(slots),
          newsStoriesTitle: storyTitle.trim() || 'নিউজ স্টোরিজ',
        })
        await refreshSiteData().catch(() => {})
        setMessage('সেভ হয়েছে — হোমপেজে এই পজিশনেই খবর দেখাবে')
      } else {
        const ids = items.filter(Boolean)
        const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
        if (dup.length) throw new Error('একই খবর একাধিক পজিশনে রাখা যাবে না')
        const invalid = ids.filter((id) => !byId.has(id))
        if (invalid.length) throw new Error('কিছু খবর আর পাওয়া যাচ্ছে না — আবার বেছে নিন')
        const nextMap = { ...(settingsDoc?.sectionSlots || {}) }
        nextMap[pageKey] = { items: [...items] }
        const updated = await api.updateSettings({ sectionSlots: nextMap })
        setSettingsDoc(updated)
        await refreshSiteData().catch(() => {})
        setMessage(`সেভ হয়েছে — ${selectedCat?.name || pageKey} সেকশনে এই পজিশনেই খবর দেখাবে`)
      }
      setTimeout(() => setMessage(''), 3500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    if (!confirm('এই পৃষ্ঠার পজিশন রিসেট হবে। খবর ডিলিট হবে না।')) return
    if (pageKey === 'home') setSlots(cloneSlots(EMPTY))
    else setItems(emptyItems(meta?.count || 7))
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    )
  }

  return (
    <div className="hl-page">
      <div className="hl-toolbar">
        <div>
          <h2>{t.homeLeadTitle}</h2>
          <p>{t.homeLeadHelp}</p>
        </div>
        <div className="hl-toolbar-actions">
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={handleReset}
          >
            {t.resetPositions || 'সব রিসেট'}
          </button>
          <button type="button" className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>

      {message ? <div className="admin-alert admin-alert-success">{message}</div> : null}
      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

      <div className="hl-page-select">
        <label htmlFor="hl-page-key">পৃষ্ঠা নির্বাচন করুন</label>
        <select
          id="hl-page-key"
          value={pageKey}
          onChange={(e) => setPageKey(e.target.value)}
        >
          <option value="home">হোমপেজ</option>
          {categories.map((c) => (
            <option key={c._id || c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {pageKey === 'home' ? (
      <div className={`hl-canvas${dragging ? ' is-dragging' : ''}`}>
        <div className="hl-col hl-col-main">
          <SlotCard
            article={art(slots.lead)}
            label="বড় খবর (বাম)"
            slotKey="lead"
            variant="lead"
            onClear={clearSlot}
            onChoose={openPicker}
            onDragStart={setDragging}
            onDrop={handleDrop}
          />
          <div className="hl-grid">
            {slots.grid.map((id, i) => (
              <SlotCard
                key={`g-${i}`}
                article={art(id)}
                label={`গ্রিড ${i + 1}`}
                slotKey={`grid:${i}`}
                variant="sm"
                onClear={clearSlot}
                onChoose={openPicker}
                onDragStart={setDragging}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </div>

        <div className="hl-col hl-col-mid">
          {slots.mid.map((id, i) => (
            <SlotCard
              key={`m-${i}`}
              article={art(id)}
              label={`মধ্য তালিকা ${i + 1}`}
              slotKey={`mid:${i}`}
              variant="row"
              onClear={clearSlot}
              onChoose={openPicker}
              onDragStart={setDragging}
              onDrop={handleDrop}
            />
          ))}
        </div>

        <div className="hl-col hl-col-story">
          <div className="hl-story-head" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>সেকশন নাম:</span>
            <input
              type="text"
              className="admin-input"
              style={{ padding: '3px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1, fontWeight: 600, color: '#0f172a' }}
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              placeholder="নিউজ স্টোরিজ"
            />
          </div>
          <SlotCard
            article={art(slots.story)}
            label="ডান বড় খবর"
            slotKey="story"
            variant="story"
            onClear={clearSlot}
            onChoose={openPicker}
            onDragStart={setDragging}
            onDrop={handleDrop}
          />
          {slots.storyList.map((id, i) => (
            <SlotCard
              key={`s-${i}`}
              article={art(id)}
              label={`স্টোরি ${i + 1}`}
              slotKey={`storyList:${i}`}
              variant="row"
              onClear={clearSlot}
              onChoose={openPicker}
              onDragStart={setDragging}
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>
      ) : (
      <div className={`hl-canvas hl-canvas-section${dragging ? ' is-dragging' : ''}`}>
        {(meta?.columns || []).map((col) => (
          <div key={col.title} className="hl-col">
            <div className="hl-story-head">{col.title}</div>
            {col.keys.map((index) => (
              <SlotCard
                key={`items-${index}`}
                article={art(items[index])}
                label={`${col.title} ${col.keys.length > 1 ? col.keys.indexOf(index) + 1 : ''}`.trim()}
                slotKey={`items:${index}`}
                variant={col.variant}
                onClear={clearSlot}
                onChoose={openPicker}
                onDragStart={setDragging}
                onDrop={handleDrop}
              />
            ))}
          </div>
        ))}
      </div>
      )}

      <div className="hl-pool">
        <div className="hl-pool-head">
          <h3>অন্য খবর থেকে টেনে আনুন</h3>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="খবর খুঁজুন..."
          />
        </div>
        <div className="hl-pool-list">
          {pool.map((a) => (
            <div
              key={a.id}
              className="hl-pool-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', `pool:${a.id}`)
                e.dataTransfer.effectAllowed = 'move'
                setDragging(`pool:${a.id}`)
              }}
              onDragEnd={() => setDragging('')}
            >
              <SafeImage src={a.image} alt={a.title} width={160} />
              <span>{a.title}</span>
            </div>
          ))}
          {!pool.length ? <p className="text-muted">আর খবর নেই / খুঁজে পাওয়া যায়নি</p> : null}
        </div>
      </div>

      {pickerSlot ? (
        <div
          className="hl-picker-backdrop"
          onClick={() => {
            setPickerSlot('')
            setPickerQ('')
          }}
        >
          <div className="hl-picker" onClick={(e) => e.stopPropagation()}>
            <div className="hl-picker-head">
              <h3>খবর বেছে নিন</h3>
              <button
                type="button"
                className="admin-btn admin-btn-secondary admin-btn-sm"
                onClick={() => {
                  setPickerSlot('')
                  setPickerQ('')
                }}
              >
                বন্ধ
              </button>
            </div>
            <input
              className="hl-picker-search"
              value={pickerQ}
              onChange={(e) => setPickerQ(e.target.value)}
              placeholder="খবর খুঁজুন..."
              autoFocus
            />
            <div className="hl-picker-list">
              {pickerList.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  className="hl-picker-item"
                  onClick={() => pickArticle(a.id)}
                >
                  <SafeImage src={a.image} alt={a.title} width={160} />
                  <span>
                    {a.title}
                    {a.categoryName ? <small>{a.categoryName}</small> : null}
                  </span>
                </button>
              ))}
              {!pickerList.length ? <p className="text-muted">খবর পাওয়া যায়নি</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
