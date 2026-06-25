import { useState } from 'react'
import PlaceholderBlock from './PlaceholderBlock'

function autoBarText(item) {
  const parts = [item.label || item.name]
  if (item.variantName !== 'Completo') parts.push(`— ${item.variantName}`)
  parts.push(`/// ${item.width}x${item.height}`)
  if (item.layout === 'carousel' && item.cardWidth) parts.push(`+ ${item.cardWidth}x${item.cardHeight} ×${item.cols}`)
  if (item.widthMb) parts.push(`- ${item.widthMb}x${item.heightMb}mb`)
  return parts.join(' ')
}

export default function Canvas({ items, fullscreen, onRemove, onDuplicate, onMove, onUpdateLabel, onUpdateBarText, onUpdateDims }) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [barEditingId, setBarEditingId] = useState(null)
  const [barEditValue, setBarEditValue] = useState('')

  const startEdit = (item) => {
    setEditingId(item.instanceId)
    setEditValue(item.label || item.name)
  }

  const commitEdit = (instanceId) => {
    const item = items.find(i => i.instanceId === instanceId)
    const trimmed = editValue.trim()
    onUpdateLabel(instanceId, trimmed || item?.name || '')
    setEditingId(null)
  }

  const handleKeyDown = (e, instanceId) => {
    if (e.key === 'Enter') commitEdit(instanceId)
    if (e.key === 'Escape') setEditingId(null)
  }

  const startBarEdit = (item) => {
    setBarEditingId(item.instanceId)
    setBarEditValue(item.customBarText ?? autoBarText(item))
  }

  const commitBarEdit = (instanceId) => {
    const item = items.find(i => i.instanceId === instanceId)
    const trimmed = barEditValue.trim()
    onUpdateBarText(instanceId, trimmed || autoBarText(item))
    setBarEditingId(null)
  }

  const handleBarKeyDown = (e, instanceId) => {
    if (e.key === 'Enter') commitBarEdit(instanceId)
    if (e.key === 'Escape') setBarEditingId(null)
  }

  if (items.length === 0) {
    return (
      <div className="canvas-empty">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="32" height="32" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
          <path d="M20 14v12M14 20h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p>Agregá componentes desde el panel izquierdo</p>
      </div>
    )
  }

  return (
    <div className={`canvas-scroll${fullscreen ? ' canvas-scroll--fullscreen' : ''}`}>
      <div className={`canvas-page${fullscreen ? ' canvas-page--fullscreen' : ''}`}>
        {items.map((item, index) => (
          <div key={item.instanceId} className="canvas-item">
            {!fullscreen && (
              <div className="canvas-item__bar">
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
                  <button className="canvas-item__btn" onClick={() => onMove(index, -1)} disabled={index === 0} title="Subir">↑</button>
                  <button className="canvas-item__btn" onClick={() => onMove(index, 1)} disabled={index === items.length - 1} title="Bajar">↓</button>
                  <button className="canvas-item__btn" onClick={() => onDuplicate(item.instanceId)} title="Duplicar">⎘</button>
                  <button className="canvas-item__btn canvas-item__btn--danger" onClick={() => onRemove(item.instanceId)} title="Eliminar">×</button>
                </div>
              </div>
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
          </div>
        ))}
      </div>
    </div>
  )
}
