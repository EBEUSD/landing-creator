import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, onSnapshot, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { STORES, draftKey } from '../stores'

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ProjectsList() {
  const { storeId } = useParams()
  const navigate = useNavigate()
  const store = STORES.find(s => s.id === storeId)

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    if (!storeId) return
    const q = query(
      collection(db, 'stores', storeId, 'projects'),
      orderBy('savedAt', 'desc')
    )
    const unsub = onSnapshot(q, snap => {
      setProjects(snap.docs.map(d => d.data()))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [storeId])

  if (!store) {
    return (
      <div className="pl-root">
        <p>Tienda no encontrada.</p>
        <button className="btn-ghost" onClick={() => navigate('/')}>← Volver</button>
      </div>
    )
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleOpen = (project) => {
    localStorage.setItem(draftKey(storeId), JSON.stringify({
      canvas: project.canvas,
      palette: project.palette,
      projectName: project.name,
      currentProjectId: project.id,
      folderLink: project.folderLink ?? '',
    }))
    navigate(`/store/${storeId}/editor`)
  }

  const handleNew = () => {
    localStorage.removeItem(draftKey(storeId))
    navigate(`/store/${storeId}/editor`)
  }

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'stores', storeId, 'projects', id))
    setConfirmDelete(null)
  }

  return (
    <div className="pl-root">
      <div className="pl-topbar" style={{ '--store-color': store.color }}>
        <button className="pl-back" onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Tiendas
        </button>
        <div className="pl-topbar__store">
          <span className="pl-topbar__dot" style={{ background: store.color }} />
          <span className="pl-topbar__name">{store.name}</span>
        </div>
        <button className="pl-new-btn" onClick={handleNew}>
          + Nuevo proyecto
        </button>
      </div>

      <div className="pl-body">
        <div className="pl-search-wrap">
          <input
            className="pl-search"
            type="text"
            placeholder="Buscar proyecto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="pl-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {loading ? (
          <div className="pl-empty">
            <p>Cargando proyectos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="pl-empty">
            {search
              ? <p>No hay resultados para <strong>"{search}"</strong></p>
              : (
                <>
                  <p>No hay proyectos guardados para {store.name}.</p>
                  <button className="btn-primary" onClick={handleNew}>Crear el primero</button>
                </>
              )
            }
          </div>
        ) : (
          <ul className="pl-list">
            {filtered.map(p => (
              <li key={p.id} className="pl-item">
                <div className="pl-item__info">
                  <span className="pl-item__name">{p.name}</span>
                  <span className="pl-item__meta">
                    {formatDate(p.savedAt)} · {p.canvas.length} componente{p.canvas.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="pl-item__actions">
                  <button className="btn-primary pl-item__open" onClick={() => handleOpen(p)}>
                    Abrir
                  </button>
                  {confirmDelete === p.id ? (
                    <span className="pl-item__confirm">
                      <button className="pl-item__confirm-yes" onClick={() => handleDelete(p.id)}>Eliminar</button>
                      <button className="pl-item__confirm-no" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                    </span>
                  ) : (
                    <button className="pl-item__delete" onClick={() => setConfirmDelete(p.id)} title="Eliminar">
                      ✕
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
