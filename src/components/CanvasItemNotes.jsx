import { useState } from 'react'
import SKUSearchModal from './SKUSearchModal'

const STATUSES = [
  { value: '',               label: '—',                      bg: 'transparent',  color: '#9ca3af', rowBg: 'transparent' },
  { value: 'por-hacer',      label: 'POR HACER',              bg: '#facc15',      color: '#713f12', rowBg: 'rgba(250,204,21,0.22)' },
  { value: 'falta-completar',label: 'FALTA · DUDAS',          bg: '#a855f7',      color: '#ffffff', rowBg: 'rgba(168,85,247,0.18)' },
  { value: 'listo-no-subido',label: 'LISTO · NO SUBIDO',      bg: '#f97316',      color: '#ffffff', rowBg: 'rgba(249,115,22,0.18)' },
  { value: 'terminado',      label: 'TERMINADO Y CARGADO',    bg: '#22c55e',      color: '#ffffff', rowBg: 'rgba(34,197,94,0.18)' },
  { value: 'eliminar',       label: 'ELIMINAR',               bg: '#ef4444',      color: '#ffffff', rowBg: 'rgba(239,68,68,0.18)' },
]

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]))

const EMPTY_ITEM = () => ({
  id: crypto.randomUUID(),
  status: '',
  titulo: '',
  urlImagen: '',
  idProductos: '',
  idProductosMobile: '',
  skus: '',
})

export function normalizeNotes(notes) {
  if (Array.isArray(notes) && notes.length > 0) return notes
  return [EMPTY_ITEM()]
}

export default function CanvasItemNotes({ notes, onUpdate, storeId }) {
  const rows = normalizeNotes(notes)
  const [searchRowId, setSearchRowId] = useState(null)

  const updateItem = (id, field, value) =>
    onUpdate(rows.map(r => r.id === id ? { ...r, [field]: value } : r))

  const addItem = () => onUpdate([...rows, EMPTY_ITEM()])

  const removeItem = (id) => {
    if (rows.length <= 1) return
    if (!window.confirm('¿Eliminar esta fila?')) return
    onUpdate(rows.filter(r => r.id !== id))
  }

  const handleAddSkus = (rowId, itemIds) => {
    const row = rows.find(r => r.id === rowId)
    if (!row) return
    const existing = row.skus.trim()
    const appended = itemIds.join(' /// ')
    updateItem(rowId, 'skus', existing ? `${existing} /// ${appended}` : appended)
  }

  return (
    <div className="canvas-notes">
      {searchRowId && (
        <SKUSearchModal
          onClose={() => setSearchRowId(null)}
          onAdd={(ids) => handleAddSkus(searchRowId, ids)}
        />
      )}
      <div className="canvas-notes__table-wrap">
        <table className="canvas-notes__table">
          <thead>
            <tr>
              <th className="canvas-notes__th cn-num">#</th>
              <th className="canvas-notes__th cn-status">Estado</th>
              <th className="canvas-notes__th cn-titulo">Título</th>
              <th className="canvas-notes__th cn-url">URL imagen</th>
              <th className="canvas-notes__th cn-ids">IDs desktop</th>
              <th className="canvas-notes__th cn-ids">IDs mobile</th>
              <th className="canvas-notes__th cn-skus">SKUs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const st = STATUS_MAP[row.status || ''] || STATUS_MAP['']
              return (
                <tr
                  key={row.id}
                  className="canvas-notes__row"
                  style={{ '--row-bg': st.rowBg }}
                >
                  <td className="canvas-notes__td cn-num">{idx + 1}</td>
                  <td className="canvas-notes__td cn-status">
                    <select
                      className="canvas-notes__status"
                      value={row.status || ''}
                      onChange={e => updateItem(row.id, 'status', e.target.value)}
                      style={{ background: st.bg, color: st.color, borderColor: st.bg === 'transparent' ? '#e5e7eb' : st.bg }}
                    >
                      {STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="canvas-notes__td">
                    <input className="canvas-notes__input" value={row.titulo}
                      onChange={e => updateItem(row.id, 'titulo', e.target.value)} placeholder="—" />
                  </td>
                  <td className="canvas-notes__td">
                    <input className="canvas-notes__input" value={row.urlImagen}
                      onChange={e => updateItem(row.id, 'urlImagen', e.target.value)} placeholder="—" />
                  </td>
                  <td className="canvas-notes__td">
                    <input className="canvas-notes__input" value={row.idProductos}
                      onChange={e => updateItem(row.id, 'idProductos', e.target.value)} placeholder="—" />
                  </td>
                  <td className="canvas-notes__td">
                    <input className="canvas-notes__input" value={row.idProductosMobile}
                      onChange={e => updateItem(row.id, 'idProductosMobile', e.target.value)} placeholder="—" />
                  </td>
                  <td className="canvas-notes__td">
                    <div className="cn-skus-cell">
                      <textarea
                        className="canvas-notes__input canvas-notes__input--skus"
                        value={row.skus}
                        onChange={e => updateItem(row.id, 'skus', e.target.value)}
                        placeholder="—"
                        rows={1}
                      />
                      <div className="cn-skus-actions">
                        {storeId === 'rouge' && (
                          <button
                            className="cn-skus-icon-btn cn-skus-icon-btn--search"
                            onClick={() => setSearchRowId(row.id)}
                            type="button"
                            title="Buscar SKUs en Rouge"
                          >
                            ⌕
                          </button>
                        )}
                        <button
                          className="cn-skus-icon-btn cn-skus-icon-btn--remove"
                          onClick={() => removeItem(row.id)}
                          disabled={rows.length <= 1}
                          type="button"
                          title="Eliminar fila"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button className="canvas-notes__add" onClick={addItem}>+ Agregar item</button>
    </div>
  )
}
