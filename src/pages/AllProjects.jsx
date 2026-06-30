import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { STORES, draftKey } from '../stores'

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AllProjects() {
  const navigate = useNavigate()
  const [projectsByStore, setProjectsByStore] = useState({})
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    let loaded = 0
    const unsubs = STORES.map(store => {
      const q = query(collection(db, 'stores', store.id, 'projects'), orderBy('savedAt', 'desc'))
      return onSnapshot(q, snap => {
        setProjectsByStore(prev => ({
          ...prev,
          [store.id]: snap.docs.map(d => d.data()),
        }))
        loaded++
        if (loaded >= STORES.length) setLoading(false)
      }, () => { loaded++; if (loaded >= STORES.length) setLoading(false) })
    })
    return () => unsubs.forEach(u => u())
  }, [])

  const allProjects = STORES.flatMap(store =>
    (projectsByStore[store.id] || []).map(p => ({ ...p, store }))
  ).sort((a, b) => b.savedAt - a.savedAt)

  const filtered = search.trim()
    ? allProjects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.projectCode && p.projectCode.toLowerCase().includes(search.toLowerCase())) ||
        p.store.name.toLowerCase().includes(search.toLowerCase())
      )
    : allProjects

  const handleOpen = (p) => {
    navigate(`/store/${p.store.id}/editor?p=${p.id}`)
  }

  return (
    <div className="ap-root">
      <div className="ap-topbar">
        <button className="ap-back" onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Inicio
        </button>
        <span className="ap-title">Todos los proyectos</span>
        <div className="ap-search-wrap">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="ap-search-icon">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="ap-search"
            type="text"
            placeholder="Buscar por nombre, ID o tienda..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && <button className="ap-search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
      </div>

      <div className="ap-body">
        {loading ? (
          <div className="ap-empty">Cargando proyectos...</div>
        ) : filtered.length === 0 ? (
          <div className="ap-empty">
            {search ? `Sin resultados para "${search}"` : 'No hay proyectos todavía.'}
          </div>
        ) : (
          <ul className="ap-list">
            {filtered.map(p => (
              <li key={`${p.store.id}-${p.id}`} className="ap-item">
                <span className="ap-item__store-dot" style={{ background: p.store.color }} />
                <div className="ap-item__info">
                  <div className="ap-item__name-row">
                    {p.projectCode && <span className="ap-item__code">{p.projectCode}</span>}
                    <span className="ap-item__name">{p.name}</span>
                  </div>
                  <span className="ap-item__meta">
                    {p.store.name} · {formatDate(p.savedAt)} · {p.canvas.length} componente{p.canvas.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button className="btn-primary ap-item__open" onClick={() => handleOpen(p)}>
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
