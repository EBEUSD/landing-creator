import { useNavigate } from 'react-router-dom'
import { STORES } from '../stores'

export default function StorePicker() {
  const navigate = useNavigate()

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
    </div>
  )
}
