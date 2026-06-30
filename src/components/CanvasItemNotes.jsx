import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import SKUSearchModal from './SKUSearchModal'

// ── PopoverInput ──────────────────────────────────
function PopoverInput({ value, onChange, placeholder, className }) {
  const inputRef  = useRef(null)
  const popRef    = useRef(null)
  const [pos, setPos] = useState(null)

  const open = () => {
    if (!value.trim()) return
    const r = inputRef.current?.getBoundingClientRect()
    if (!r) return
    const popH = 90
    const spaceBelow = window.innerHeight - r.bottom
    const top = spaceBelow < popH + 8 ? r.top - popH - 4 : r.bottom + 4
    setPos({ left: r.left, top, width: Math.max(r.width, 260) })
  }

  useEffect(() => {
    if (!pos) return
    const handle = e => {
      if (!popRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setPos(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [pos])

  return (
    <>
      <input
        ref={inputRef}
        className={className}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onClick={open}
      />
      {pos && createPortal(
        <div ref={popRef} className="cn-input-popover" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          <textarea
            className="cn-input-popover__area"
            value={value}
            onChange={onChange}
            autoFocus
            spellCheck={false}
            rows={3}
          />
        </div>,
        document.body
      )}
    </>
  )
}

// ── SKU image cache ───────────────────────────────
const SKU_IMG_CACHE = new Map()

const PROXY = import.meta.env.DEV
  ? (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
  : (url) => `/api/vtex?url=${encodeURIComponent(url)}`

async function fetchSkuImage(refId) {
  if (SKU_IMG_CACHE.has(refId)) return SKU_IMG_CACHE.get(refId)
  const base = 'https://www.perfumeriasrouge.com'
  const H = { headers: { Accept: 'application/json' } }
  for (const path of [
    `/api/catalog_system/pub/sku/stockkeepingunitbyid/${refId}`,
    `/api/catalog_system/pub/sku/stockkeepingunitbyalternateid/${refId}`,
  ]) {
    try {
      const r = await fetch(PROXY(`${base}${path}`), H)
      if (!r.ok) continue
      const data = await r.json()
      const url = data?.Images?.[0]?.ImageUrl ?? null
      if (url) { SKU_IMG_CACHE.set(refId, url); return url }
    } catch {}
  }
  SKU_IMG_CACHE.set(refId, null)
  return null
}

// ── SkuChip ───────────────────────────────────────
function SkuChip({ refId, canFetch, onRemove }) {
  const chipRef = useRef(null)
  const [imgUrl, setImgUrl] = useState(undefined)
  const [tooltipPos, setTooltipPos] = useState(null)
  const [hovered, setHovered] = useState(false)

  const handleMouseEnter = () => {
    setHovered(true)
    if (chipRef.current) {
      const r = chipRef.current.getBoundingClientRect()
      setTooltipPos({ x: r.left + r.width / 2, y: r.top })
    }
    if (!canFetch || imgUrl !== undefined) return
    fetchSkuImage(refId).then(setImgUrl)
  }

  const handleMouseLeave = () => {
    setHovered(false)
    setTooltipPos(null)
  }

  return (
    <>
      <span
        ref={chipRef}
        className={`sku-chip${hovered ? ' sku-chip--hovered' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="sku-chip__label">{refId}</span>
        <button
          className="sku-chip__remove"
          onClick={e => { e.stopPropagation(); onRemove() }}
          type="button"
          tabIndex={-1}
          title="Quitar SKU"
        >✕</button>
      </span>
      {tooltipPos && imgUrl && createPortal(
        <div className="sku-chip__tooltip" style={{ left: tooltipPos.x, top: tooltipPos.y - 8 }}>
          <img src={imgUrl} alt={refId} />
          <span className="sku-chip__tooltip-id">{refId}</span>
        </div>,
        document.body
      )}
    </>
  )
}

// ── SKU manual modal ──────────────────────────────
function SkuManualModal({ existing, onSave, onClose }) {
  const [inputs, setInputs] = useState(
    existing.length > 0 ? existing : ['']
  )

  const update = (i, val) => setInputs(prev => prev.map((v, j) => j === i ? val : v))
  const add    = () => setInputs(prev => [...prev, ''])
  const remove = (i) => setInputs(prev => prev.length === 1 ? [''] : prev.filter((_, j) => j !== i))

  const handleSave = () => {
    onSave(inputs.map(s => s.trim()).filter(Boolean))
    onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); add() }
  }

  return createPortal(
    <div className="sku-picker-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sku-manual">
        <p className="sku-picker__title">Ingresar SKUs manualmente</p>
        <div className="sku-manual__list">
          {inputs.map((val, i) => (
            <div key={i} className="sku-manual__row">
              <input
                className="sku-manual__input"
                value={val}
                onChange={e => update(i, e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`SKU ${i + 1}`}
                autoFocus={i === inputs.length - 1}
                spellCheck={false}
              />
              <button
                className="sku-manual__del"
                onClick={() => remove(i)}
                type="button"
                tabIndex={-1}
              >✕</button>
            </div>
          ))}
        </div>
        <button className="sku-manual__add-row" onClick={add} type="button">
          + Agregar otro SKU
        </button>
        <div className="sku-manual__footer">
          <button className="btn-ghost" onClick={onClose} type="button">Cancelar</button>
          <button className="btn-primary" onClick={handleSave} type="button">Guardar</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── SKU picker modal ──────────────────────────────
function SkuPickerModal({ onManual, onSearch, onClose }) {
  return createPortal(
    <div className="sku-picker-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sku-picker">
        <p className="sku-picker__title">¿Cómo querés agregar SKUs?</p>
        <div className="sku-picker__opts">
          <button className="sku-picker__opt" onClick={onManual}>
            <span className="sku-picker__opt-icon">✎</span>
            <span className="sku-picker__opt-label">Manual</span>
            <span className="sku-picker__opt-desc">Escribí los códigos uno por uno</span>
          </button>
          {onSearch && (
            <button className="sku-picker__opt" onClick={onSearch}>
              <span className="sku-picker__opt-icon">⌕</span>
              <span className="sku-picker__opt-label">Buscar en tienda</span>
              <span className="sku-picker__opt-desc">Buscá por marca en Rouge</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Image preview modal ───────────────────────────
function ImgPreviewModal({ url, onClear, onClose }) {
  return createPortal(
    <div className="img-preview-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="img-preview-modal">
        <img src={url} className="img-preview-img" alt="Preview" />
        <div className="img-preview-actions">
          <a
            className="btn-primary img-preview-download"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            ↓ Abrir para descargar
          </a>
          <button
            className="img-preview-delete"
            type="button"
            onClick={() => { if (window.confirm('¿Eliminar esta imagen?')) { onClear(); onClose() } }}
          >
            Eliminar
          </button>
        </div>
        <button className="img-preview-close" type="button" onClick={onClose}>✕</button>
      </div>
    </div>,
    document.body
  )
}

// ── Image cell ────────────────────────────────────

function ImgCell({ url, uploading, onUpload, onClear }) {
  const [dragOver, setDragOver] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const handleDragOver = (e) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false)
  }
  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) onUpload(file)
  }

  const dragProps = { onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop }

  if (uploading) {
    return <div className="cn-img-cell"><span className="cn-img-spin" /></div>
  }
  if (url) {
    return (
      <>
        <div
          className={`cn-img-cell cn-img-cell--has${dragOver ? ' cn-img-cell--dragover' : ''}`}
          {...dragProps}
          onClick={() => setPreviewing(true)}
          title="Ver imagen"
        >
          <img src={url} className="cn-img-thumb" alt="" />
          <span className="cn-img-hint">🔍</span>
        </div>
        {previewing && (
          <ImgPreviewModal
            url={url}
            onClear={onClear}
            onClose={() => setPreviewing(false)}
          />
        )}
      </>
    )
  }
  return (
    <div className={`cn-img-cell${dragOver ? ' cn-img-cell--dragover' : ''}`} {...dragProps}>
      <label className="cn-img-add" title="Arrastrá una imagen o hacé click">
        +
        <input
          type="file"
          accept="image/*"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }}
        />
      </label>
    </div>
  )
}

// ── Status config ─────────────────────────────────
const STATUSES = [
  { value: '',               label: '—',                   bg: 'transparent', color: '#9ca3af', rowBg: 'transparent' },
  { value: 'por-hacer',      label: 'POR HACER',           bg: '#facc15',     color: '#713f12', rowBg: 'rgba(250,204,21,0.22)' },
  { value: 'falta-completar',label: 'FALTA · DUDAS',       bg: '#a855f7',     color: '#ffffff', rowBg: 'rgba(168,85,247,0.18)' },
  { value: 'listo-no-subido',label: 'LISTO · NO SUBIDO',   bg: '#f97316',     color: '#ffffff', rowBg: 'rgba(249,115,22,0.18)' },
  { value: 'terminado',      label: 'TERMINADO Y CARGADO', bg: '#22c55e',     color: '#ffffff', rowBg: 'rgba(34,197,94,0.18)' },
  { value: 'eliminar',       label: 'ELIMINAR',            bg: '#ef4444',     color: '#ffffff', rowBg: 'rgba(239,68,68,0.18)' },
]
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]))

const EMPTY_ITEM = () => ({
  id: crypto.randomUUID(),
  status: '', titulo: '', urlImagen: '', idProductos: '', idProductosMobile: '', skus: '',
  imageDesktop: null, imageMobile: null,
})

export function normalizeNotes(notes) {
  if (Array.isArray(notes) && notes.length > 0) return notes
  return [EMPTY_ITEM()]
}

// ── Main component ────────────────────────────────
export default function CanvasItemNotes({ instanceId, notes, onUpdate, storeId }) {
  const rows = normalizeNotes(notes)
  const [searchRowId, setSearchRowId] = useState(null)
  const [pickerRowId, setPickerRowId] = useState(null)
  const [manualRowId, setManualRowId] = useState(null)
  const [uploadingMap, setUploadingMap] = useState({})

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

  const openSkuEntry = (rowId) => {
    if (storeId === 'rouge') {
      setPickerRowId(rowId)
    } else {
      setManualRowId(rowId)
    }
  }

  const handleUploadImg = async (rowId, type, file) => {
    const key = `${rowId}_${type}`
    setUploadingMap(prev => ({ ...prev, [key]: true }))
    try {
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
      const { getApp } = await import('firebase/app')
      const ext = file.name.split('.').pop().toLowerCase() || 'jpg'
      const storageRef = ref(getStorage(getApp()), `canvas-images/${instanceId}/${rowId}/${type}.${ext}`)
      await uploadBytes(storageRef, file, { contentType: file.type || `image/${ext}` })
      const url = await getDownloadURL(storageRef)
      updateItem(rowId, type === 'desktop' ? 'imageDesktop' : 'imageMobile', url)
    } catch (err) {
      if (err?.message?.includes('not been set up')) {
        alert('Firebase Storage no está activado. Entrá a la consola de Firebase → Storage → Get Started.')
      } else {
        alert('No se pudo subir la imagen.')
      }
    } finally {
      setUploadingMap(prev => ({ ...prev, [key]: false }))
    }
  }

  return (
    <div className="canvas-notes">
      {searchRowId && (
        <SKUSearchModal
          onClose={() => setSearchRowId(null)}
          onAdd={(ids) => handleAddSkus(searchRowId, ids)}
        />
      )}
      {pickerRowId && (
        <SkuPickerModal
          onClose={() => setPickerRowId(null)}
          onManual={() => { const id = pickerRowId; setPickerRowId(null); setManualRowId(id) }}
          onSearch={storeId === 'rouge' ? () => { const id = pickerRowId; setPickerRowId(null); setSearchRowId(id) } : null}
        />
      )}
      {manualRowId && (() => {
        const row = rows.find(r => r.id === manualRowId)
        const existing = row?.skus.trim() ? row.skus.split('///').map(s => s.trim()).filter(Boolean) : []
        return (
          <SkuManualModal
            existing={existing}
            onSave={(skus) => updateItem(manualRowId, 'skus', skus.join(' /// '))}
            onClose={() => setManualRowId(null)}
          />
        )
      })()}
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
              <th className="canvas-notes__th cn-img-col">Img DK</th>
              <th className="canvas-notes__th cn-img-col">Img MB</th>
              <th className="canvas-notes__th cn-del-col"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const st = STATUS_MAP[row.status || ''] || STATUS_MAP['']
              const skuTokens = row.skus.trim() ? row.skus.split('///').map(s => s.trim()).filter(Boolean) : []

              return (
                <tr key={row.id} className="canvas-notes__row" style={{ '--row-bg': st.rowBg }}>
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
                    <PopoverInput className="canvas-notes__input" value={row.titulo}
                      onChange={e => updateItem(row.id, 'titulo', e.target.value)} placeholder="—" />
                  </td>
                  <td className="canvas-notes__td">
                    <PopoverInput className="canvas-notes__input" value={row.urlImagen}
                      onChange={e => updateItem(row.id, 'urlImagen', e.target.value)} placeholder="—" />
                  </td>
                  <td className="canvas-notes__td">
                    <PopoverInput className="canvas-notes__input" value={row.idProductos}
                      onChange={e => updateItem(row.id, 'idProductos', e.target.value)} placeholder="—" />
                  </td>
                  <td className="canvas-notes__td">
                    <PopoverInput className="canvas-notes__input" value={row.idProductosMobile}
                      onChange={e => updateItem(row.id, 'idProductosMobile', e.target.value)} placeholder="—" />
                  </td>
                  <td className="canvas-notes__td">
                    <div className="cn-skus-cell">
                      <div className="cn-skus-chips">
                        {skuTokens.map((refId, i) => (
                          <SkuChip
                            key={i}
                            refId={refId}
                            canFetch={storeId === 'rouge'}
                            onRemove={() => {
                              const next = skuTokens.filter((_, j) => j !== i)
                              updateItem(row.id, 'skus', next.join(' /// '))
                            }}
                          />
                        ))}
                        <button
                          className="cn-skus-add-btn"
                          onClick={() => openSkuEntry(row.id)}
                          type="button"
                          title="Agregar SKUs"
                        >+</button>
                      </div>
                    </div>
                  </td>
                  <td className="canvas-notes__td cn-img-col">
                    <ImgCell
                      url={row.imageDesktop ?? null}
                      uploading={!!uploadingMap[`${row.id}_desktop`]}
                      onUpload={file => handleUploadImg(row.id, 'desktop', file)}
                      onClear={() => updateItem(row.id, 'imageDesktop', null)}
                    />
                  </td>
                  <td className="canvas-notes__td cn-img-col">
                    <ImgCell
                      url={row.imageMobile ?? null}
                      uploading={!!uploadingMap[`${row.id}_mobile`]}
                      onUpload={file => handleUploadImg(row.id, 'mobile', file)}
                      onClear={() => updateItem(row.id, 'imageMobile', null)}
                    />
                  </td>
                  <td className="canvas-notes__td cn-del-col">
                    <button
                      className="cn-skus-icon-btn cn-skus-icon-btn--remove"
                      onClick={() => removeItem(row.id)}
                      disabled={rows.length <= 1}
                      type="button"
                      title="Eliminar fila"
                    >✕</button>
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
