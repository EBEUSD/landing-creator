import { useEffect, useState } from 'react'

const PLACEHOLDER = `Banner A:
  Banner A largo (1920x640dk / 750x1000mb)
  Banner A Chicos (700x945)
..
Banner C:
  Izq (600x800dk / 600x250mb)
  der (600x800dk / 600x250mb)
...
banner categorias (700x945dk / 450x680mb)`

export default function ImportPaletteModal({ initialText, onClose, onGenerate }) {
  const [text, setText] = useState(initialText || '')

  useEffect(() => { setText(initialText || '') }, [initialText])

  const handleGenerate = () => {
    if (!text.trim()) return
    onGenerate(text)
    onClose()
  }

  return (
    <div className="import-palette-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="import-palette-modal">
        <div className="import-palette-modal__head">
          <div>
            <span className="import-palette-modal__title">Pegar medidas</span>
            <span className="import-palette-modal__sub">
              Nombre (anchoxaltodk / anchoxaltomb) — agrupá variantes con "Nombre:" arriba y una línea de puntos para separar
            </span>
          </div>
          <button className="import-palette-modal__close" onClick={onClose}>✕</button>
        </div>

        <textarea
          className="import-palette-modal__textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          autoFocus
        />

        <div className="import-palette-modal__actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleGenerate} disabled={!text.trim()}>
            Generar componentes
          </button>
        </div>
      </div>
    </div>
  )
}
