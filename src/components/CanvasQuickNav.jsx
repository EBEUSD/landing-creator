import { useState } from 'react'
import { normalizeNotes } from './CanvasItemNotes'

const PENDING = [
  { value: 'por-hacer',       label: 'Por hacer',         color: '#facc15', text: '#713f12' },
  { value: 'falta-completar', label: 'Falta · Dudas',     color: '#a855f7', text: '#fff'    },
  { value: 'listo-no-subido', label: 'Listo · No subido', color: '#f97316', text: '#fff'    },
  { value: 'eliminar',        label: 'Eliminar',          color: '#ef4444', text: '#fff'    },
]
const PENDING_SET = new Set(PENDING.map(s => s.value))

function scrollToItem(instanceId) {
  const el = document.getElementById(`ci-${instanceId}`)
  if (!el) return
  const container = document.querySelector('.canvas-scroll')
  if (container) {
    const offset = el.getBoundingClientRect().top - container.getBoundingClientRect().top
    container.scrollBy({ top: offset - 8, behavior: 'smooth' })
  }
}

export default function CanvasQuickNav({ canvas }) {
  const [open, setOpen] = useState(true)

  const pending = canvas
    .map((item, idx) => {
      const rows = normalizeNotes(item.notes)
      const counts = {}
      rows.forEach(row => {
        if (row.status && PENDING_SET.has(row.status)) {
          counts[row.status] = (counts[row.status] || 0) + 1
        }
      })
      return Object.keys(counts).length > 0 ? { item, idx, counts } : null
    })
    .filter(Boolean)

  if (pending.length === 0) return null

  return (
    <div className={`qnav${open ? ' qnav--open' : ''}`}>
      <button
        className="qnav__tab"
        onClick={() => setOpen(o => !o)}
        title={open ? 'Cerrar panel' : 'Ver pendientes'}
      >
        {open ? '›' : '‹'}
        {!open && <span className="qnav__tab-badge">{pending.length}</span>}
      </button>

      <div className="qnav__panel">
        <div className="qnav__head">
          <span className="qnav__head-label">Para completar</span>
          <span className="qnav__head-count">{pending.length}</span>
        </div>
        <div className="qnav__list">
          {pending.map(({ item, idx, counts }) => (
            <button
              key={item.instanceId}
              className="qnav__item"
              onClick={() => scrollToItem(item.instanceId)}
              title={`Ir a: ${item.label || item.name}`}
            >
              <span className="qnav__item-num">{idx + 1}</span>
              <span className="qnav__item-name">{item.label || item.name}</span>
              <span className="qnav__item-dots">
                {PENDING.map(s => counts[s.value] ? (
                  <span
                    key={s.value}
                    className="qnav__dot"
                    style={{ background: s.color, color: s.text }}
                    title={`${s.label}: ${counts[s.value]}`}
                  >
                    {counts[s.value]}
                  </span>
                ) : null)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
