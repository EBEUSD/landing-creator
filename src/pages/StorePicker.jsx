import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STORES } from '../stores'
import TeamsModal from '../components/TeamsModal'

export default function StorePicker() {
  const navigate = useNavigate()
  const [showTeams, setShowTeams] = useState(false)

  return (
    <div className="sp-root">
      <header className="sp-header">
        <div className="sp-header__logo">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity=".9"/>
            <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity=".5"/>
            <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".5"/>
            <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".9"/>
          </svg>
        </div>
        <h1 className="sp-header__title">Landing Creator</h1>
        <p className="sp-header__sub">Seleccioná una tienda para ver sus proyectos</p>
      </header>

      <div className="sp-grid">
        {STORES.map(store => (
          <button
            key={store.id}
            className="sp-card"
            style={{ '--sp-color': store.color, '--sp-text': store.textColor }}
            onClick={() => navigate(`/store/${store.id}`)}
          >
            <span className="sp-card__name">{store.name}</span>
          </button>
        ))}
      </div>

      <div className="sp-footer">
        <button className="sp-calendar-btn" onClick={() => navigate('/calendar')}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="2.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M1 6.5h14" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Calendario de proyectos
        </button>
        <button className="sp-calendar-btn" onClick={() => setShowTeams(true)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="11" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1 13c0-2.2 2.2-4 5-4s5 1.8 5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M11 9c1.5.3 3 1.5 3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Equipos
        </button>
      </div>

      {showTeams && <TeamsModal onClose={() => setShowTeams(false)} />}
    </div>
  )
}
