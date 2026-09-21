import { useEffect, useRef } from 'react'
import { useSiteData } from '../context/SiteDataContext'

/** Applies site-wide SEO snippets: verification, GA, favicon, default keywords/author. */
export default function SiteSeoSnippets() {
  const { settings } = useSiteData()
  const gaDone = useRef('')

  useEffect(() => {
    if (!settings) return
    const seo = settings.seo || {}

    if (seo.googleVerification) {
      let el = document.head.querySelector('meta[name="google-site-verification"]')
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('name', 'google-site-verification')
        document.head.appendChild(el)
      }
      el.setAttribute('content', seo.googleVerification)
    }

    if (seo.metaAuthor) {
      let el = document.head.querySelector('meta[name="author"]')
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('name', 'author')
        document.head.appendChild(el)
      }
      el.setAttribute('content', seo.metaAuthor)
    }

    if (seo.metaKeyword) {
      let el = document.head.querySelector('meta[name="keywords"]')
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('name', 'keywords')
        document.head.appendChild(el)
      }
      el.setAttribute('content', seo.metaKeyword)
    }

    const rawFavicon = String(settings.favicon || '').trim()
    const rev = settings.faviconRev ? String(settings.faviconRev) : String(Date.now())
    const favicon = `/api/settings/favicon?v=${encodeURIComponent(rev)}`
    const type = rawFavicon.toLowerCase().includes('.svg')
      ? 'image/svg+xml'
      : rawFavicon.toLowerCase().includes('.ico')
        ? 'image/x-icon'
        : rawFavicon.toLowerCase().includes('.jpg') || rawFavicon.toLowerCase().includes('.jpeg')
          ? 'image/jpeg'
          : 'image/png'

    document.head
      .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      .forEach((el) => el.remove())

    ;[
      ['icon', type],
      ['shortcut icon', type],
      ['apple-touch-icon', type],
    ].forEach(([rel, mime]) => {
      const link = document.createElement('link')
      link.setAttribute('rel', rel)
      link.setAttribute('href', favicon)
      if (rel !== 'apple-touch-icon') link.setAttribute('type', mime)
      document.head.appendChild(link)
    })
    const ga = (seo.googleAnalytics || '').trim()
    if (ga && ga !== gaDone.current) {
      gaDone.current = ga
      if (ga.startsWith('G-') || ga.startsWith('UA-')) {
        const s1 = document.createElement('script')
        s1.async = true
        s1.src = `https://www.googletagmanager.com/gtag/js?id=${ga}`
        document.head.appendChild(s1)
        const s2 = document.createElement('script')
        s2.id = 'kk-ga'
        s2.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`
        document.head.appendChild(s2)
      } else if (ga.includes('<script')) {
        const wrap = document.createElement('div')
        wrap.innerHTML = ga
        Array.from(wrap.childNodes).forEach((node) => {
          if (node.tagName === 'SCRIPT') {
            const s = document.createElement('script')
            if (node.src) s.src = node.src
            s.textContent = node.textContent
            document.head.appendChild(s)
          }
        })
      }
    }
  }, [settings])

  return null
}
