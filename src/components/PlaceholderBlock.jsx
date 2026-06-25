import { useState } from 'react'

function DiagLines({ className = 'ph__lines' }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <line x1="0" y1="0" x2="100" y2="100" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      <line x1="100" y1="0" x2="0" y2="100" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function LabelArea({
  isEditing, editValue, onEditChange, onEditCommit, onEdit, onKeyDown, displayLabel, dims,
  dimsEditing, dimsEditValue, onDimsChange, onDimsCommit, onDimsKeyDown, onStartDimsEdit,
}) {
  if (isEditing) {
    return (
      <div className="ph__label">
        <input
          className="ph__label-input"
          value={editValue}
          onChange={e => onEditChange(e.target.value)}
          onBlur={onEditCommit}
          onKeyDown={onKeyDown}
          autoFocus
        />
        <span className="ph__dims">Medidas: {dims}</span>
      </div>
    )
  }

  return (
    <div className="ph__label">
      <span
        className="ph__name"
        onClick={onEdit}
        style={onEdit ? { pointerEvents: 'auto', cursor: 'text' } : undefined}
      >
        {displayLabel}///
      </span>
      {dimsEditing ? (
        <input
          className="ph__dims-input"
          value={dimsEditValue}
          onChange={e => onDimsChange(e.target.value)}
          onBlur={onDimsCommit}
          onKeyDown={onDimsKeyDown}
          onClick={e => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span
          className={`ph__dims${onStartDimsEdit ? ' ph__dims--editable' : ''}`}
          onClick={onStartDimsEdit ? e => { e.stopPropagation(); onStartDimsEdit() } : undefined}
        >
          {dims}
        </span>
      )}
    </div>
  )
}

export default function PlaceholderBlock({
  name, label, layout = 'full', cols = 1, width, height, widthMb, heightMb,
  cardWidth, cardHeight, bannerSide = 'left', color = '#1a1a1a', textVariant = 'h1',
  isEditing, editValue, onEditChange, onEditCommit, onEditCancel, onEdit, onKeyDown,
  onDimsCommit, onCardDimsCommit,
}) {
  const displayLabel = label || name
  const mbLabel = widthMb ? ` - ${widthMb}x${heightMb}mb` : ''

  const [dimsEditing, setDimsEditing] = useState(false)
  const [dimsEditValue, setDimsEditValue] = useState('')
  const [cardDimsEditing, setCardDimsEditing] = useState(false)
  const [cardDimsEditValue, setCardDimsEditValue] = useState('')

  const startDimsEdit = () => {
    if (!onDimsCommit) return
    let str = `${width}x${height}`
    if (widthMb) str += ` - ${widthMb}x${heightMb}mb`
    else if (cardWidth) str += ` - ${cardWidth}x${cardHeight}`
    setDimsEditValue(str)
    setDimsEditing(true)
  }

  const commitDimsEdit = () => {
    const pairs = [...dimsEditValue.matchAll(/(\d+)\s*[xX]\s*(\d+)/g)].map(m => [+m[1], +m[2]])
    if (pairs.length && onDimsCommit) {
      const updates = { width: pairs[0][0], height: pairs[0][1] }
      if (pairs[1]) {
        const afterDash = dimsEditValue.split(/\s*[-–]\s*/)[1] || ''
        const isMb = /mb/i.test(afterDash) || (widthMb != null && cardWidth == null)
        if (isMb) { updates.widthMb = pairs[1][0]; updates.heightMb = pairs[1][1] }
        else { updates.cardWidth = pairs[1][0]; updates.cardHeight = pairs[1][1] }
      }
      onDimsCommit(updates)
    }
    setDimsEditing(false)
  }

  const handleDimsKeyDown = (e) => {
    if (e.key === 'Enter') commitDimsEdit()
    if (e.key === 'Escape') setDimsEditing(false)
  }

  const startCardDimsEdit = () => {
    if (!onCardDimsCommit) return
    setCardDimsEditValue(`${cardWidth || 380}x${cardHeight || 500}`)
    setCardDimsEditing(true)
  }

  const commitCardDimsEdit = () => {
    const m = cardDimsEditValue.match(/(\d+)\s*[xX]\s*(\d+)/)
    if (m && onCardDimsCommit) onCardDimsCommit({ cardWidth: +m[1], cardHeight: +m[2] })
    setCardDimsEditing(false)
  }

  const handleCardDimsKeyDown = (e) => {
    if (e.key === 'Enter') commitCardDimsEdit()
    if (e.key === 'Escape') setCardDimsEditing(false)
  }

  const labelAreaProps = {
    isEditing, editValue, onEditChange, onEditCommit, onEdit, onKeyDown, displayLabel,
    dimsEditing, dimsEditValue,
    onDimsChange: setDimsEditValue,
    onDimsCommit: commitDimsEdit,
    onDimsKeyDown: handleDimsKeyDown,
    onStartDimsEdit: onDimsCommit ? startDimsEdit : undefined,
  }

  if (layout === 'text') {
    return (
      <div className={`ph-text ph-text--${textVariant}`} style={{ backgroundColor: color }}>
        {isEditing ? (
          <input
            className="ph-text__input"
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onEditCommit}
            onKeyDown={onKeyDown}
            autoFocus
          />
        ) : (
          <p
            className="ph-text__content"
            onClick={onEdit}
            style={onEdit ? { cursor: 'text' } : undefined}
          >
            {displayLabel}
          </p>
        )}
      </div>
    )
  }

  if (layout === 'carousel') {
    const cw = cardWidth || 380
    const ch = cardHeight || 500

    const bannerEl = (
      <div
        key="banner"
        className="ph-carousel__banner"
        style={{ aspectRatio: `${width} / ${height}`, backgroundColor: color, flex: width }}
      >
        <DiagLines />
        <LabelArea
          {...labelAreaProps}
          dims={widthMb ? `${width}x${height}px - ${widthMb}x${heightMb}mb` : `${width}x${height}px`}
        />
      </div>
    )

    const cardsEl = Array.from({ length: cols }, (_, i) => (
      <div key={i} className="ph-carousel__card" style={{ backgroundColor: color, flex: cw }}>
        <DiagLines />
        {i === 0 && (
          <div className="ph__label">
            {cardDimsEditing ? (
              <input
                className="ph__dims-input"
                value={cardDimsEditValue}
                onChange={e => setCardDimsEditValue(e.target.value)}
                onBlur={commitCardDimsEdit}
                onKeyDown={handleCardDimsKeyDown}
                autoFocus
              />
            ) : (
              <span
                className={`ph__dims${onCardDimsCommit ? ' ph__dims--editable' : ''}`}
                onClick={onCardDimsCommit ? startCardDimsEdit : undefined}
              >
                {cw}x{ch}px
              </span>
            )}
          </div>
        )}
      </div>
    ))

    return (
      <div className="ph-carousel">
        {bannerSide === 'right' ? [...cardsEl, bannerEl] : [bannerEl, ...cardsEl]}
      </div>
    )
  }

  if (layout === 'shop') {
    const cw = cardWidth || 600
    const ch = cardHeight || 250

    const sideCards = Array.from({ length: cols }, (_, i) => (
      <div key={i} className="ph-shop__card" style={{ aspectRatio: `${cw} / ${ch}`, backgroundColor: color }}>
        <DiagLines />
        {i === 0 && (
          <div className="ph__label">
            {cardDimsEditing ? (
              <input
                className="ph__dims-input"
                value={cardDimsEditValue}
                onChange={e => setCardDimsEditValue(e.target.value)}
                onBlur={commitCardDimsEdit}
                onKeyDown={handleCardDimsKeyDown}
                autoFocus
              />
            ) : (
              <span
                className={`ph__dims${onCardDimsCommit ? ' ph__dims--editable' : ''}`}
                onClick={onCardDimsCommit ? startCardDimsEdit : undefined}
              >
                {cw}x{ch}px
              </span>
            )}
          </div>
        )}
      </div>
    ))

    return (
      <div className="ph-shop">
        <div className="ph-shop__col">{sideCards}</div>
        <div className="ph-shop__banner" style={{ aspectRatio: `${width} / ${height}`, backgroundColor: color }}>
          <DiagLines />
          <LabelArea
            {...labelAreaProps}
            dims={`${width}x${height}px - ${cw}x${ch}px`}
          />
        </div>
        <div className="ph-shop__col">{sideCards}</div>
      </div>
    )
  }

  if (layout === 'grid') {
    const midCol = Math.floor(cols / 2)
    return (
      <div className="ph-grid">
        {Array.from({ length: cols }, (_, i) => (
          <div
            key={i}
            className="ph-grid__card"
            style={{ aspectRatio: `${width} / ${height}`, backgroundColor: color }}
          >
            <DiagLines />
            {i === midCol && (
              <LabelArea
                {...labelAreaProps}
                dims={`${width}x${height}px`}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="ph-full"
      style={{ aspectRatio: `${width} / ${height}`, backgroundColor: color }}
    >
      <DiagLines />
      <LabelArea
        {...labelAreaProps}
        dims={`${width}x${height}${mbLabel}`}
      />
    </div>
  )
}
