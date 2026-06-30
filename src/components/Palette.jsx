import { useState } from 'react'
import CategoryCard from './CategoryCard'

export default function Palette({ categories, onSelectVariant, onUpdateVariant, onUpdateCategory, onNewCategory, onAdd }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [w, setW] = useState(1920)
  const [h, setH] = useState(400)

  const handleCreate = () => {
    if (!name.trim()) return
    onNewCategory(name.trim(), w, h)
    setName('')
    setW(1920)
    setH(400)
    setShowForm(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') setShowForm(false)
  }

  return (
    <div className="palette">
      <div className="palette__list">
        {categories.map((cat, i) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            index={i}
            onSelectVariant={onSelectVariant}
            onUpdateVariant={onUpdateVariant}
            onUpdateCategory={onUpdateCategory}
            onAdd={onAdd}
          />
        ))}
      </div>

      <div className="palette__footer">
        {showForm ? (
          <div className="new-form" onKeyDown={handleKey}>
            <input
              type="text"
              placeholder="Nombre del componente"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            <div className="dim-row">
              <label className="dim-label">W <input type="number" value={w} min="1" onChange={e => setW(e.target.value)} /></label>
              <label className="dim-label">H <input type="number" value={h} min="1" onChange={e => setH(e.target.value)} /></label>
            </div>
            <div className="new-form__actions">
              <button className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreate} disabled={!name.trim()}>Crear</button>
            </div>
          </div>
        ) : (
          <button className="btn-new" onClick={() => setShowForm(true)}>+ Nuevo componente</button>
        )}
      </div>
    </div>
  )
}
