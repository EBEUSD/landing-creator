const BLACK = '#0a0a0a'

function DiagLines() {
  return (
    <svg
      className="cpreview__lines"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <line x1="0" y1="0" x2="100" y2="100" stroke="rgba(255,255,255,0.09)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line x1="100" y1="0" x2="0" y2="100" stroke="rgba(255,255,255,0.09)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function CompactPreview({ layout, cols, name, width, height, widthMb, heightMb, color, cardWidth, cardHeight, bannerSide }) {
  const mbLabel = widthMb ? ` - ${widthMb}x${heightMb}mb` : ''

  if (layout === 'carousel') {
    const cw = cardWidth || 380

    const bannerCell = (
      <div key="banner" className="cpreview__cell" style={{ background: color, flex: width }}>
        <DiagLines />
        <div className="cpreview__text">
          <span className="cpreview__name">{name}///</span>
          <span className="cpreview__dims">{width}x{height}</span>
        </div>
      </div>
    )

    const cardCells = Array.from({ length: cols }, (_, i) => (
      <div key={i} className="cpreview__cell" style={{ background: color, flex: cw }}>
        <DiagLines />
      </div>
    ))

    return (
      <div className="cpreview">
        {bannerSide === 'right' ? [...cardCells, bannerCell] : [bannerCell, ...cardCells]}
      </div>
    )
  }

  const colCount = layout === 'grid' ? cols : 1
  return (
    <div className="cpreview">
      {Array.from({ length: colCount }, (_, i) => (
        <div key={i} className="cpreview__cell" style={{ background: color }}>
          <DiagLines />
          {i === 0 && (
            <div className="cpreview__text">
              <span className="cpreview__name">{name}///</span>
              <span className="cpreview__dims">{width}x{height}{mbLabel}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function CategoryCard({ category, onSelectVariant, onUpdateVariant, onUpdateCategory, onAdd }) {
  const variant = category.variants.find(v => v.id === category.selectedVariantId)

  const setVariantField = (field, value) =>
    onUpdateVariant(category.id, variant.id, { [field]: Math.max(1, Number(value)) })

  const setMobileField = (field, raw) =>
    onUpdateVariant(category.id, variant.id, { [field]: raw === '' ? null : Math.max(1, Number(raw)) })

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/landing-creator', JSON.stringify({ category, variant }))
  }

  return (
    <div
      className="cat-card"
      draggable
      onDragStart={handleDragStart}
    >
      <div className="cat-card__head">
        <span className="cat-card__name">{category.name}</span>
        {category.variants.length > 1 && (
          <div className="cat-card__tabs">
            {category.variants.map(v => (
              <button
                key={v.id}
                className={`tab-btn${v.id === category.selectedVariantId ? ' is-active' : ''}`}
                onClick={() => onSelectVariant(category.id, v.id)}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <CompactPreview
        layout={variant.layout}
        cols={variant.cols}
        name={category.name}
        width={variant.width}
        height={variant.height}
        widthMb={variant.widthMb}
        heightMb={variant.heightMb}
        color={category.color}
        cardWidth={variant.cardWidth}
        cardHeight={variant.cardHeight}
        bannerSide={variant.bannerSide}
      />

      <div className="cat-card__dims">

        <div className="dim-section">
          <span className="dim-section__label">Desktop</span>
          <div className="dim-section__inputs">
            <label className="dim-label">
              W
              <input
                type="number"
                value={variant.width}
                min="1"
                onChange={e => setVariantField('width', e.target.value)}
              />
            </label>
            <label className="dim-label">
              H
              <input
                type="number"
                value={variant.height}
                min="1"
                onChange={e => setVariantField('height', e.target.value)}
              />
            </label>
            {variant.layout === 'grid' && (
              <label className="dim-label">
                Col
                <input
                  type="number"
                  value={variant.cols}
                  min="1"
                  max="12"
                  onChange={e => onUpdateVariant(category.id, variant.id, { cols: Math.max(1, Math.min(12, Number(e.target.value))) })}
                />
              </label>
            )}
          </div>
        </div>

        {'widthMb' in variant && (
          <div className="dim-section dim-section--alt">
            <span className="dim-section__label">Mobile</span>
            <div className="dim-section__inputs">
              <label className="dim-label">
                W
                <input
                  type="number"
                  value={variant.widthMb ?? ''}
                  min="1"
                  placeholder="—"
                  onChange={e => setMobileField('widthMb', e.target.value)}
                />
              </label>
              <label className="dim-label">
                H
                <input
                  type="number"
                  value={variant.heightMb ?? ''}
                  min="1"
                  placeholder="—"
                  onChange={e => setMobileField('heightMb', e.target.value)}
                />
              </label>
            </div>
          </div>
        )}

        {variant.layout === 'carousel' && (
          <div className="dim-section dim-section--alt">
            <span className="dim-section__label">Cards</span>
            <div className="dim-section__inputs">
              <label className="dim-label">
                W
                <input
                  type="number"
                  value={variant.cardWidth ?? 380}
                  min="1"
                  onChange={e => onUpdateVariant(category.id, variant.id, { cardWidth: Math.max(1, Number(e.target.value)) })}
                />
              </label>
              <label className="dim-label">
                H
                <input
                  type="number"
                  value={variant.cardHeight ?? 500}
                  min="1"
                  onChange={e => onUpdateVariant(category.id, variant.id, { cardHeight: Math.max(1, Number(e.target.value)) })}
                />
              </label>
              <label className="dim-label">
                ×
                <input
                  type="number"
                  value={variant.cols}
                  min="1"
                  max="6"
                  onChange={e => onUpdateVariant(category.id, variant.id, { cols: Math.max(1, Math.min(6, Number(e.target.value))) })}
                />
              </label>
            </div>
          </div>
        )}

        <div className="dim-colors">
          <button
            className={`color-swatch${category.color === BLACK ? ' is-active' : ''}`}
            style={{ backgroundColor: BLACK }}
            onClick={() => onUpdateCategory(category.id, { color: BLACK })}
            title="Negro"
          />
          <label className="color-picker-btn" title="Color personalizado">
            <span className="color-picker-btn__dot" style={{ backgroundColor: category.color }} />
            <span className="color-picker-btn__text">Personalizado</span>
            <input
              type="color"
              value={category.color}
              onChange={e => onUpdateCategory(category.id, { color: e.target.value })}
            />
          </label>
        </div>

      </div>

      <button className="cat-card__add" onClick={() => onAdd(category, variant)}>
        + Agregar al canvas
      </button>
    </div>
  )
}
