import { useState, useRef } from 'react'
import PlaceholderBlock from './PlaceholderBlock'
import CanvasItemNotes from './CanvasItemNotes'

function autoBarText(item) {
  const parts = [item.label || item.name]
  if (item.variantName !== 'Completo') parts.push(`— ${item.variantName}`)
  parts.push(`/// ${item.width}x${item.height}`)
  if (item.layout === 'carousel' && item.cardWidth) parts.push(`+ ${item.cardWidth}x${item.cardHeight} ×${item.cols}`)
  if (item.widthMb) parts.push(`- ${item.widthMb}x${item.heightMb}mb`)
  return parts.join(' ')
}

function compressImage(file, maxWidth = 1400, quality = 0.78) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function RefImgModal({ item, onClose, onSave, onRemove }) {
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState(item.referenceImg || null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setLoading(true)
    const compressed = await compressImage(file)
    setPreview(compressed)
    setLoading(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  const handleSave = () => {
    onSave(preview)
    onClose()
  }

  const handleRemove = () => {
    onRemove()
    onClose()
  }

  return (
    <div className="refimg-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="refimg-modal">
        <div className="refimg-modal__head">
          <span className="refimg-modal__title">Imagen de referencia</span>
          <span className="refimg-modal__sub">{item.label || item.name}</span>
          <button className="refimg-modal__close" onClick={onClose}>✕</button>
        </div>

        <div
          className={`refimg-modal__body${preview ? ' refimg-modal__body--has-img' : ''}`}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
          onDrop={handleDrop}
          onClick={() => !preview && fileInputRef.current?.click()}
        >
          {loading ? (
            <span className="refimg-modal__hint">Procesando...</span>
          ) : preview ? (
            <img className="refimg-modal__img" src={preview} alt="Referencia" />
          ) : (
            <div className="refimg-modal__empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 2"/>
                <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
              </svg>
              <span>Arrastrá una imagen o hacé clic para seleccionar</span>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />

        <div className="refimg-modal__actions">
          {preview && (
            <button className="btn-ghost" onClick={() => fileInputRef.current?.click()}>
              Cambiar imagen
            </button>
          )}
          {item.referenceImg && (
            <button className="btn-ghost refimg-modal__btn-remove" onClick={handleRemove}>
              Quitar
            </button>
          )}
          <button className="btn-primary" onClick={handleSave} disabled={!preview || preview === item.referenceImg}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Canvas({ items, fullscreen, storeId, onRemove, onDuplicate, onMove, onReorder, onUpdateLabel, onUpdateBarText, onUpdateDims, onUpdateNotes, onDropAdd }) {
  const [editingId, setEditingId]       = useState(null)
  const [editValue, setEditValue]       = useState('')
  const [barEditingId, setBarEditingId] = useState(null)
  const [barEditValue, setBarEditValue] = useState('')
  const [refImgItem, setRefImgItem]     = useState(null)
  const [previewOpenId, setPreviewOpenId] = useState(null)

  // palette drop
  const [paletteDragOver, setPaletteDragOver] = useState(false)

  // canvas reorder
  const [reorderFrom, setReorderFrom] = useState(null)
  const [reorderOver, setReorderOver] = useState(null)

  // ── edit handlers ─────────────────────────────────
  const startEdit = (item) => { setEditingId(item.instanceId); setEditValue(item.label || item.name) }
  const commitEdit = (instanceId) => {
    const item = items.find(i => i.instanceId === instanceId)
    onUpdateLabel(instanceId, editValue.trim() || item?.name || '')
    setEditingId(null)
  }
  const handleKeyDown = (e, instanceId) => {
    if (e.key === 'Enter') commitEdit(instanceId)
    if (e.key === 'Escape') setEditingId(null)
  }
  const startBarEdit = (item) => { setBarEditingId(item.instanceId); setBarEditValue(item.customBarText ?? autoBarText(item)) }
  const commitBarEdit = (instanceId) => {
    const item = items.find(i => i.instanceId === instanceId)
    onUpdateBarText(instanceId, barEditValue.trim() || autoBarText(item))
    setBarEditingId(null)
  }
  const handleBarKeyDown = (e, instanceId) => {
    if (e.key === 'Enter') commitBarEdit(instanceId)
    if (e.key === 'Escape') setBarEditingId(null)
  }

  // ── palette drop handlers ─────────────────────────
  const handlePaletteDragOver = (e) => {
    if (!e.dataTransfer.types.includes('application/landing-creator')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setPaletteDragOver(true)
  }
  const handlePaletteDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setPaletteDragOver(false)
  }
  const handlePaletteDrop = (e) => {
    e.preventDefault()
    setPaletteDragOver(false)
    try {
      const { category, variant } = JSON.parse(e.dataTransfer.getData('application/landing-creator'))
      onDropAdd(category, variant)
    } catch {}
  }

  // ── canvas reorder handlers ───────────────────────
  const handleItemDragStart = (e, index) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/canvas-reorder', String(index))
    setReorderFrom(index)
  }
  const handleItemDragOver = (e, index) => {
    if (!e.dataTransfer.types.includes('application/canvas-reorder')) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setReorderOver(index)
    setPaletteDragOver(false)
  }
  const handleItemDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setReorderOver(null)
  }
  const handleItemDrop = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    const from = Number(e.dataTransfer.getData('application/canvas-reorder'))
    if (!isNaN(from) && from !== index) onReorder(from, index)
    setReorderFrom(null)
    setReorderOver(null)
  }
  const handleItemDragEnd = () => { setReorderFrom(null); setReorderOver(null) }

  // ── empty state ───────────────────────────────────
  if (items.length === 0) {
    return (
      <div
        className={`canvas-empty${paletteDragOver ? ' canvas-empty--dragover' : ''}`}
        onDragOver={handlePaletteDragOver}
        onDragLeave={handlePaletteDragLeave}
        onDrop={handlePaletteDrop}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="32" height="32" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
          <path d="M20 14v12M14 20h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p>Agregá componentes desde el panel izquierdo</p>
      </div>
    )
  }

  return (
    <>
      <div
        className={`canvas-scroll${fullscreen ? ' canvas-scroll--fullscreen' : ''}${paletteDragOver ? ' canvas-scroll--dragover' : ''}`}
        onDragOver={handlePaletteDragOver}
        onDragLeave={handlePaletteDragLeave}
        onDrop={handlePaletteDrop}
      >
        <div className={`canvas-page${fullscreen ? ' canvas-page--fullscreen' : ''}`}>
          {items.map((item, index) => (
            <div
              key={item.instanceId}
              id={`ci-${item.instanceId}`}
              className={`canvas-item${reorderOver === index ? ' canvas-item--drop-target' : ''}${reorderFrom === index ? ' canvas-item--dragging' : ''}`}
              draggable={!fullscreen}
              onDragStart={!fullscreen ? (e) => handleItemDragStart(e, index) : undefined}
              onDragOver={!fullscreen ? (e) => handleItemDragOver(e, index) : undefined}
              onDragLeave={!fullscreen ? handleItemDragLeave : undefined}
              onDrop={!fullscreen ? (e) => handleItemDrop(e, index) : undefined}
              onDragEnd={!fullscreen ? handleItemDragEnd : undefined}
            >
              {!fullscreen && (
                <div className="canvas-item__bar">
                  <span className="canvas-item__drag-handle" title="Arrastrar para reordenar">⠿</span>
                  {barEditingId === item.instanceId ? (
                    <input
                      className="canvas-item__label-input"
                      value={barEditValue}
                      onChange={e => setBarEditValue(e.target.value)}
                      onBlur={() => commitBarEdit(item.instanceId)}
                      onKeyDown={e => handleBarKeyDown(e, item.instanceId)}
                      autoFocus
                    />
                  ) : (
                    <span className="canvas-item__name" onClick={() => startBarEdit(item)}>
                      {item.customBarText ?? autoBarText(item)}
                    </span>
                  )}
                  <div className="canvas-item__actions">
                    <button
                      className={`canvas-item__btn canvas-item__btn--preview${item.referenceImg ? ' canvas-item__btn--preview-set' : ''}`}
                      onClick={() => setRefImgItem(item)}
                      onMouseEnter={() => item.referenceImg && setPreviewOpenId(item.instanceId)}
                      onMouseLeave={() => setPreviewOpenId(null)}
                      title={item.referenceImg ? 'Ver / cambiar imagen de referencia' : 'Cargar imagen de referencia'}
                    >
                      {item.referenceImg ? '● Preview' : 'Preview'}
                    </button>
                    <button className="canvas-item__btn" onClick={() => onMove(index, -1)} disabled={index === 0} title="Subir">↑</button>
                    <button className="canvas-item__btn" onClick={() => onMove(index, 1)} disabled={index === items.length - 1} title="Bajar">↓</button>
                    <button className="canvas-item__btn" onClick={() => onDuplicate(item.instanceId)} title="Duplicar">⎘</button>
                    <button className="canvas-item__btn canvas-item__btn--danger" onClick={() => { if (window.confirm('¿Eliminar este componente del canvas?')) onRemove(item.instanceId) }} title="Eliminar">×</button>
                  </div>
                </div>
              )}

              {!fullscreen && previewOpenId === item.instanceId && item.referenceImg && (
                <div
                  className="canvas-item__preview-panel"
                  onMouseEnter={() => setPreviewOpenId(item.instanceId)}
                  onMouseLeave={() => setPreviewOpenId(null)}
                >
                  <img src={item.referenceImg} alt="Referencia" />
                </div>
              )}

              {!fullscreen && (
                <textarea
                  className={`canvas-item__comment${item.comment ? ' canvas-item__comment--filled' : ''}`}
                  value={item.comment || ''}
                  onChange={e => onUpdateDims(item.instanceId, { comment: e.target.value })}
                  placeholder="Agregar comentario..."
                  rows={1}
                />
              )}
              <PlaceholderBlock
                name={item.name}
                label={item.label}
                layout={item.layout}
                cols={item.cols}
                width={item.width}
                height={item.height}
                widthMb={item.widthMb}
                heightMb={item.heightMb}
                cardWidth={item.cardWidth}
                cardHeight={item.cardHeight}
                bannerSide={item.bannerSide}
                color={item.color}
                textVariant={item.textVariant}
                isEditing={!fullscreen && editingId === item.instanceId}
                editValue={editValue}
                onEditChange={setEditValue}
                onEditCommit={() => commitEdit(item.instanceId)}
                onEditCancel={() => setEditingId(null)}
                onEdit={!fullscreen ? () => startEdit(item) : undefined}
                onKeyDown={(e) => handleKeyDown(e, item.instanceId)}
                onDimsCommit={!fullscreen ? (updates) => onUpdateDims(item.instanceId, updates) : undefined}
                onCardDimsCommit={!fullscreen && item.cardWidth ? (updates) => onUpdateDims(item.instanceId, updates) : undefined}
              />
              {!fullscreen && (
                <CanvasItemNotes
                  instanceId={item.instanceId}
                  notes={item.notes}
                  storeId={storeId}
                  onUpdate={notes => onUpdateNotes(item.instanceId, notes)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {refImgItem && (
        <RefImgModal
          item={refImgItem}
          onClose={() => setRefImgItem(null)}
          onSave={(img) => onUpdateDims(refImgItem.instanceId, { referenceImg: img })}
          onRemove={() => onUpdateDims(refImgItem.instanceId, { referenceImg: null })}
        />
      )}
    </>
  )
}
