import { useLang } from '../context/LanguageContext'

export default function LangSwitch({ className = '' }) {
  const { lang, setLang } = useLang()
  const isCompact = className.includes('lang-switch--compact')

  if (isCompact) {
    const nextLang = lang === 'bn' ? 'en' : 'bn'
    return (
      <button
        type="button"
        className={`lang-switch lang-switch--compact ${className}`.trim()}
        onClick={() => setLang(nextLang)}
        aria-label={`Switch to ${nextLang === 'en' ? 'English' : 'বাংলা'}`}
        title={`Switch to ${nextLang === 'en' ? 'English' : 'বাংলা'}`}
      >
        <i className="fa-solid fa-globe lang-icon" aria-hidden="true" />
        <span className="lang-code">{lang === 'bn' ? 'বাং' : 'EN'}</span>
      </button>
    )
  }

  return (
    <div className={`lang-switch ${className}`.trim()} role="group" aria-label="Language">
      <button
        type="button"
        className={lang === 'bn' ? 'active' : ''}
        onClick={() => setLang('bn')}
      >
        বাংলা
      </button>
      <span className="lang-switch-sep">|</span>
      <button
        type="button"
        className={lang === 'en' ? 'active' : ''}
        onClick={() => setLang('en')}
      >
        English
      </button>
    </div>
  )
}
