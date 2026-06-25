import { useState, useEffect } from 'react'
import Palette from './components/Palette'
import Canvas from './components/Canvas'
import './App.css'

const STORAGE_KEY = 'landing-creator-projects'
const DRAFT_KEY = 'landing-creator-draft'

function loadProjects() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function persistProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

function loadDraft() {
  try {
    const data = localStorage.getItem(DRAFT_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

const DEFAULT_PALETTE = [
  {
    id: 'top-banner',
    name: 'Top Banner Gif',
    color: '#0a0a0a',
    selectedVariantId: 'completo',
    variants: [
      { id: 'completo', name: 'Completo', layout: 'full', cols: 1, width: 1920, height: 80, widthMb: 700, heightMb: 80 },
    ],
  },
  {
    id: 'banner-a',
    name: 'Banner A',
    color: '#1a1a1a',
    selectedVariantId: 'completo',
    variants: [
      { id: 'completo', name: 'Completo', layout: 'full', cols: 1, width: 1920, height: 640, widthMb: 750, heightMb: 1000 },
      { id: 'cards',    name: 'Cards',    layout: 'grid', cols: 5, width: 700,  height: 945 },
    ],
  },
  {
    id: 'banner-b',
    name: 'Banner B',
    color: '#111111',
    selectedVariantId: 'cards-der',
    variants: [
      { id: 'cards-der', name: 'Cards Der.', layout: 'carousel', cols: 2, width: 980, height: 764, cardWidth: 380, cardHeight: 500, bannerSide: 'left' },
      { id: 'cards-izq', name: 'Cards Izq.', layout: 'carousel', cols: 2, width: 980, height: 764, cardWidth: 380, cardHeight: 500, bannerSide: 'right' },
    ],
  },
  {
    id: 'banner-c',
    name: 'Banner C',
    color: '#111111',
    selectedVariantId: 'cards-der',
    variants: [
      { id: 'cards-der', name: 'Cards Der.', layout: 'carousel', cols: 3, width: 600, height: 800, widthMb: 600, heightMb: 250, cardWidth: 350, cardHeight: 500, bannerSide: 'left' },
      { id: 'cards-izq', name: 'Cards Izq.', layout: 'carousel', cols: 3, width: 600, height: 800, widthMb: 600, heightMb: 250, cardWidth: 350, cardHeight: 500, bannerSide: 'right' },
    ],
  },
  {
    id: 'banner-marca',
    name: 'Banner Marca',
    color: '#0a0a0a',
    selectedVariantId: 'completo',
    variants: [
      { id: 'completo', name: 'Completo', layout: 'full', cols: 1, width: 1366, height: 240, widthMb: 750, heightMb: 600 },
    ],
  },
  {
    id: 'shop-the-look',
    name: 'Shop the Look',
    color: '#0d0d0d',
    selectedVariantId: 'completo',
    variants: [
      { id: 'completo', name: 'Completo', layout: 'shop', cols: 3, width: 1000, height: 1000, cardWidth: 600, cardHeight: 250 },
    ],
  },
  {
    id: 'banner-categorias',
    name: 'Banner Categorías',
    color: '#111111',
    selectedVariantId: '4-col',
    variants: [
      { id: '2-col',    name: '2 col',    layout: 'grid', cols: 2, width: 600, height: 800 },
      { id: '3-col',    name: '3 col',    layout: 'grid', cols: 3, width: 600, height: 800 },
      { id: '4-col',    name: '4 col',    layout: 'grid', cols: 4, width: 600, height: 800 },
      { id: '5-slider', name: '5 Slider', layout: 'grid', cols: 5, width: 600, height: 800 },
    ],
  },
  {
    id: 'carrusel-productos',
    name: 'Carrusel Productos',
    color: '#111111',
    selectedVariantId: '4-col',
    variants: [
      { id: '3-col', name: '3 col', layout: 'grid', cols: 3, width: 400, height: 500 },
      { id: '4-col', name: '4 col', layout: 'grid', cols: 4, width: 300, height: 480 },
      { id: '5-col', name: '5 col', layout: 'grid', cols: 5, width: 240, height: 460 },
    ],
  },
  {
    id: 'video',
    name: 'Video',
    color: '#0a0a0a',
    selectedVariantId: 'completo',
    variants: [
      { id: 'completo', name: 'Completo', layout: 'full', cols: 1, width: 1920, height: 1080 },
    ],
  },
  {
    id: 'texto',
    name: 'Texto',
    color: '#111111',
    selectedVariantId: 'titulo',
    variants: [
      {
        id: 'titulo',
        name: 'Título',
        layout: 'text',
        textVariant: 'h1',
        cols: 1, width: 1920, height: 120,
        defaultLabel: 'Lorem ipsum dolor sit amet',
      },
      {
        id: 'subtitulo',
        name: 'Subtítulo',
        layout: 'text',
        textVariant: 'h2',
        cols: 1, width: 1920, height: 80,
        defaultLabel: 'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      },
    ],
  },
]

export default function App() {
  const [palette, setPalette] = useState(() => loadDraft()?.palette ?? DEFAULT_PALETTE)
  const [canvas, setCanvas] = useState(() => loadDraft()?.canvas ?? [])
  const [fullscreen, setFullscreen] = useState(false)

  const [projects, setProjects] = useState(loadProjects)
  const [currentProjectId, setCurrentProjectId] = useState(() => loadDraft()?.currentProjectId ?? null)
  const [projectName, setProjectName] = useState(() => loadDraft()?.projectName ?? '')
  const [showProjects, setShowProjects] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ canvas, palette, projectName, currentProjectId }))
  }, [canvas, palette, projectName, currentProjectId])

  // ── Palette handlers ──────────────────────────────
  const selectVariant = (categoryId, variantId) =>
    setPalette(prev => prev.map(cat =>
      cat.id === categoryId ? { ...cat, selectedVariantId: variantId } : cat
    ))

  const updateVariant = (categoryId, variantId, changes) =>
    setPalette(prev => prev.map(cat =>
      cat.id === categoryId
        ? { ...cat, variants: cat.variants.map(v => v.id === variantId ? { ...v, ...changes } : v) }
        : cat
    ))

  const updateCategory = (categoryId, changes) =>
    setPalette(prev => prev.map(cat =>
      cat.id === categoryId ? { ...cat, ...changes } : cat
    ))

  const addPaletteCategory = (name, width, height) =>
    setPalette(prev => [...prev, {
      id: crypto.randomUUID(),
      name,
      color: '#1a1a1a',
      selectedVariantId: 'completo',
      variants: [{ id: 'completo', name: 'Completo', layout: 'full', cols: 1, width: Number(width), height: Number(height) }],
    }])

  // ── Canvas handlers ───────────────────────────────
  const addToCanvas = (category, variant) =>
    setCanvas(prev => [...prev, {
      instanceId: crypto.randomUUID(),
      name: category.name,
      label: variant.defaultLabel || category.name,
      variantName: variant.name,
      layout: variant.layout,
      textVariant: variant.textVariant ?? null,
      cols: variant.cols,
      width: variant.width,
      height: variant.height,
      widthMb: variant.widthMb ?? null,
      heightMb: variant.heightMb ?? null,
      cardWidth: variant.cardWidth ?? null,
      cardHeight: variant.cardHeight ?? null,
      bannerSide: variant.bannerSide ?? 'left',
      color: category.color,
      customBarText: null,
    }])

  const updateCanvasLabel = (instanceId, label) =>
    setCanvas(prev => prev.map(item =>
      item.instanceId === instanceId ? { ...item, label } : item
    ))

  const updateCanvasBarText = (instanceId, customBarText) =>
    setCanvas(prev => prev.map(item =>
      item.instanceId === instanceId ? { ...item, customBarText } : item
    ))

  const updateCanvasDims = (instanceId, changes) =>
    setCanvas(prev => prev.map(item =>
      item.instanceId === instanceId ? { ...item, ...changes } : item
    ))

  const removeFromCanvas = (instanceId) =>
    setCanvas(prev => prev.filter(i => i.instanceId !== instanceId))

  const duplicateCanvasItem = (instanceId) => {
    const idx = canvas.findIndex(i => i.instanceId === instanceId)
    if (idx === -1) return
    setCanvas(prev => [
      ...prev.slice(0, idx + 1),
      { ...prev[idx], instanceId: crypto.randomUUID() },
      ...prev.slice(idx + 1),
    ])
  }

  const moveCanvas = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= canvas.length) return
    setCanvas(prev => {
      const next = [...prev]
      ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
      return next
    })
  }

  // ── Project handlers ──────────────────────────────
  const handleSave = () => {
    const name = projectName.trim()
    if (!name) return
    const id = currentProjectId || crypto.randomUUID()
    const project = { id, name, savedAt: Date.now(), canvas, palette }
    const updated = currentProjectId
      ? projects.map(p => p.id === id ? project : p)
      : [...projects, project]
    setProjects(updated)
    persistProjects(updated)
    setCurrentProjectId(id)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const handleLoad = (project) => {
    setCanvas(project.canvas)
    setPalette(project.palette)
    setCurrentProjectId(project.id)
    setProjectName(project.name)
    setShowProjects(false)
  }

  const handleDelete = (id) => {
    const updated = projects.filter(p => p.id !== id)
    setProjects(updated)
    persistProjects(updated)
    if (id === currentProjectId) {
      setCurrentProjectId(null)
      setProjectName('')
    }
  }

  const handleNew = () => {
    setCanvas([])
    setPalette(DEFAULT_PALETTE)
    setCurrentProjectId(null)
    setProjectName('')
    localStorage.removeItem(DRAFT_KEY)
  }

  const formatDate = (ts) =>
    new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className={`app${fullscreen ? ' app--fullscreen' : ''}`}>

      {!fullscreen && (
        <nav className="app-nav">
          <div className="app-nav__brand">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity=".9"/>
              <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity=".5"/>
              <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".5"/>
              <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".9"/>
            </svg>
            <span>Landing Creator</span>
          </div>

          <div className="app-nav__center">
            <input
              className="app-nav__project-input"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Sin título..."
              spellCheck={false}
            />
            {savedFlash && <span className="app-nav__saved">✓ Guardado</span>}
          </div>

          <div className="app-nav__actions">
            <button className="btn-ghost" onClick={handleNew}>Nuevo</button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={!projectName.trim()}
            >
              Guardar
            </button>
            <button
              className={`btn-ghost app-nav__projects-btn${showProjects ? ' app-nav__projects-btn--active' : ''}`}
              onClick={() => setShowProjects(s => !s)}
            >
              Proyectos
              {projects.length > 0 && (
                <span className="app-nav__badge">{projects.length}</span>
              )}
            </button>
          </div>
        </nav>
      )}

      <div className="app__content">
        {!fullscreen && (
          <aside className="sidebar">
            <header className="sidebar__header">
              <span className="label-caps">Componentes</span>
            </header>
            <Palette
              categories={palette}
              onSelectVariant={selectVariant}
              onUpdateVariant={updateVariant}
              onUpdateCategory={updateCategory}
              onNewCategory={addPaletteCategory}
              onAdd={addToCanvas}
            />
          </aside>
        )}

        <main className="canvas-area">
          <header className="canvas-area__header">
            <span className="label-caps">
              {fullscreen ? 'Preview' : 'Canvas'}
              {canvas.length > 0 && !fullscreen && (
                <span className="canvas-count">{canvas.length}</span>
              )}
            </span>
            <button className="btn-ghost" onClick={() => setFullscreen(f => !f)}>
              {fullscreen ? '✕ Cerrar' : '⛶ Pantalla completa'}
            </button>
          </header>
          <Canvas
            items={canvas}
            fullscreen={fullscreen}
            onRemove={removeFromCanvas}
            onDuplicate={duplicateCanvasItem}
            onMove={moveCanvas}
            onUpdateLabel={updateCanvasLabel}
            onUpdateBarText={updateCanvasBarText}
            onUpdateDims={updateCanvasDims}
          />
        </main>
      </div>

      {showProjects && (
        <>
          <div className="projects-overlay" onClick={() => setShowProjects(false)} />
          <div className="projects-panel">
            <div className="projects-panel__header">
              <span className="label-caps">Proyectos guardados</span>
              <button className="projects-panel__close" onClick={() => setShowProjects(false)}>✕</button>
            </div>
            <div className="projects-panel__body">
              {projects.length === 0 ? (
                <div className="projects-panel__empty">
                  <p>No hay proyectos guardados aún.</p>
                  <p>Escribí un nombre y hacé clic en <strong>Guardar</strong>.</p>
                </div>
              ) : (
                <ul className="projects-panel__list">
                  {[...projects].sort((a, b) => b.savedAt - a.savedAt).map(p => (
                    <li
                      key={p.id}
                      className={`projects-panel__item${p.id === currentProjectId ? ' projects-panel__item--active' : ''}`}
                    >
                      <div className="projects-panel__item-info">
                        <span className="projects-panel__item-name">{p.name}</span>
                        <span className="projects-panel__item-meta">
                          {formatDate(p.savedAt)} · {p.canvas.length} componente{p.canvas.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="projects-panel__item-actions">
                        <button className="btn-ghost" onClick={() => handleLoad(p)}>Abrir</button>
                        <button className="projects-panel__delete" onClick={() => handleDelete(p.id)} title="Eliminar">✕</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  )
}
