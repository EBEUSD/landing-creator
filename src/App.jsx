import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import Palette from './components/Palette'
import Canvas from './components/Canvas'
import { STORES, draftKey } from './stores'
import './App.css'

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
      { id: 'completo', name: 'Completo', layout: 'shop', cols: 3, width: 1000, height: 1000, cardWidth: 600, cardHeight: 250, widthMb: 600, heightMb: 250 },
    ],
  },
  {
    id: 'banner-categorias',
    name: 'Banner Categorías',
    color: '#111111',
    selectedVariantId: '4-col',
    variants: [
      { id: '2-col',    name: '2 col',    layout: 'grid', cols: 2, width: 600, height: 800, widthMb: null, heightMb: null },
      { id: '3-col',    name: '3 col',    layout: 'grid', cols: 3, width: 600, height: 800, widthMb: null, heightMb: null },
      { id: '4-col',    name: '4 col',    layout: 'grid', cols: 4, width: 600, height: 800, widthMb: null, heightMb: null },
      { id: '5-slider', name: '5 Slider', layout: 'grid', cols: 5, width: 600, height: 800, widthMb: null, heightMb: null },
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

function mergePaletteWithDefaults(loaded) {
  return loaded.map(cat => {
    const def = DEFAULT_PALETTE.find(d => d.id === cat.id)
    if (!def) return cat
    return {
      ...cat,
      variants: cat.variants.map(v => {
        const defV = def.variants.find(dv => dv.id === v.id)
        if (!defV) return v
        const merged = { ...v }
        for (const key of Object.keys(defV)) {
          if (!(key in merged)) merged[key] = defV[key]
        }
        return merged
      }),
    }
  })
}

function loadDraft(storeId) {
  try {
    const data = localStorage.getItem(draftKey(storeId))
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export default function App() {
  const { storeId } = useParams()
  const navigate = useNavigate()
  const store = STORES.find(s => s.id === storeId)

  const [palette, setPalette] = useState(() => {
    const d = loadDraft(storeId)
    return d?.palette ? mergePaletteWithDefaults(d.palette) : DEFAULT_PALETTE
  })
  const [canvas, setCanvas] = useState(() => loadDraft(storeId)?.canvas ?? [])
  const [fullscreen, setFullscreen] = useState(false)

  const [currentProjectId, setCurrentProjectId] = useState(() => loadDraft(storeId)?.currentProjectId ?? null)
  const currentProjectIdRef = useRef(loadDraft(storeId)?.currentProjectId ?? null)
  const [projectName, setProjectName] = useState(() => loadDraft(storeId)?.projectName ?? '')
  const [folderLink, setFolderLink] = useState(() => loadDraft(storeId)?.folderLink ?? '')
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    localStorage.setItem(draftKey(storeId), JSON.stringify({ canvas, palette, projectName, currentProjectId, folderLink }))
  }, [canvas, palette, projectName, currentProjectId, folderLink, storeId])

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
      notes: [{ id: crypto.randomUUID(), status: '', titulo: '', urlImagen: '', idProductos: '', idProductosMobile: '', skus: '' }],
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

  const updateCanvasNotes = (instanceId, notes) =>
    setCanvas(prev => prev.map(item =>
      item.instanceId === instanceId ? { ...item, notes } : item
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
  const handleSave = async () => {
    const name = projectName.trim()
    if (!name) return
    const id = currentProjectIdRef.current || crypto.randomUUID()
    currentProjectIdRef.current = id
    setCurrentProjectId(id)
    const project = { id, name, savedAt: Date.now(), canvas, palette, folderLink }
    await setDoc(doc(db, 'stores', storeId, 'projects', id), project)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const handleNew = () => {
    currentProjectIdRef.current = null
    setCanvas([])
    setPalette(DEFAULT_PALETTE)
    setCurrentProjectId(null)
    setProjectName('')
    setFolderLink('')
    localStorage.removeItem(draftKey(storeId))
  }

  return (
    <div className={`app${fullscreen ? ' app--fullscreen' : ''}`}>

      {!fullscreen && (
        <nav className="app-nav">
          <div className="app-nav__brand">
            <button
              className="app-nav__back"
              onClick={() => navigate(`/store/${storeId}`)}
              title="Volver a proyectos"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {store && (
              <span
                className="app-nav__store-dot"
                style={{ background: store.color }}
                title={store.name}
              />
            )}
            <span className="app-nav__brand-text">
              {store ? store.name : 'Landing Creator'}
            </span>
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
            {!fullscreen && (
              <div className="canvas-folder-wrap">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="canvas-folder-icon">
                  <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3.086a1.5 1.5 0 0 1 1.06.44l.915.914A1.5 1.5 0 0 0 9.62 4.9H12.5A1.5 1.5 0 0 1 14 6.4v5.1A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
                </svg>
                <input
                  className="canvas-folder-input"
                  type="url"
                  value={folderLink}
                  onChange={e => setFolderLink(e.target.value)}
                  placeholder="Link carpeta de piezas..."
                  spellCheck={false}
                />
                {folderLink && (
                  <a
                    href={/^https?:\/\//i.test(folderLink) ? folderLink : `https://${folderLink}`}
                    target="_blank"
                    rel="noreferrer"
                    className="canvas-folder-open"
                    title="Abrir carpeta"
                  >
                    ↗
                  </a>
                )}
              </div>
            )}
            <button className="btn-ghost" onClick={() => setFullscreen(f => !f)}>
              {fullscreen ? '✕ Cerrar' : '⛶ Pantalla completa'}
            </button>
          </header>
          <Canvas
            items={canvas}
            fullscreen={fullscreen}
            storeId={storeId}
            onRemove={removeFromCanvas}
            onDuplicate={duplicateCanvasItem}
            onMove={moveCanvas}
            onUpdateLabel={updateCanvasLabel}
            onUpdateBarText={updateCanvasBarText}
            onUpdateDims={updateCanvasDims}
            onUpdateNotes={updateCanvasNotes}
          />
        </main>
      </div>

    </div>
  )
}
