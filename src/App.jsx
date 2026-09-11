import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, orderBy, onSnapshot, runTransaction } from 'firebase/firestore'
import { db } from './firebase'
import Palette from './components/Palette'
import Canvas from './components/Canvas'
import CanvasQuickNav from './components/CanvasQuickNav'
import { STORES, draftKey } from './stores'
import { parseBulkPaletteText } from './utils/dims'
import { ROUGE_IMAGES } from './assets/rougeImages'
import { buildChangeLog } from './utils/historyDiff'
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
        `▸ Ver proyecto: ${projectUrl}`,
        ``,
        `Hola,`,
        ``,
        `Se actualizó el proyecto "${projectName}" en Landing Creator.`,
        ``,
        `▸ Tienda: ${storeName}`,
        `▸ Componentes: ${canvasCount}`,
        projectId   ? `▸ ID: ${projectId}` : '',
        projectCode ? `▸ Código: ${projectCode}` : '',
        folderLink  ? `▸ Carpeta: ${folderLink}` : '',
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
      { id: 'cards',    name: 'Cards',    layout: 'grid', cols: 5, width: 700, height: 945 },
    ],
  },
  {
    id: 'banner-b',
    name: 'Banner B',
    color: '#111111',
    selectedVariantId: 'cards-der',
    variants: [
      { id: 'cards-der', name: 'Cards Der.', layout: 'carousel', cols: 2, width: 1500, height: 1050, cardWidth: 380, cardHeight: 500, bannerSide: 'left' },
      { id: 'cards-izq', name: 'Cards Izq.', layout: 'carousel', cols: 2, width: 1500, height: 1050, cardWidth: 380, cardHeight: 500, bannerSide: 'right' },
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
    selectedVariantId: '4-col-vertical',
    variants: [
      { id: '4-col-vertical',   name: '4 col vertical',   layout: 'grid', cols: 4, width: 500, height: 660, widthMb: 215, heightMb: 360 },
      { id: '4-col-horizontal', name: '4 col horizontal', layout: 'grid', cols: 4, width: 1000, height: 480, widthMb: 400, heightMb: 600 },
    ],
  },
  {
    id: 'carrusel-productos',
    name: 'Carrusel Productos',
    color: '#111111',
    selectedVariantId: 'completo',
    variants: [
      { id: 'completo', name: 'Completo', layout: 'grid', cols: 4, width: 300, height: 480 },
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

// Reemplaza el bloque de color abstracto por una captura real del componente,
// para poder reconocer cada banner de un vistazo en vez de cuadrados negros.
const DEFAULT_PALETTE_ROUGE = DEFAULT_PALETTE.map(cat => {
  if (cat.id === 'top-banner') {
    return { ...cat, variants: [{ ...cat.variants[0], image: ROUGE_IMAGES.topBannerSwitch }] }
  }
  if (cat.id === 'banner-a') {
    return {
      ...cat,
      variants: [
        { ...cat.variants[0], image: ROUGE_IMAGES.bannerALargo },
        { ...cat.variants[1], image: ROUGE_IMAGES.bannerAChicos },
      ],
    }
  }
  if (cat.id === 'banner-b') {
    return {
      ...cat,
      variants: [
        ...cat.variants.map(v => ({
          ...v,
          image: v.id === 'cards-der' ? ROUGE_IMAGES.bannerBIzq : ROUGE_IMAGES.bannerBDer,
        })),
        { ...cat.variants[0], id: 'video', name: 'Video', image: ROUGE_IMAGES.videoBannerB },
      ],
    }
  }
  if (cat.id === 'banner-c') {
    return {
      ...cat,
      variants: cat.variants.map(v => ({
        ...v,
        image: v.id === 'cards-der' ? ROUGE_IMAGES.bannerCIzq : ROUGE_IMAGES.bannerCDer,
      })),
    }
  }
  if (cat.id === 'banner-marca') {
    return { ...cat, variants: [{ ...cat.variants[0], image: ROUGE_IMAGES.bannerMarca }] }
  }
  if (cat.id === 'shop-the-look') {
    return {
      ...cat,
      variants: [
        { ...cat.variants[0], image: ROUGE_IMAGES.shopTheLook },
        { ...cat.variants[0], id: 'video', name: 'Video', image: ROUGE_IMAGES.videoShopTheLook },
      ],
    }
  }
  if (cat.id === 'carrusel-productos') {
    return { ...cat, variants: cat.variants.map(v => ({ ...v, image: ROUGE_IMAGES.carruselProductos })) }
  }
  if (cat.id === 'banner-categorias') {
    return {
      ...cat,
      variants: cat.variants.map(v => ({
        ...v,
        image: v.id === '4-col-vertical' ? ROUGE_IMAGES.bannerAChicos : ROUGE_IMAGES.bannerX4Horizontal,
      })),
    }
  }
  return cat
}).concat([
  {
    id: 'banner-x2',
    name: 'Banner x2',
    color: '#111111',
    selectedVariantId: 'completo',
    variants: [{ id: 'completo', name: 'Completo', layout: 'full', cols: 1, width: 600, height: 220, image: ROUGE_IMAGES.bannerX2 }],
  },
  {
    id: 'banner-x3',
    name: 'Banner x3',
    color: '#111111',
    selectedVariantId: 'completo',
    variants: [{ id: 'completo', name: 'Completo', layout: 'full', cols: 1, width: 1000, height: 480, widthMb: 400, heightMb: 600, image: ROUGE_IMAGES.bannerX3 }],
  },
])

function getDefaultPalette(storeId) {
  if (storeId === 'mercadolibre') return DEFAULT_PALETTE_ML
  if (storeId === 'rouge') return DEFAULT_PALETTE_ROUGE
  return DEFAULT_PALETTE
}

const PALETTE_DIM_KEYS = ['width', 'height', 'cardWidth', 'cardHeight', 'widthMb', 'heightMb', 'cols', 'layout', 'bannerSide', 'textVariant']

function mergePaletteWithDefaults(loaded, defaultPalette) {
  return defaultPalette.map(def => {
    const cat = loaded.find(c => c.id === def.id)
    if (!cat) return def
    const selectedVariantId = def.variants.some(v => v.id === cat.selectedVariantId)
      ? cat.selectedVariantId
      : def.selectedVariantId
    return {
      ...def,
      color: cat.color ?? def.color,
      selectedVariantId,
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

function formatDeletedAt(ts) {
  return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function generateProjectCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const MAX_HISTORY_VERSIONS = 200

// Best-effort: borra las versiones más viejas si nos pasamos del límite.
// Nunca debe romper el guardado principal si falla.
async function pruneHistoryVersions(storeId, projectId) {
  try {
    const historyCol = collection(db, 'stores', storeId, 'projects', projectId, 'history')
    const snap = await getDocs(query(historyCol, orderBy('savedAt', 'asc')))
    const excess = snap.docs.length - MAX_HISTORY_VERSIONS
    if (excess <= 0) return
    await Promise.all(snap.docs.slice(0, excess).map(d => deleteDoc(d.ref)))
  } catch (err) {
    console.error('No se pudo limpiar el historial de versiones:', err)
  }
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
  const [deletedItems, setDeletedItems] = useState(() => draft?.deletedItems ?? [])
  const [showHistory, setShowHistory] = useState(false)
  const [historyTab, setHistoryTab] = useState('eliminados')
  const [versions, setVersions] = useState([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [miniZoom, setMiniZoom] = useState(0.35)
  const [previewAll, setPreviewAll] = useState(false)
  const [previewDragFrom, setPreviewDragFrom] = useState(null)
  const [previewDragOver, setPreviewDragOver] = useState(null)

  const [currentProjectId, setCurrentProjectId] = useState(() => urlProjectId ?? draft?.currentProjectId ?? null)
  const currentProjectIdRef = useRef(urlProjectId ?? draft?.currentProjectId ?? null)
  const [projectName, setProjectName] = useState(() => draft?.projectName ?? '')
  const [folderLink, setFolderLink] = useState(() => draft?.folderLink ?? '')
  const [eventId, setEventId] = useState(() => draft?.eventId ?? null)
  const [projectCode, setProjectCode] = useState(() => draft?.projectCode ?? null)
  const [loadingProject, setLoadingProject] = useState(!!urlProjectId)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [saveConflict, setSaveConflict] = useState(false)
  const hasPendingSaveRef = useRef(false)
  const lastKnownSavedAtRef = useRef(null)
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
          setDeletedItems(p.deletedItems || [])
          setPalette(mergePaletteWithDefaults(p.palette || defaultPalette, defaultPalette))
          setProjectName(p.name || '')
          setCurrentProjectId(urlProjectId)
          currentProjectIdRef.current = urlProjectId
          setFolderLink(p.folderLink || '')
          setEventId(p.eventId || null)
          setProjectCode(p.projectCode || null)
          lastKnownSavedAtRef.current = p.savedAt ?? null
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
    localStorage.setItem(draftKey(storeId), JSON.stringify({ canvas, deletedItems, palette, projectName, currentProjectId, folderLink, eventId, projectCode }))
  }, [canvas, deletedItems, palette, projectName, currentProjectId, folderLink, eventId, projectCode, storeId])

  useEffect(() => {
    if (!showHistory || (historyTab !== 'versiones' && historyTab !== 'registro') || !currentProjectId) return
    let cancelled = false
    setLoadingVersions(true)
    const q = query(
      collection(db, 'stores', storeId, 'projects', currentProjectId, 'history'),
      orderBy('savedAt', 'desc')
    )
    getDocs(q)
      .then(snap => {
        if (cancelled) return
        setVersions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoadingVersions(false)
      })
      .catch(() => { if (!cancelled) setLoadingVersions(false) })
    return () => { cancelled = true }
  }, [showHistory, historyTab, currentProjectId, storeId])

  const changeLog = useMemo(() => buildChangeLog(versions), [versions])

  // Auto-save a Firestore cuando el proyecto ya tiene ID y el usuario edita.
  // pendingSaveRef siempre tiene el payload más reciente, para poder forzar
  // el guardado desde un listener global (visibilitychange/beforeunload) sin
  // depender de un closure con estado viejo.
  const autoSaveTimer = useRef(null)
  const pendingSaveRef = useRef(null)

  const flushSave = useRef(async () => {
    if (!pendingSaveRef.current) return
    const id = currentProjectIdRef.current
    if (!id) { pendingSaveRef.current = null; return }
    const payload = pendingSaveRef.current
    const knownSavedAt = lastKnownSavedAtRef.current
    pendingSaveRef.current = null
    clearTimeout(autoSaveTimer.current)
    const ref = doc(db, 'stores', storeId, 'projects', id)
    const historyRef = doc(collection(db, 'stores', storeId, 'projects', id, 'history'))
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        const serverSavedAt = snap.exists() ? snap.data().savedAt : null
        // Si el servidor tiene un guardado más nuevo que el último que vimos,
        // otra pestaña/persona editó este proyecto: no lo pisamos.
        if (serverSavedAt && knownSavedAt && serverSavedAt > knownSavedAt) {
          throw new Error('SAVE_CONFLICT')
        }
        tx.set(ref, payload)
        tx.set(historyRef, { savedAt: payload.savedAt, canvas: payload.canvas })
      })
      pruneHistoryVersions(storeId, id)
      lastKnownSavedAtRef.current = payload.savedAt
      hasPendingSaveRef.current = false
      setSaveError(false)
      setSaveConflict(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      if (err.message === 'SAVE_CONFLICT') {
        hasPendingSaveRef.current = false
        setSaveConflict(true)
      } else {
        console.error('Auto-save falló:', err)
        setSaveError(true)
      }
    }
  }).current

  useEffect(() => {
    if (!currentProjectId || loadingProject) return
    pendingSaveRef.current = {
      id: currentProjectIdRef.current,
      name: projectName.trim() || 'Sin título',
      savedAt: Date.now(),
      canvas,
      deletedItems,
      palette,
      folderLink,
      eventId: eventId ?? null,
      projectCode: projectCode ?? null,
    }
    hasPendingSaveRef.current = true
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(flushSave, 800)
    return () => clearTimeout(autoSaveTimer.current)
  }, [canvas, deletedItems, palette, projectName, folderLink, eventId, currentProjectId, loadingProject])

  // Si la pestaña se oculta (F5, cerrar, cambiar de pestaña) antes de que el
  // debounce dispare, forzamos el guardado ya mismo en vez de esperar.
  // El beforeunload queda como aviso adicional por si el guardado no llega a tiempo.
  useEffect(() => {
    const handleHide = () => {
      if (document.visibilityState !== 'hidden') return
      if (hasPendingSaveRef.current) flushSave()
    }
    const handlePageHide = () => { if (hasPendingSaveRef.current) flushSave() }
    const handleBeforeUnload = (e) => {
      if (!hasPendingSaveRef.current) return
      flushSave()
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    document.addEventListener('visibilitychange', handleHide)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleHide)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [flushSave])

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

  const addPaletteCategory = (name, width, height) =>
    setPalette(prev => [...prev, {
      id: crypto.randomUUID(),
      name,
      color: '#1a1a1a',
      selectedVariantId: 'completo',
      variants: [{ id: 'completo', name: 'Completo', layout: 'full', cols: 1, width: Number(width), height: Number(height) }],
    }])

  // Actualiza componentes existentes por nombre (case-insensitive) y agrega los que falten;
  // nunca borra componentes que no aparezcan en el texto pegado.
  const importPaletteFromText = (text) => {
    const groups = parseBulkPaletteText(text)
    if (!groups.length) return

    setPalette(prev => {
      const next = [...prev]

      for (const group of groups) {
        const catIdx = next.findIndex(c => c.name.trim().toLowerCase() === group.name.trim().toLowerCase())

        if (catIdx === -1) {
          const multi = group.variants.length > 1
          const variants = group.variants.map((v, i) => ({
            id: i === 0 ? 'completo' : crypto.randomUUID(),
            name: multi ? v.name : 'Completo',
            layout: 'full',
            cols: 1,
            width: v.width,
            height: v.height,
            widthMb: v.widthMb ?? null,
            heightMb: v.heightMb ?? null,
          }))
          next.push({
            id: crypto.randomUUID(),
            name: group.name,
            color: '#1a1a1a',
            selectedVariantId: variants[0].id,
            variants,
          })
          continue
        }

        const cat = next[catIdx]

        // Caso simple: la categoría existente y el grupo importado tienen 1 sola variante cada uno.
        // Actualizamos esa variante directamente, sin depender de que los nombres coincidan
        // (ej: variantes "Completo" de las categorías por defecto).
        if (cat.variants.length === 1 && group.variants.length === 1) {
          const v = group.variants[0]
          const variants = [{ ...cat.variants[0], width: v.width, height: v.height, widthMb: v.widthMb ?? null, heightMb: v.heightMb ?? null }]
          next[catIdx] = { ...cat, variants }
          continue
        }

        const variants = [...cat.variants]
        for (const v of group.variants) {
          const vIdx = variants.findIndex(existing => existing.name.trim().toLowerCase() === v.name.trim().toLowerCase())
          if (vIdx === -1) {
            variants.push({
              id: crypto.randomUUID(),
              name: v.name,
              layout: 'full',
              cols: 1,
              width: v.width,
              height: v.height,
              widthMb: v.widthMb ?? null,
              heightMb: v.heightMb ?? null,
            })
          } else {
            variants[vIdx] = { ...variants[vIdx], width: v.width, height: v.height, widthMb: v.widthMb ?? null, heightMb: v.heightMb ?? null }
          }
        }
        next[catIdx] = { ...cat, variants }
      }

      return next
    })
  }

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
      exampleImage: variant.image ?? null,
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

  const removeFromCanvas = (instanceId) => {
    const item = canvas.find(i => i.instanceId === instanceId)
    if (item) setDeletedItems(prev => [{ ...item, deletedAt: Date.now() }, ...prev].slice(0, 20))
    setCanvas(prev => prev.filter(i => i.instanceId !== instanceId))
  }

  const restoreDeletedItem = (instanceId) => {
    const entry = deletedItems.find(i => i.instanceId === instanceId)
    if (!entry) return
    const { deletedAt, ...item } = entry
    setCanvas(prev => [...prev, item])
    setDeletedItems(prev => prev.filter(i => i.instanceId !== instanceId))
  }

  const restoreVersion = (version) => {
    if (!window.confirm(`¿Reemplazar el canvas actual por la versión de ${formatDeletedAt(version.savedAt)}? Podés volver a elegir otra versión después si hace falta.`)) return
    setCanvas(version.canvas || [])
    setShowHistory(false)
  }

  const [clearingHistory, setClearingHistory] = useState(false)

  const handleClearVersionHistory = async () => {
    if (!currentProjectId || versions.length === 0) return
    if (!window.confirm(`Se van a borrar las ${versions.length} versiones guardadas de este proyecto (no afecta a los componentes actuales). No se puede deshacer. ¿Continuar?`)) return
    setClearingHistory(true)
    try {
      const historyCol = collection(db, 'stores', storeId, 'projects', currentProjectId, 'history')
      const snap = await getDocs(historyCol)
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
      setVersions([])
    } catch (err) {
      console.error('No se pudo limpiar el historial de versiones:', err)
      alert('No se pudo limpiar el historial. Probá de nuevo.')
    } finally {
      setClearingHistory(false)
    }
  }

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
    const project = { id, name, savedAt: Date.now(), canvas, deletedItems, palette, folderLink, eventId: eventId ?? null, projectCode: code }
    const ref = doc(db, 'stores', storeId, 'projects', id)
    const historyRef = doc(collection(db, 'stores', storeId, 'projects', id, 'history'))
    const knownSavedAt = lastKnownSavedAtRef.current

    try {
      // Igual que el autoguardado: si el servidor tiene un guardado más nuevo
      // que el último que vimos (otra pestaña, otra persona), no lo pisamos.
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        const serverSavedAt = snap.exists() ? snap.data().savedAt : null
        if (serverSavedAt && knownSavedAt && serverSavedAt > knownSavedAt) {
          throw new Error('SAVE_CONFLICT')
        }
        tx.set(ref, project)
        tx.set(historyRef, { savedAt: project.savedAt, canvas: project.canvas })
      })
      pruneHistoryVersions(storeId, id)
      lastKnownSavedAtRef.current = project.savedAt
      setSaveConflict(false)
      setSearchParams({ p: id }, { replace: true })
      if (teams.length > 0) {
        setShowNotifyModal(true)
      } else {
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 2000)
      }
    } catch (err) {
      if (err.message === 'SAVE_CONFLICT') {
        setSaveConflict(true)
      } else {
        console.error('Guardado manual falló:', err)
        setSaveError(true)
      }
    }
  }

  const handleNew = () => {
    currentProjectIdRef.current = null
    loadedProjectIdRef.current = null
    setCanvas([])
    setDeletedItems([])
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
            {saveError && (
              <span className="app-nav__save-error" title="No se pudo guardar el último cambio. Revisá tu conexión.">
                ⚠ Error al guardar
              </span>
            )}
            {saveConflict && (
              <span className="app-nav__save-conflict" title="Otra pestaña o persona guardó cambios más nuevos. Tu último cambio no se guardó para no pisarlo.">
                ⚠ Alguien más editó este proyecto —
                <button className="app-nav__save-conflict-btn" onClick={() => window.location.reload()}>recargar</button>
              </span>
            )}
          </div>

          <div className="app-nav__actions">
            {!currentProjectId && (
              <span className="app-nav__save-hint">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 3v4m0 2v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Guardá antes de salir — el autoguardado se activa después del primer guardado
              </span>
            )}
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
              onNewCategory={addPaletteCategory}
              onImportPalette={importPaletteFromText}
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
            {canvas.some(i => i.referenceImg) && (
              <button className="btn-ghost" onClick={() => setPreviewAll(true)}>
                ⊞ Preview refs
              </button>
            )}
            {!fullscreen && canvas.length > 0 && (
              <button className={`btn-ghost${compact ? ' btn-ghost--active' : ''}`} onClick={() => setCompact(c => !c)}>
                {compact ? 'Mostrar componentes' : 'Ocultar componentes'}
              </button>
            )}
            {!fullscreen && (
              <button className="btn-ghost" onClick={() => setShowHistory(true)}>
                ↺ Historial{deletedItems.length > 0 ? ` (${deletedItems.length})` : ''}
              </button>
            )}
            <button className="btn-ghost" onClick={() => setFullscreen(f => !f)}>
              {fullscreen ? '✕ Cerrar' : '⊡ Vista mini'}
            </button>
          </header>
          <Canvas
            items={canvas}
            fullscreen={fullscreen}
            compact={compact}
            onSetCompact={setCompact}
            miniZoom={miniZoom}
            onZoomChange={setMiniZoom}
            storeId={storeId}
            onRemove={removeFromCanvas}
            onDuplicate={duplicateCanvasItem}
            onMove={moveCanvas}
            onUpdateLabel={updateCanvasLabel}
            onUpdateBarText={updateCanvasBarText}
            onUpdateDims={updateCanvasDims}
            onUpdateNotes={updateCanvasNotes}
            onDropAdd={addToCanvas}
          />
        </main>
      </div>

      {!fullscreen && <CanvasQuickNav canvas={canvas} onReorder={reorderCanvas} />}

      {previewAll && (
        <div className="preview-all-overlay" onMouseDown={e => e.target === e.currentTarget && setPreviewAll(false)}>
          <div className="preview-all-panel">
            <div className="preview-all__head">
              <span className="preview-all__title">Preview de referencias</span>
              <span className="preview-all__sub">{canvas.filter(i => i.referenceImg).length} de {canvas.length} con imagen</span>
              <button className="preview-all__close" onClick={() => setPreviewAll(false)}>✕</button>
            </div>
            <div className="preview-all__list">
              {canvas.map((item, idx) => (
                <div
                  key={item.instanceId}
                  className={`preview-all__item${previewDragOver === idx ? ' preview-all__item--drop' : ''}${previewDragFrom === idx ? ' preview-all__item--dragging' : ''}`}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', String(idx))
                    setPreviewDragFrom(idx)
                  }}
                  onDragOver={e => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setPreviewDragOver(idx)
                  }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPreviewDragOver(null) }}
                  onDrop={e => {
                    e.preventDefault()
                    const from = Number(e.dataTransfer.getData('text/plain'))
                    if (!isNaN(from) && from !== idx) reorderCanvas(from, idx)
                    setPreviewDragFrom(null); setPreviewDragOver(null)
                  }}
                  onDragEnd={() => { setPreviewDragFrom(null); setPreviewDragOver(null) }}
                >
                  <div className="preview-all__item-label">
                    <span className="preview-all__item-drag">⠿</span>
                    <span className="preview-all__item-num">{idx + 1}</span>
                    <span className="preview-all__item-name">{item.label || item.name}</span>
                    {!item.referenceImg && <span className="preview-all__item-empty">sin imagen</span>}
                  </div>
                  {item.referenceImg
                    ? <img className="preview-all__img" src={item.referenceImg} alt={item.label || item.name} />
                    : <div className="preview-all__placeholder" />
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="history-overlay" onMouseDown={e => e.target === e.currentTarget && setShowHistory(false)}>
          <div className="history-panel">
            <div className="history-panel__head">
              <span className="history-panel__title">Historial</span>
              <button className="history-panel__close" onClick={() => setShowHistory(false)}>✕</button>
            </div>

            <div className="history-panel__tabs">
              <div className="history-panel__tabs-group">
                <button
                  className={`history-panel__tab${historyTab === 'eliminados' ? ' history-panel__tab--active' : ''}`}
                  onClick={() => setHistoryTab('eliminados')}
                >
                  Eliminados{deletedItems.length > 0 ? ` (${deletedItems.length})` : ''}
                </button>
                <button
                  className={`history-panel__tab${historyTab === 'versiones' ? ' history-panel__tab--active' : ''}`}
                  onClick={() => setHistoryTab('versiones')}
                >
                  Versiones anteriores
                </button>
                <button
                  className={`history-panel__tab${historyTab === 'registro' ? ' history-panel__tab--active' : ''}`}
                  onClick={() => setHistoryTab('registro')}
                >
                  Registro de cambios
                </button>
              </div>
              {(historyTab === 'versiones' || historyTab === 'registro') && currentProjectId && versions.length > 0 && (
                <button
                  type="button"
                  className="history-panel__clear"
                  onClick={handleClearVersionHistory}
                  disabled={clearingHistory}
                  title="Borrar todas las versiones guardadas de este proyecto (no afecta los componentes actuales)"
                >
                  {clearingHistory ? 'Borrando...' : '🗑 Limpiar registro'}
                </button>
              )}
            </div>

            {historyTab === 'eliminados' && (
              deletedItems.length === 0 ? (
                <div className="history-panel__empty">No eliminaste ningún componente todavía.</div>
              ) : (
                <ul className="history-panel__list">
                  {deletedItems.map(item => (
                    <li key={item.instanceId} className="history-panel__item">
                      <div className="history-panel__item-info">
                        <span className="history-panel__item-name">{item.label || item.name}</span>
                        <span className="history-panel__item-date">Eliminado el {formatDeletedAt(item.deletedAt)}</span>
                      </div>
                      <button className="btn-primary history-panel__restore" onClick={() => restoreDeletedItem(item.instanceId)}>
                        ↺ Restaurar
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}

            {historyTab === 'versiones' && (
              !currentProjectId ? (
                <div className="history-panel__empty">Guardá el proyecto al menos una vez para empezar a ver versiones anteriores.</div>
              ) : loadingVersions ? (
                <div className="history-panel__empty">Cargando versiones...</div>
              ) : versions.length === 0 ? (
                <div className="history-panel__empty">Todavía no hay versiones guardadas de este proyecto.</div>
              ) : (
                <ul className="history-panel__list">
                  {versions.map(version => (
                    <li key={version.id} className="history-panel__item">
                      <div className="history-panel__item-info">
                        <span className="history-panel__item-name">{formatDeletedAt(version.savedAt)}</span>
                        <span className="history-panel__item-date">
                          {(version.canvas || []).length} componente{(version.canvas || []).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <button className="btn-primary history-panel__restore" onClick={() => restoreVersion(version)}>
                        ↺ Restaurar
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}

            {historyTab === 'registro' && (
              !currentProjectId ? (
                <div className="history-panel__empty">Guardá el proyecto al menos una vez para empezar a ver el registro de cambios.</div>
              ) : loadingVersions ? (
                <div className="history-panel__empty">Cargando registro...</div>
              ) : changeLog.length === 0 ? (
                <div className="history-panel__empty">Todavía no hay cambios registrados.</div>
              ) : (
                <ul className="changelog-list">
                  {changeLog.map((entry, i) => (
                    <li key={i} className="changelog-entry">
                      <div className="changelog-entry__date">{formatDeletedAt(entry.savedAt)}</div>
                      <ul className="changelog-entry__changes">
                        {entry.changes.map((c, j) => (
                          <li key={j} className="changelog-change">
                            {c.type === 'created' && (
                              <>Primera versión registrada — {c.count} componente{c.count !== 1 ? 's' : ''}</>
                            )}
                            {c.type === 'added' && (
                              <><strong>{c.component}</strong> — componente agregado</>
                            )}
                            {c.type === 'removed' && (
                              <><strong>{c.component}</strong> — componente quitado</>
                            )}
                            {c.type === 'row-added' && (
                              <><strong>{c.component}</strong> — fila {c.row} agregada</>
                            )}
                            {c.type === 'field' && (
                              <>
                                <strong>{c.component}</strong>
                                {c.row ? ` — fila ${c.row}` : ''} — {c.field}: <span className="changelog-change__from">{c.from}</span> → <span className="changelog-change__to">{c.to}</span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </div>
      )}

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
