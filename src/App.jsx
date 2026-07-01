import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { doc, setDoc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import Palette from './components/Palette'
import Canvas from './components/Canvas'
import CanvasQuickNav from './components/CanvasQuickNav'
import { STORES, draftKey } from './stores'
import './App.css'

const TEAM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

function NotifyModal({ projectName, projectCode, projectId, storeName, storeId, canvasCount, folderLink, teams, onClose }) {
  const [notifyIds, setNotifyIds] = useState([])
  const toggle = id => setNotifyIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  const handleNotify = () => {
    const emails = teams
      .filter(t => notifyIds.includes(t.id))
      .flatMap(t => (t.members || []).map(m => m.email))
      .filter(Boolean)

    if (emails.length > 0) {
      const projectUrl = window.location.href
      const subject = projectCode
        ? `[${projectCode}] Actualización: ${projectName}`
        : `Actualización: ${projectName}`
      const body = [
        `Hola,`,
        ``,
        `Se actualizó el proyecto "${projectName}" en Landing Creator.`,
        ``,
        `▸ Tienda: ${storeName}`,
        `▸ Componentes: ${canvasCount}`,
        projectId   ? `▸ ID: ${projectId}` : '',
        projectCode ? `▸ Código: ${projectCode}` : '',
        folderLink  ? `▸ Carpeta: ${folderLink}` : '',
        `▸ Ver proyecto: ${projectUrl}`,
        ``,
        `— Landing Creator`,
      ].filter(Boolean).join('\n')
      window.open(
        `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        '_blank'
      )
    }
    onClose()
  }

  return (
    <div className="app-notify-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="app-notify-modal">
        <div className="app-notify__head">
          <div className="app-notify__check">✓</div>
          <div>
            <div className="app-notify__title">Proyecto guardado</div>
            <div className="app-notify__sub">{projectName} · {storeName} · {canvasCount} componente{canvasCount !== 1 ? 's' : ''}</div>
          </div>
          <button className="app-notify__close" onClick={onClose}>✕</button>
        </div>

        <div className="app-notify__body">
          <p className="app-notify__label">Notificar actualización a:</p>
          <div className="app-notify__teams">
            {teams.map(t => (
              <button
                key={t.id}
                type="button"
                className={`app-notify__team${notifyIds.includes(t.id) ? ' app-notify__team--active' : ''}`}
                style={{ '--tc': t.color || TEAM_COLORS[0] }}
                onClick={() => toggle(t.id)}
              >
                <span className="app-notify__team-dot" style={{ background: t.color || TEAM_COLORS[0] }} />
                {t.name}
                <span className="app-notify__team-count">{(t.members || []).length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="app-notify__actions">
          <button className="btn-ghost" onClick={onClose}>Omitir</button>
          <button
            className="btn-primary"
            onClick={handleNotify}
            disabled={notifyIds.length === 0}
          >
            Notificar{notifyIds.length > 0 ? ` (${notifyIds.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
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

const DEFAULT_PALETTE_ML = [
  {
    id: 'ml-banner-principal',
    name: 'Banner Principal',
    color: '#111827',
    selectedVariantId: 'completo',
    variants: [
      { id: 'completo', name: 'Completo', layout: 'full', cols: 1, width: 1920, height: 480, widthMb: 600, heightMb: 450 },
    ],
  },
  {
    id: 'ml-banner-secundario',
    name: 'Banner Secundario',
    color: '#111827',
    selectedVariantId: 'completo',
    variants: [
      { id: 'completo', name: 'Completo', layout: 'full', cols: 1, width: 1500, height: 250, widthMb: 600, heightMb: 200 },
    ],
  },
  {
    id: 'ml-etiqueta-producto',
    name: 'Etiqueta de Producto',
    color: '#111827',
    selectedVariantId: 'completo',
    variants: [
      { id: 'completo', name: 'Completo', layout: 'etiqueta', cols: 1, width: 1200, height: 800 },
    ],
  },
  {
    id: 'ml-galeria-categoria',
    name: 'Galería de Categoría',
    color: '#111827',
    selectedVariantId: '2-cat',
    variants: [
      { id: '2-cat', name: '2 categorías', layout: 'galeria', cols: 2, width: 574, height: 323, widthMb: 328, heightMb: 184 },
      { id: '3-cat', name: '3 categorías', layout: 'galeria', cols: 3, width: 327, height: 209, widthMb: 328, heightMb: 184 },
      { id: '4-cat', name: '4 categorías', layout: 'galeria', cols: 4, width: 271, height: 153, widthMb: 156, heightMb: 156 },
    ],
  },
  {
    id: 'ml-carrusel-producto',
    name: 'Carrusel de Producto',
    color: '#111827',
    selectedVariantId: '2-col',
    variants: [
      { id: '2-col', name: '2 columnas', layout: 'carrusel-cat', cols: 2, width: 574, height: 323 },
      { id: '3-col', name: '3 columnas', layout: 'carrusel-cat', cols: 3, width: 372, height: 209 },
      { id: '4-col', name: '4 columnas', layout: 'carrusel-cat', cols: 4, width: 271, height: 153 },
    ],
  },
  {
    id: 'ml-lista-contenido',
    name: 'Lista de Contenido',
    color: '#111827',
    selectedVariantId: '2-col',
    variants: [
      { id: '2-col', name: '2 columnas', layout: 'lista-contenido', cols: 2, width: 574, height: 765, widthMb: 350, heightMb: 466 },
      { id: '3-col', name: '3 columnas', layout: 'lista-contenido', cols: 3, width: 574, height: 765, widthMb: 350, heightMb: 466 },
      { id: '4-col', name: '4 columnas', layout: 'lista-contenido', cols: 4, width: 574, height: 765, widthMb: 350, heightMb: 466 },
    ],
  },
  {
    id: 'ml-video-portada',
    name: 'Video',
    color: '#0a0a0a',
    selectedVariantId: 'derecha',
    variants: [
      { id: 'derecha', name: 'Derecha', layout: 'video', cols: 1, width: 1280, height: 720 },
      { id: 'encima',  name: 'Encima',  layout: 'video', cols: 1, width: 1180, height: 468 },
      { id: 'arriba',  name: 'Arriba',  layout: 'video', cols: 1, width: 1180, height: 360 },
    ],
  },
]

function getDefaultPalette(storeId) {
  if (storeId === 'mercadolibre') return DEFAULT_PALETTE_ML
  return DEFAULT_PALETTE
}

function mergePaletteWithDefaults(loaded, defaultPalette) {
  return defaultPalette.map(def => {
    const cat = loaded.find(c => c.id === def.id)
    if (!cat) return def
    return {
      ...def,
      ...cat,
      variants: def.variants.map(defV => {
        const v = cat.variants?.find(cv => cv.id === defV.id)
        if (!v) return defV
        return { ...defV, ...v }
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

function generateProjectCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function App() {
  const { storeId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlProjectId = searchParams.get('p')
  const store = STORES.find(s => s.id === storeId)

  const draft = urlProjectId ? null : loadDraft(storeId)
  const defaultPalette = getDefaultPalette(storeId)

  const [palette, setPalette] = useState(() =>
    draft?.palette ? mergePaletteWithDefaults(draft.palette, defaultPalette) : defaultPalette
  )
  const [canvas, setCanvas] = useState(() => draft?.canvas ?? [])
  const [fullscreen, setFullscreen] = useState(false)

  const [currentProjectId, setCurrentProjectId] = useState(() => urlProjectId ?? draft?.currentProjectId ?? null)
  const currentProjectIdRef = useRef(urlProjectId ?? draft?.currentProjectId ?? null)
  const [projectName, setProjectName] = useState(() => draft?.projectName ?? '')
  const [folderLink, setFolderLink] = useState(() => draft?.folderLink ?? '')
  const [eventId, setEventId] = useState(() => draft?.eventId ?? null)
  const [projectCode, setProjectCode] = useState(() => draft?.projectCode ?? null)
  const [loadingProject, setLoadingProject] = useState(!!urlProjectId)
  const [savedFlash, setSavedFlash] = useState(false)
  const [teams, setTeams] = useState([])
  const [showNotifyModal, setShowNotifyModal] = useState(false)

  const loadedProjectIdRef = useRef(null)

  useEffect(() => {
    if (!urlProjectId || urlProjectId === loadedProjectIdRef.current) return
    loadedProjectIdRef.current = urlProjectId
    setLoadingProject(true)
    getDoc(doc(db, 'stores', storeId, 'projects', urlProjectId))
      .then(snap => {
        if (snap.exists()) {
          const p = snap.data()
          setCanvas(p.canvas || [])
          setPalette(mergePaletteWithDefaults(p.palette || defaultPalette, defaultPalette))
          setProjectName(p.name || '')
          setCurrentProjectId(urlProjectId)
          currentProjectIdRef.current = urlProjectId
          setFolderLink(p.folderLink || '')
          setEventId(p.eventId || null)
          setProjectCode(p.projectCode || null)
        }
        setLoadingProject(false)
      })
      .catch(() => setLoadingProject(false))
  }, [urlProjectId, storeId])

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'teams'), orderBy('createdAt')),
      snap => setTeams(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
      () => {}
    )
    return unsub
  }, [])

  useEffect(() => {
    localStorage.setItem(draftKey(storeId), JSON.stringify({ canvas, palette, projectName, currentProjectId, folderLink, eventId, projectCode }))
  }, [canvas, palette, projectName, currentProjectId, folderLink, eventId, projectCode, storeId])

  // Auto-save a Firestore cuando el proyecto ya tiene ID y el usuario edita
  const autoSaveTimer = useRef(null)
  useEffect(() => {
    if (!currentProjectId || loadingProject) return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      const id = currentProjectIdRef.current
      if (!id) return
      try {
        await setDoc(doc(db, 'stores', storeId, 'projects', id), {
          id,
          name: projectName.trim() || 'Sin título',
          savedAt: Date.now(),
          canvas,
          palette,
          folderLink,
          eventId: eventId ?? null,
          projectCode: projectCode ?? null,
        })
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 2000)
      } catch (_) {}
    }, 2500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [canvas, palette, projectName, folderLink, eventId, currentProjectId, loadingProject])

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
      comment: '',
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

  const reorderCanvas = (from, to) =>
    setCanvas(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })

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
    loadedProjectIdRef.current = id
    const code = projectCode || generateProjectCode()
    if (!projectCode) setProjectCode(code)
    const project = { id, name, savedAt: Date.now(), canvas, palette, folderLink, eventId: eventId ?? null, projectCode: code }
    await setDoc(doc(db, 'stores', storeId, 'projects', id), project)
    setSearchParams({ p: id }, { replace: true })
    if (teams.length > 0) {
      setShowNotifyModal(true)
    } else {
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    }
  }

  const handleNew = () => {
    currentProjectIdRef.current = null
    loadedProjectIdRef.current = null
    setCanvas([])
    setPalette(defaultPalette)
    setCurrentProjectId(null)
    setProjectName('')
    setFolderLink('')
    setEventId(null)
    setProjectCode(null)
    localStorage.removeItem(draftKey(storeId))
    setSearchParams({}, { replace: true })
  }

  if (loadingProject) {
    return (
      <div className="app-loading">
        <span className="app-loading__dot" />
        <span className="app-loading__dot" />
        <span className="app-loading__dot" />
      </div>
    )
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
              menú
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
            {projectCode && (
              <span className="app-nav__code" title="ID del proyecto">{projectCode}</span>
            )}
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
            onDropAdd={addToCanvas}
            onReorder={reorderCanvas}
          />
        </main>
      </div>

      {!fullscreen && <CanvasQuickNav canvas={canvas} />}

      {showNotifyModal && (
        <NotifyModal
          projectName={projectName.trim()}
          projectCode={projectCode}
          projectId={currentProjectIdRef.current}
          storeName={store?.name ?? ''}
          storeId={storeId}
          canvasCount={canvas.length}
          folderLink={folderLink}
          teams={teams}
          onClose={() => {
            setShowNotifyModal(false)
            setSavedFlash(true)
            setTimeout(() => setSavedFlash(false), 2000)
          }}
        />
      )}
    </div>
  )
}
