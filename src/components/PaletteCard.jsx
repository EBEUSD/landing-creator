const BLACK = '#0a0a0a'

export default function PaletteCard({ item, onUpdate, onAdd }) {
  return (
    <div className="palette-card">
      <div className="palette-card__preview" style={{ background: item.color }}>
        <svg
          className="palette-card__preview-lines"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="0" x2="100" y2="100" stroke="rgba(255,255,255,0.08)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="100" y1="0" x2="0" y2="100" stroke="rgba(255,255,255,0.08)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="palette-card__preview-label">
          <span className="ph-name-sm">{item.name}</span>
          <span className="ph-dims-sm">{item.width} × {item.height}</span>
        </div>
      </div>

      <div className="palette-card__fields">
        <input
          type="text"
          className="field-name"
          value={item.name}
          onChange={e => onUpdate(item.id, { name: e.target.value })}
          placeholder="Nombre"
        />
        <div className="dim-section">
          <span className="dim-section__label">Desktop</span>
          <div className="dim-section__inputs">
            <label className="dim-label">
              W
              <input
                type="number"
                value={item.width}
                min="1"
                onChange={e => onUpdate(item.id, { width: Math.max(1, Number(e.target.value)) })}
              />
            </label>
            <label className="dim-label">
              H
              <input
                type="number"
                value={item.height}
                min="1"
                onChange={e => onUpdate(item.id, { height: Math.max(1, Number(e.target.value)) })}
              />
            </label>
          </div>
        </div>
        <div className="dim-colors">
          <button
            className={`color-swatch${item.color === BLACK ? ' is-active' : ''}`}
            style={{ backgroundColor: BLACK }}
            onClick={() => onUpdate(item.id, { color: BLACK })}
            title="Negro"
          />
          <label className="color-picker-btn" title="Color personalizado">
            <span className="color-picker-btn__dot" style={{ backgroundColor: item.color }} />
            <span className="color-picker-btn__text">Personalizado</span>
            <input
              type="color"
              value={item.color}
              onChange={e => onUpdate(item.id, { color: e.target.value })}
            />
          </label>
        </div>
      </div>

      <button className="palette-card__add" onClick={() => onAdd(item)}>
        + Agregar al canvas
      </button>
    </div>
  )
}
