const SWATCHES = ['#0a0a0a', '#1a1a1a', '#111827', '#1e293b', '#2d1b3d', '#1c1917']

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

  return (
    <div className="cat-card">
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
        <div className="dim-row">
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
              Cols
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

        {variant.layout === 'carousel' && (
          <div className="dim-row">
            <label className="dim-label dim-label--mb">
              Card W
              <input
                type="number"
                value={variant.cardWidth ?? 380}
                min="1"
                onChange={e => onUpdateVariant(category.id, variant.id, { cardWidth: Math.max(1, Number(e.target.value)) })}
              />
            </label>
            <label className="dim-label dim-label--mb">
              Card H
              <input
                type="number"
                value={variant.cardHeight ?? 500}
                min="1"
                onChange={e => onUpdateVariant(category.id, variant.id, { cardHeight: Math.max(1, Number(e.target.value)) })}
              />
            </label>
            <label className="dim-label dim-label--mb">
              Cols
              <input
                type="number"
                value={variant.cols}
                min="1"
                max="6"
                onChange={e => onUpdateVariant(category.id, variant.id, { cols: Math.max(1, Math.min(6, Number(e.target.value))) })}
              />
            </label>
          </div>
        )}

        {variant.widthMb != null && (
          <div className="dim-row">
            <label className="dim-label dim-label--mb">
              W mb
              <input
                type="number"
                value={variant.widthMb}
                min="1"
                onChange={e => setVariantField('widthMb', e.target.value)}
              />
            </label>
            <label className="dim-label dim-label--mb">
              H mb
              <input
                type="number"
                value={variant.heightMb}
                min="1"
                onChange={e => setVariantField('heightMb', e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="field-colors">
          {SWATCHES.map(c => (
            <button
              key={c}
              className={`color-swatch${category.color === c ? ' is-active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => onUpdateCategory(category.id, { color: c })}
              title={c}
            />
          ))}
          <input
            type="color"
            className="color-picker"
            value={category.color}
            onChange={e => onUpdateCategory(category.id, { color: e.target.value })}
            title="Color personalizado"
          />
        </div>
      </div>

      <button className="cat-card__add" onClick={() => onAdd(category, variant)}>
        + Agregar al canvas
      </button>
    </div>
  )
}
