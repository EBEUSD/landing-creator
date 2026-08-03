import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection, onSnapshot, deleteDoc, doc, updateDoc,
  addDoc, query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'
import { STORES, draftKey } from '../stores'

function formatSavedDate(ts) {
  return new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatEventDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── New project modal ──────────────────────────────────

function NewProjectModal({ store, onConfirm, onClose }) {
  const today = toDateStr(new Date())
  const [name,      setName]      = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate,   setEndDate]   = useState(today)
  const [saving,    setSaving]    = useState(false)

  const hasDates = startDate && endDate

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    await onConfirm({ name: name.trim(), startDate, endDate })
  }

  return (
    <div className="pl-modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="pl-modal">
        <div className="pl-modal__head">
          <div className="pl-modal__head-info">
            <span className="pl-modal__store-dot" style={{ background: store.color }} />
            <h3 className="pl-modal__title">Nuevo proyecto · {store.name}</h3>
          </div>
          <button className="pl-modal__close" type="button" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="pl-modal__form">
          <div className="pl-modal__field">
            <label>Nombre del proyecto</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Landing Día del Padre..."
              autoFocus
            />
          </div>

          <div className="pl-modal__row">
            <div className="pl-modal__field">
              <label>Fecha inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="pl-modal__field">
              <label>Fecha fin</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {hasDates && name.trim() && (
            <div className="pl-modal__hint">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="2.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M1 6.5h14" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Se creará un evento en el calendario para {store.name}
            </div>
          )}

          <div className="pl-modal__actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!name.trim() || saving}>
              {saving ? 'Creando...' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Assign dropdown ────────────────────────────────────

function AssignDropdown({ project, calEvents, onAssign, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const handle = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  return (
    <div className="pl-assign-dropdown" ref={ref}>
      <div className="pl-assign-head">Asignar a evento</div>
      {project.eventId && (
        <button className="pl-assign-option pl-assign-option--clear" onClick={() => onAssign(null)}>
          Sin evento
        </button>
      )}
      {calEvents.length === 0 ? (
        <div className="pl-assign-empty">No hay eventos en el calendario.</div>
      ) : (
        calEvents.map(ev => (
          <button
            key={ev.id}
            className={`pl-assign-option${project.eventId === ev.id ? ' pl-assign-option--active' : ''}`}
            onClick={() => onAssign(ev.id)}
          >
            <span className="pl-assign-dot" style={{ background: ev.color || '#3b82f6' }} />
            <span className="pl-assign-name">{ev.name}</span>
            <span className="pl-assign-date">{formatEventDate(ev.startDate)}</span>
          </button>
        ))
      )}
    </div>
  )
}

// ── ProjectsList ───────────────────────────────────────

export default function ProjectsList() {
  const { storeId } = useParams()
  const navigate    = useNavigate()
  const store       = STORES.find(s => s.id === storeId)

  const [projects,       setProjects]       = useState([])
  const [calEvents,      setCalEvents]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [sortBy,         setSortBy]         = useState('edited') // 'edited' | 'calendar'
  const [sortDir,        setSortDir]        = useState('asc') // 'asc' | 'desc' (fecha de calendario)
  const [calendarRange,  setCalendarRange]  = useState(null) // null | 7 | 14
  const [confirmDelete,  setConfirmDelete]  = useState(null)
  const [assigningId,    setAssigningId]    = useState(null)
  const [showNewModal,   setShowNewModal]   = useState(false)

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, 'stores', storeId, 'projects'), orderBy('savedAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setProjects(snap.docs.map(d => d.data()))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [storeId])

  useEffect(() => {
    const q = query(collection(db, 'calEvents'), orderBy('startDate'))
    const unsub = onSnapshot(q, snap => {
      setCalEvents(snap.docs.map(d => ({ ...d.data(), id: d.id })))
    }, () => {})
    return unsub
  }, [])

  if (!store) {
    return (
      <div className="pl-root">
        <p>Tienda no encontrada.</p>
        <button className="btn-ghost" onClick={() => navigate('/')}>← Volver</button>
      </div>
    )
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.projectCode && p.projectCode.toLowerCase().includes(search.toLowerCase()))
  )

  const rangeFiltered = (sortBy === 'calendar' && calendarRange)
    ? filtered.filter(p => {
        const ev = p.eventId ? calEvents.find(e => e.id === p.eventId) : null
        if (!ev) return false
        const today = toDateStr(new Date())
        const limit = toDateStr(new Date(Date.now() + calendarRange * 86400000))
        return ev.startDate >= today && ev.startDate <= limit
      })
    : filtered

  const sorted = [...rangeFiltered].sort((a, b) => {
    if (sortBy === 'calendar') {
      const evA = a.eventId ? calEvents.find(e => e.id === a.eventId) : null
      const evB = b.eventId ? calEvents.find(e => e.id === b.eventId) : null
      if (evA && evB) return sortDir === 'asc'
        ? evA.startDate.localeCompare(evB.startDate)
        : evB.startDate.localeCompare(evA.startDate)
      if (evA) return -1
      if (evB) return 1
      return b.savedAt - a.savedAt
    }
    return b.savedAt - a.savedAt
  })

  const handleOpen = (project) => {
    navigate(`/store/${storeId}/editor?p=${project.id}`)
  }

  const handleNew = () => setShowNewModal(true)

  const handleConfirmNew = async ({ name, startDate, endDate }) => {
    let eventId = null

    if (startDate && endDate) {
      const ed = endDate >= startDate ? endDate : startDate
      const ref = await addDoc(collection(db, 'calEvents'), {
        name,
        startDate,
        endDate: ed,
        color:    store.color,
        storeIds: [storeId],
        notes:    '',
        createdAt: Date.now(),
      })
      eventId = ref.id
    }

    localStorage.setItem(draftKey(storeId), JSON.stringify({ projectName: name, eventId }))
    setShowNewModal(false)
    navigate(`/store/${storeId}/editor`)
  }

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'stores', storeId, 'projects', id))
    setConfirmDelete(null)
  }

  const handleAssignEvent = async (projectId, evId) => {
    await updateDoc(doc(db, 'stores', storeId, 'projects', projectId), { eventId: evId })
    setAssigningId(null)
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

        <div className="pl-sort-wrap">
          <span className="pl-sort-label">Ordenar por</span>
          <button
            className={`pl-sort-btn${sortBy === 'edited' ? ' pl-sort-btn--on' : ''}`}
            onClick={() => setSortBy('edited')}
          >
            Fecha de edición
          </button>
          <button
            className={`pl-sort-btn${sortBy === 'calendar' ? ' pl-sort-btn--on' : ''}`}
            onClick={() => setSortBy('calendar')}
          >
            Fecha de calendario
          </button>

          {sortBy === 'calendar' && (
            <>
              <span className="pl-sort-sep" />
              <button
                className={`pl-sort-btn${sortDir === 'asc' ? ' pl-sort-btn--on' : ''}`}
                onClick={() => setSortDir('asc')}
                title="Más próximos primero"
              >
                ↑ Ascendente
              </button>
              <button
                className={`pl-sort-btn${sortDir === 'desc' ? ' pl-sort-btn--on' : ''}`}
                onClick={() => setSortDir('desc')}
                title="Más lejanos primero"
              >
                ↓ Descendente
              </button>
              <span className="pl-sort-sep" />
              <button
                className={`pl-sort-btn${calendarRange === 7 ? ' pl-sort-btn--on' : ''}`}
                onClick={() => setCalendarRange(calendarRange === 7 ? null : 7)}
              >
                Próximos 7 días
              </button>
              <button
                className={`pl-sort-btn${calendarRange === 14 ? ' pl-sort-btn--on' : ''}`}
                onClick={() => setCalendarRange(calendarRange === 14 ? null : 14)}
              >
                Próximos 14 días
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div className="pl-empty">
            <p>Cargando proyectos...</p>
          </div>
        ) : sorted.length === 0 ? (
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
            {sorted.map(p => {
              const ev = p.eventId ? calEvents.find(e => e.id === p.eventId) : null
              return (
                <li key={p.id} className="pl-item">
                  <div className="pl-item__info">
                    <div className="pl-item__name-row">
                      {p.projectCode && (
                        <span className="pl-item__code">{p.projectCode}</span>
                      )}
                      <span className="pl-item__name">{p.name}</span>
                    </div>
                    <span className="pl-item__meta">
                      {ev
                        ? (
                          <>
                            <span className="pl-item__ev-dot" style={{ background: ev.color || '#3b82f6' }} />
                            {formatEventDate(ev.startDate)}
                            <span className="pl-item__ev-name"> · {ev.name}</span>
                            <span> · {p.canvas.length} componente{p.canvas.length !== 1 ? 's' : ''}</span>
                          </>
                        )
                        : `${formatSavedDate(p.savedAt)} · ${p.canvas.length} componente${p.canvas.length !== 1 ? 's' : ''}`
                      }
                    </span>
                  </div>

                  <div className="pl-item__actions">
                    {/* Assign to event */}
                    <div className="pl-assign-wrap">
                      <button
                        className={`pl-item__assign${ev ? ' pl-item__assign--active' : ''}`}
                        title={ev ? `Evento: ${ev.name}` : 'Asignar a evento del calendario'}
                        onClick={() => setAssigningId(assigningId === p.id ? null : p.id)}
                      >
                        {ev ? (
                          <span
                            className="pl-item__assign-store"
                            style={{ background: store.color }}
                          >
                            {store.name[0].toUpperCase()}
                          </span>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                            <rect x="1" y="2.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                            <path d="M1 6.5h14" stroke="currentColor" strokeWidth="1.4"/>
                            <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                        )}
                      </button>
                      {assigningId === p.id && (
                        <AssignDropdown
                          project={p}
                          calEvents={calEvents}
                          onAssign={evId => handleAssignEvent(p.id, evId)}
                          onClose={() => setAssigningId(null)}
                        />
                      )}
                    </div>

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
              )
            })}
          </ul>
        )}
      </div>

      {showNewModal && (
        <NewProjectModal
          store={store}
          onConfirm={handleConfirmNew}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  )
}
