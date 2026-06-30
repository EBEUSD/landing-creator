import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, where, getDocs,
} from 'firebase/firestore'
import { db } from '../firebase'
import { STORES, draftKey } from '../stores'
import TeamsModal from '../components/TeamsModal'
import '../Calendar.css'

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
]

const EV_TOP = 34
const EV_H   = 24
const TEAM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// ── Date helpers ──────────────────────────────────────

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCalendarWeeks(year, month) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  const end = new Date(last)
  end.setDate(last.getDate() + (6 - last.getDay()))
  const weeks = []
  const cur = new Date(start)
  while (cur <= end) {
    const week = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function getWeekEvents(week, events) {
  const ws = week[0]
  const we = week[6]
  return events
    .filter(e => parseDate(e.startDate) <= we && parseDate(e.endDate) >= ws)
    .sort((a, b) => {
      const diff = parseDate(a.startDate) - parseDate(b.startDate)
      if (diff !== 0) return diff
      return (parseDate(b.endDate) - parseDate(b.startDate)) - (parseDate(a.endDate) - parseDate(a.startDate))
    })
    .map(e => {
      const s  = parseDate(e.startDate)
      const en = parseDate(e.endDate)
      const cs = s  < ws ? ws : s
      const ce = en > we ? we : en
      return {
        ...e,
        colStart:       cs.getDay(),
        colSpan:        ce.getDay() - cs.getDay() + 1,
        isStartClamped: s  < ws,
        isEndClamped:   en > we,
      }
    })
}

function assignLanes(weekEvs) {
  const occupied = []
  return weekEvs.map(ev => {
    let lane = 0
    for (;;) {
      const inLane  = occupied[lane] || []
      const clashes = inLane.some(o =>
        !(o.colStart + o.colSpan <= ev.colStart || ev.colStart + ev.colSpan <= o.colStart)
      )
      if (!clashes) {
        if (!occupied[lane]) occupied[lane] = []
        occupied[lane].push(ev)
        return { ...ev, lane }
      }
      lane++
    }
  })
}

// Normalize: old events have storeId (string), new ones have storeIds (array)
function getStoreIds(ev) {
  if (!ev) return []
  if (Array.isArray(ev.storeIds)) return ev.storeIds
  if (ev.storeId) return [ev.storeId]
  return []
}

// ── EventModal ────────────────────────────────────────

function EventModal({ event, onSave, onDelete, onClose }) {
  const now = toDateStr(new Date())
  const [name,      setName]      = useState(event?.name      ?? '')
  const [startDate, setStartDate] = useState(event?.startDate ?? now)
  const [endDate,   setEndDate]   = useState(event?.endDate   ?? now)
  const [color,     setColor]     = useState(event?.color     ?? PRESET_COLORS[0])
  const [storeIds,  setStoreIds]  = useState(() => getStoreIds(event))
  const [notes,     setNotes]     = useState(event?.notes     ?? '')
  const [teams,     setTeams]     = useState([])
  const [notifyIds, setNotifyIds] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'teams'), orderBy('createdAt')),
      snap => setTeams(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
      () => {}
    )
    return unsub
  }, [])

  const toggleStore  = id => setStoreIds(prev  => prev.includes(id)  ? prev.filter(s => s !== id)  : [...prev,  id])
  const toggleNotify = id => setNotifyIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  const handleSubmit = e => {
    e.preventDefault()
    if (!name.trim()) return

    const evData = {
      ...(event?.id ? { id: event.id } : {}),
      name:      name.trim(),
      startDate,
      endDate:   endDate >= startDate ? endDate : startDate,
      color,
      storeIds,
      notes,
    }

    const emails = teams
      .filter(t => notifyIds.includes(t.id))
      .flatMap(t => (t.members || []).map(m => m.email))
      .filter(Boolean)

    onSave(evData, [...new Set(emails)])
  }

  return (
    <div className="cal-modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="cal-modal">
        <div className="cal-modal__head">
          <h3 className="cal-modal__title">{event?.id ? 'Editar evento' : 'Nuevo evento'}</h3>
          <button className="cal-modal__close" type="button" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="cal-modal__form">
          <div className="cal-modal__field">
            <label>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Día del Padre, Hot Sale, Cyber Monday..."
              autoFocus
            />
          </div>

          <div className="cal-modal__row">
            <div className="cal-modal__field">
              <label>Desde</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="cal-modal__field">
              <label>Hasta</label>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="cal-modal__row">
            <div className="cal-modal__field">
              <label>Color</label>
              <div className="cal-color-swatches">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`cal-color-swatch${color === c ? ' cal-color-swatch--active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="cal-modal__field">
              <label>Tiendas</label>
              <div className="cal-store-toggles">
                {STORES.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`cal-store-toggle${storeIds.includes(s.id) ? ' cal-store-toggle--active' : ''}`}
                    style={{ '--sc': s.color, '--sc-text': s.textColor }}
                    onClick={() => toggleStore(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="cal-modal__field">
            <label>Notas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Detalles, links, referencias..."
              rows={3}
            />
          </div>

          {teams.length > 0 && (
            <div className="cal-modal__field">
              <label>Notificar al guardar</label>
              <div className="cal-notify-teams">
                {teams.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`cal-notify-team${notifyIds.includes(t.id) ? ' cal-notify-team--active' : ''}`}
                    style={{ '--tc': t.color || TEAM_COLORS[0] }}
                    onClick={() => toggleNotify(t.id)}
                  >
                    <span className="cal-notify-dot" style={{ background: t.color || TEAM_COLORS[0] }} />
                    {t.name}
                    <span className="cal-notify-count">{(t.members || []).length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="cal-modal__actions">
            {event?.id && (
              <button
                type="button"
                className="cal-modal__del"
                onClick={() => { onDelete(event.id); onClose() }}
              >
                Eliminar
              </button>
            )}
            <div className="cal-modal__actions-right">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={!name.trim()}>
                {event?.id ? 'Guardar' : 'Crear evento'}
                {notifyIds.length > 0 && ` · Notificar (${notifyIds.length})`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── EventDetailModal ──────────────────────────────────

function EventDetailModal({ event, onEdit, onDelete, onCreateProject, onOpenProject, onClose }) {
  const [projectsByStore, setProjectsByStore] = useState({})
  const [loading,         setLoading]         = useState(true)

  const storeIds  = getStoreIds(event)
  const evStores  = storeIds.map(id => STORES.find(s => s.id === id)).filter(Boolean)

  useEffect(() => {
    if (!storeIds.length) { setLoading(false); return }

    Promise.all(
      storeIds.map(async storeId => {
        try {
          const snap = await getDocs(
            query(collection(db, 'stores', storeId, 'projects'), where('eventId', '==', event.id))
          )
          return [storeId, snap.docs.map(d => d.data())]
        } catch {
          return [storeId, []]
        }
      })
    ).then(entries => {
      setProjectsByStore(Object.fromEntries(entries))
      setLoading(false)
    })
  }, [event.id]) // eslint-disable-line

  return (
    <div className="cal-modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="cal-modal cal-modal--detail">

        {/* Header */}
        <div className="cal-detail__head">
          <div className="cal-detail__ev-info">
            <span className="cal-detail__ev-dot" style={{ background: event.color || PRESET_COLORS[0] }} />
            <div>
              <div className="cal-detail__ev-name">{event.name}</div>
              <div className="cal-detail__ev-meta">
                {parseDate(event.startDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                {event.startDate !== event.endDate && (
                  <> → {parseDate(event.endDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                )}
                {evStores.length > 0 && <> · {evStores.map(s => s.name).join(', ')}</>}
              </div>
              {event.notes && <div className="cal-detail__ev-notes">{event.notes}</div>}
            </div>
          </div>
          <button className="cal-modal__close" type="button" onClick={onClose}>✕</button>
        </div>

        {/* Divider + section title */}
        <div className="cal-detail__section-title">Proyectos asignados</div>

        {/* Projects body */}
        <div className="cal-detail__body">
          {storeIds.length === 0 ? (
            <div className="cal-detail__no-stores">
              <p>Este evento no tiene tiendas asignadas.</p>
              <button className="btn-ghost" onClick={onEdit} style={{ marginTop: 8 }}>
                Editar y asignar tiendas
              </button>
            </div>
          ) : (
            evStores.map(store => {
              const storeProjects = projectsByStore[store.id] || []
              return (
                <div key={store.id} className="cal-detail__store">
                  <div className="cal-detail__store-head">
                    <span className="cal-detail__store-dot" style={{ background: store.color }} />
                    <span className="cal-detail__store-name">{store.name}</span>
                    <button
                      className="cal-detail__create-btn"
                      onClick={() => onCreateProject(store.id, event.id, event.name)}
                    >
                      + Crear proyecto
                    </button>
                  </div>

                  {loading ? (
                    <div className="cal-detail__empty">Cargando...</div>
                  ) : storeProjects.length === 0 ? (
                    <div className="cal-detail__empty">
                      Sin proyectos asignados a este evento.
                    </div>
                  ) : (
                    <ul className="cal-detail__projects">
                      {storeProjects.map(p => (
                        <li
                          key={p.id}
                          className="cal-detail__project cal-detail__project--clickable"
                          onClick={() => onOpenProject(store.id, p)}
                          title="Abrir en editor"
                        >
                          <span className="cal-detail__project-name">{p.name}</span>
                          <span className="cal-detail__project-meta">
                            {new Date(p.savedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                            {' · '}{p.canvas.length} componente{p.canvas.length !== 1 ? 's' : ''}
                          </span>
                          <svg className="cal-detail__project-arrow" width="10" height="10" viewBox="0 0 16 16" fill="none">
                            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="cal-detail__footer">
          <button className="cal-modal__del" onClick={() => onDelete(event.id)}>Eliminar</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={onClose}>Cerrar</button>
            <button className="btn-primary" onClick={onEdit}>Editar evento</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Calendar ─────────────────────────────────────

export default function Calendar() {
  const navigate  = useNavigate()
  const today     = new Date()
  const todayStr  = toDateStr(today)

  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [events,    setEvents]    = useState([])
  const [selectedDay,  setSelectedDay]  = useState(null)
  // activeModal: null | { mode: 'detail'|'edit', event: obj|null }
  const [activeModal, setActiveModal] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'calEvents'), orderBy('startDate'))
    const unsub = onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ ...d.data(), id: d.id })))
    }, () => {})
    return unsub
  }, [])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }

  const openNew    = (prefill = null) => setActiveModal({ mode: 'edit', event: prefill })
  const openDetail = (ev)             => setActiveModal({ mode: 'detail', event: ev })
  const openEdit   = (ev)             => setActiveModal({ mode: 'edit', event: ev })
  const closeModal = ()               => setActiveModal(null)

  const handleSaveEvent = async (evData, notifyEmails = []) => {
    if (evData.id) {
      const { id, ...rest } = evData
      await updateDoc(doc(db, 'calEvents', id), rest)
    } else {
      await addDoc(collection(db, 'calEvents'), { ...evData, createdAt: Date.now() })
    }
    closeModal()

    if (notifyEmails.length > 0) {
      const storeNames = (evData.storeIds || [])
        .map(id => STORES.find(s => s.id === id)?.name).filter(Boolean).join(', ')
      const dateRange = evData.startDate === evData.endDate
        ? parseDate(evData.startDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
        : `${parseDate(evData.startDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} al ${parseDate(evData.endDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      const subject = `Evento: ${evData.name}`
      const body = [
        `Hola,`,
        ``,
        `Se ${evData.id ? 'actualizó' : 'creó'} un evento en Landing Creator:`,
        ``,
        `▸ ${evData.name}`,
        `  Fecha: ${dateRange}`,
        storeNames ? `  Tiendas: ${storeNames}` : '',
        evData.notes ? `  Notas: ${evData.notes}` : '',
        ``,
        `— Landing Creator`,
      ].filter(l => l !== '').join('\n')
      window.open(`mailto:${notifyEmails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    }
  }

  const handleDeleteEvent = async id => {
    if (window.confirm('¿Eliminar este evento?')) {
      await deleteDoc(doc(db, 'calEvents', id))
      setSelectedDay(null)
      closeModal()
    }
  }

  const handleCreateProject = (storeId, eventId, eventName) => {
    localStorage.setItem(draftKey(storeId), JSON.stringify({ projectName: eventName, eventId }))
    navigate(`/store/${storeId}/editor`)
  }

  const handleOpenProject = (storeId, project) => {
    localStorage.setItem(draftKey(storeId), JSON.stringify({
      canvas:           project.canvas,
      palette:          project.palette,
      projectName:      project.name,
      currentProjectId: project.id,
      folderLink:       project.folderLink ?? '',
      eventId:          project.eventId ?? null,
      projectCode:      project.projectCode ?? null,
    }))
    navigate(`/store/${storeId}/editor`)
  }

  const weeks       = getCalendarWeeks(viewYear, viewMonth)
  const selectedStr = selectedDay ? toDateStr(selectedDay) : null

  const dayEvents = selectedDay
    ? events.filter(e => selectedDay >= parseDate(e.startDate) && selectedDay <= parseDate(e.endDate))
    : []

  const panelEvents = events
    .filter(e => parseDate(e.endDate) >= new Date(viewYear, viewMonth, 1))
    .slice(0, 12)

  return (
    <div className="cal-root">

      {/* ── Topbar ───────────────────────────────── */}
      <div className="cal-topbar">
        <button className="cal-back" onClick={() => navigate('/')}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Tiendas
        </button>

        <span className="cal-topbar__title">Calendario</span>

        <div className="cal-topbar__nav">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <span className="cal-topbar__month">{MONTHS[viewMonth]} {viewYear}</span>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        </div>

        <button className="cal-today-btn" onClick={goToday}>Hoy</button>

        <button
          className="cal-teams-btn"
          onClick={() => setActiveModal({ mode: 'teams' })}
          title="Gestionar equipos"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="11" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1 13c0-2.2 2.2-4 5-4s5 1.8 5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M11 9c1.5.3 3 1.5 3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Equipos
        </button>

        <button
          className="btn-primary cal-new-btn"
          onClick={() => openNew(selectedStr ? { startDate: selectedStr, endDate: selectedStr } : null)}
        >
          + Nuevo evento
        </button>
      </div>

      {/* ── Body ─────────────────────────────────── */}
      <div className="cal-body">

        {/* Calendar grid */}
        <div className="cal-grid-wrap">
          <div className="cal-day-headers">
            {DAYS_SHORT.map(d => <div key={d} className="cal-day-header">{d}</div>)}
          </div>

          <div className="cal-grid">
            {weeks.map((week, wi) => {
              const weekEvs = assignLanes(getWeekEvents(week, events))
              const maxLane = weekEvs.length ? Math.max(...weekEvs.map(e => e.lane)) : -1
              const weekH   = EV_TOP + (maxLane + 1) * EV_H + 10

              return (
                <div key={wi} className="cal-week" style={{ minHeight: Math.max(weekH, EV_TOP + 10) }}>
                  {/* Day cells */}
                  {week.map((day, di) => {
                    const inMonth = day.getMonth() === viewMonth
                    const isToday = toDateStr(day) === todayStr
                    const isSel   = selectedStr === toDateStr(day)
                    const hasEv   = events.some(e =>
                      day >= parseDate(e.startDate) && day <= parseDate(e.endDate)
                    )
                    return (
                      <div
                        key={di}
                        className={[
                          'cal-day',
                          !inMonth && 'cal-day--other',
                          isToday  && 'cal-day--today',
                          isSel    && 'cal-day--selected',
                        ].filter(Boolean).join(' ')}
                        onClick={() => setSelectedDay(day)}
                      >
                        <span className="cal-day__num">{day.getDate()}</span>
                        {hasEv && !weekEvs.length && <span className="cal-day__dot" />}
                      </div>
                    )
                  })}

                  {/* Event bars */}
                  {weekEvs.map(ev => {
                    const evStoreIds = getStoreIds(ev)
                    const evStores   = evStoreIds.map(id => STORES.find(s => s.id === id)).filter(Boolean)
                    return (
                      <div
                        key={ev.id + '-w' + wi}
                        className={[
                          'cal-ev',
                          ev.isStartClamped && 'cal-ev--no-left',
                          ev.isEndClamped   && 'cal-ev--no-right',
                        ].filter(Boolean).join(' ')}
                        style={{
                          top:        EV_TOP + ev.lane * EV_H,
                          left:       `calc(${ev.colStart} / 7 * 100% + 3px)`,
                          width:      `calc(${ev.colSpan} / 7 * 100% - 6px)`,
                          background: ev.color || PRESET_COLORS[0],
                        }}
                        onClick={e => { e.stopPropagation(); openDetail(ev) }}
                        title={ev.name}
                      >
                        <span className="cal-ev__name">
                          {!ev.isStartClamped && ev.name}
                        </span>
                        {!ev.isStartClamped && evStores.map(s => (
                          <span key={s.id} className="cal-ev__store" style={{ background: s.color }}>
                            {s.name[0]}
                          </span>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Side panel ───────────────────────────── */}
        <aside className="cal-panel">
          {selectedDay ? (
            <div className="cal-panel__day">
              <div className="cal-panel__day-head">
                <div>
                  <span className="cal-panel__day-name">
                    {selectedDay.toLocaleDateString('es-AR', { weekday: 'long' })}
                  </span>
                  <span className="cal-panel__day-date">
                    {selectedDay.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <button
                  className="cal-panel__add-btn"
                  title="Nuevo evento este día"
                  onClick={() => openNew({ startDate: selectedStr, endDate: selectedStr })}
                >
                  +
                </button>
              </div>

              {dayEvents.length === 0 ? (
                <p className="cal-panel__empty">Sin eventos este día.</p>
              ) : (
                <ul className="cal-panel__ev-list">
                  {dayEvents.map(ev => {
                    const evStores = getStoreIds(ev).map(id => STORES.find(s => s.id === id)).filter(Boolean)
                    return (
                      <li key={ev.id} className="cal-panel__ev-item">
                        <span className="cal-panel__ev-dot" style={{ background: ev.color || PRESET_COLORS[0] }} />
                        <div className="cal-panel__ev-body">
                          <div className="cal-panel__ev-name">{ev.name}</div>
                          <div className="cal-panel__ev-meta">
                            {parseDate(ev.startDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                            {ev.startDate !== ev.endDate && (
                              <> → {parseDate(ev.endDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</>
                            )}
                            {evStores.length > 0 && <> · {evStores.map(s => s.name).join(', ')}</>}
                          </div>
                          {ev.notes && <div className="cal-panel__ev-notes">{ev.notes}</div>}

                          <div className="cal-panel__ev-projects">
                            <span className="cal-panel__ev-projects-label">Crear proyecto en:</span>
                            <div className="cal-panel__ev-stores">
                              {STORES.map(s => (
                                <button
                                  key={s.id}
                                  className="cal-panel__store-btn"
                                  style={{ '--sc': s.color, '--sc-text': s.textColor }}
                                  onClick={() => handleCreateProject(s.id, ev.id, ev.name)}
                                  title={`Crear proyecto en ${s.name}`}
                                >
                                  {s.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button
                          className="cal-panel__ev-edit"
                          onClick={() => openEdit(ev)}
                          title="Editar evento"
                        >
                          ✎
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div className="cal-panel__list">
              <div className="cal-panel__list-head">
                <span className="cal-panel__list-title">Eventos · {MONTHS[viewMonth]}</span>
              </div>
              {panelEvents.length === 0 ? (
                <p className="cal-panel__empty">No hay eventos este mes.</p>
              ) : (
                <ul className="cal-panel__ev-list">
                  {panelEvents.map(ev => {
                    const evStores = getStoreIds(ev).map(id => STORES.find(s => s.id === id)).filter(Boolean)
                    return (
                      <li
                        key={ev.id}
                        className="cal-panel__ev-item cal-panel__ev-item--clickable"
                        onClick={() => openDetail(ev)}
                      >
                        <span className="cal-panel__ev-dot" style={{ background: ev.color || PRESET_COLORS[0] }} />
                        <div className="cal-panel__ev-body">
                          <div className="cal-panel__ev-name">{ev.name}</div>
                          <div className="cal-panel__ev-meta">
                            {parseDate(ev.startDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                            {ev.startDate !== ev.endDate && (
                              <> → {parseDate(ev.endDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</>
                            )}
                            {evStores.length > 0 && <> · {evStores.map(s => s.name).join(', ')}</>}
                          </div>
                        </div>
                        <svg className="cal-panel__ev-arrow" width="10" height="10" viewBox="0 0 16 16" fill="none">
                          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>

      {activeModal?.mode === 'teams' && (
        <TeamsModal onClose={closeModal} />
      )}
      {activeModal?.mode === 'detail' && (
        <EventDetailModal
          event={activeModal.event}
          onEdit={() => openEdit(activeModal.event)}
          onDelete={handleDeleteEvent}
          onCreateProject={handleCreateProject}
          onOpenProject={handleOpenProject}
          onClose={closeModal}
        />
      )}
      {activeModal?.mode === 'edit' && (
        <EventModal
          event={activeModal.event}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
