import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, orderBy, onSnapshot, runTransaction } from 'firebase/firestore'
import { db } from './firebase'
import Palette from './components/Palette'
import Canvas from './components/Canvas'
import CanvasQuickNav from './components/CanvasQuickNav'
import { STORES, draftKey, backupKey } from './stores'
import { parseBulkPaletteText } from './utils/dims'
import { ROUGE_IMAGES } from './assets/rougeImages'
import { buildChangeLog, diffCanvasVersions } from './utils/historyDiff'
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
      { id: 'cards',    name: 'Cards',    layout: 'grid', cols: 5, width: 1450, height: 1250 },
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
        // Medida de "Cards" propia de Rouge (700x945) — Beauty24/Maison mantienen 1450x1250.
        { ...cat.variants[1], width: 700, height: 945, image: ROUGE_IMAGES.bannerAChicos },
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

function loadLocalBackup(storeId, projectId) {
  try {
    const data = localStorage.getItem(backupKey(storeId, projectId))
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

const MERGE_ROW_FIELDS = ['status', 'titulo', 'urlImagen', 'idProductos', 'idProductosMobile', 'skus', 'gwp', 'linkPieza', 'imageDesktop', 'imageMobile', 'desde', 'hasta']

// Combina el canvas del servidor (más al día, puede tener cambios de otra
// persona/pestaña) con un backup local: nunca pisa un valor que ya esté en el
// servidor, solo completa los huecos con lo que haya en el backup local y
// agrega filas/componentes que existan solo del lado local (salvo los que en
// el servidor figuran como eliminados a propósito).
function mergeCanvasKeepingServerData(serverCanvas, localCanvas, serverDeletedIds = new Set()) {
  const localById = new Map(localCanvas.map(item => [item.instanceId, item]))
  const merged = serverCanvas.map(serverItem => {
    const localItem = localById.get(serverItem.instanceId)
    if (!localItem) return serverItem
    const localRowsById = new Map((localItem.notes || []).map(r => [r.id, r]))
    const mergedNotes = (serverItem.notes || []).map(serverRow => {
      const localRow = localRowsById.get(serverRow.id)
      if (!localRow) return serverRow
      const next = { ...serverRow }
      for (const field of MERGE_ROW_FIELDS) {
        if (!next[field] && localRow[field]) next[field] = localRow[field]
      }
      return next
    })
    const serverRowIds = new Set((serverItem.notes || []).map(r => r.id))
    const localOnlyRows = (localItem.notes || []).filter(r => !serverRowIds.has(r.id))
    return { ...serverItem, notes: [...mergedNotes, ...localOnlyRows] }
  })
  const serverIds = new Set(serverCanvas.map(i => i.instanceId))
  const localOnlyItems = localCanvas.filter(i => !serverIds.has(i.instanceId) && !serverDeletedIds.has(i.instanceId))
  return [...merged, ...localOnlyItems]
}

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── Mezcla de 3 vías (para conflictos entre pestañas/personas) ──────────
// base   = lo que esta pestaña vio por última vez en el servidor
// local  = lo que tiene ahora esta pestaña
// server = lo que hay hoy en el servidor
// Lo que cambió esta pestaña gana; lo que no tocó se toma del servidor. Así no
// se pierde el trabajo de ninguno de los dos lados (si los dos cambiaron el
// mismo campo, queda el de esta pestaña).
function mergeValue(base, local, server) {
  return sameValue(local, base) ? server : local
}

function mergeFields(base = {}, local, server, skipKey) {
  const out = {}
  for (const k of new Set([...Object.keys(local), ...Object.keys(server)])) {
    if (k === skipKey) continue
    const v = mergeValue(base[k], local[k], server[k])
    if (v !== undefined) out[k] = v
  }
  return out
}

function mergeList(base = [], local = [], server = [], idKey, mergeOne) {
  const baseById = new Map(base.map(x => [x[idKey], x]))
  const localById = new Map(local.map(x => [x[idKey], x]))
  const serverIds = new Set(server.map(x => x[idKey]))
  const out = []
  for (const s of server) {
    const l = localById.get(s[idKey])
    const b = baseById.get(s[idKey])
    if (l) out.push(mergeOne(b, l, s))
    else if (!b || !sameValue(b, s)) out.push(s) // nuevo en el servidor, o lo borré acá pero allá lo editaron
    // si no: lo borré acá y nadie más lo tocó → queda borrado
  }
  local.forEach((l, idx) => {
    if (serverIds.has(l[idKey])) return
    const b = baseById.get(l[idKey])
    if (b && sameValue(b, l)) return // lo borraron en el servidor y acá no se tocó
    // Se inserta después del mismo vecino que tiene acá, para respetar el orden.
    let pos = 0
    for (let j = idx - 1; j >= 0; j--) {
      const k = out.findIndex(x => x[idKey] === local[j][idKey])
      if (k !== -1) { pos = k + 1; break }
    }
    out.splice(pos, 0, l)
  })
  return out
}

function mergeCanvasItem(base, local, server) {
  return {
    ...mergeFields(base, local, server, 'notes'),
    notes: mergeList(base?.notes, local.notes, server.notes, 'id', mergeFields),
  }
}

function mergeProjectThreeWay(base, local, server) {
  const canvas = mergeList(base.canvas, local.canvas, server.canvas, 'instanceId', mergeCanvasItem)
  const inCanvas = new Set(canvas.map(i => i.instanceId))
  const deletedItems = mergeList(base.deletedItems, local.deletedItems, server.deletedItems, 'instanceId', mergeValue)
    .filter(i => !inCanvas.has(i.instanceId))
  return {
    canvas,
    deletedItems,
    palette: mergeValue(base.palette, local.palette, server.palette),
    name: mergeValue(base.name, local.name, server.name),
    folderLink: mergeValue(base.folderLink, local.folderLink, server.folderLink),
    eventId: mergeValue(base.eventId, local.eventId, server.eventId),
    projectCode: mergeValue(base.projectCode, local.projectCode, server.projectCode),
  }
}

// Contenido "comparable" de un proyecto, normalizado igual que lo que guarda
// el autoguardado, para poder saber si realmente hay algo nuevo para guardar.
function projectContent(p, palette) {
  return {
    canvas: p.canvas || [],
    deletedItems: p.deletedItems || [],
    palette,
    name: (p.name || '').trim() || 'Sin título',
    folderLink: p.folderLink || '',
    eventId: p.eventId ?? null,
    projectCode: p.projectCode ?? null,
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
  const [previewVersion, setPreviewVersion] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [miniZoom, setMiniZoom] = useState(0.35)
  const [previewAll, setPreviewAll] = useState(false)
  const [previewDragFrom, setPreviewDragFrom] = useState(null)
  const [previewDragOver, setPreviewDragOver] = useState(null)

  // OJO: nunca se confía en draft?.currentProjectId. Si la URL no trae ?p=, la
  // sesión SIEMPRE arranca como proyecto nuevo (id null) aunque el borrador
  // tenga contenido de un proyecto real guardado antes en esta misma pestaña —
  // si no, el autoguardado podría pisar silenciosamente ese proyecto real sin
  // que la URL lo muestre. El id de un proyecto ya guardado solo se restaura
  // navegando con su ?p=, que sí trae los datos frescos desde Firestore.
  const [currentProjectId, setCurrentProjectId] = useState(() => urlProjectId ?? null)
  const currentProjectIdRef = useRef(urlProjectId ?? null)
  const [projectName, setProjectName] = useState(() => draft?.projectName ?? '')
  const [folderLink, setFolderLink] = useState(() => draft?.folderLink ?? '')
  const [eventId, setEventId] = useState(() => draft?.eventId ?? null)
  const [projectCode, setProjectCode] = useState(() => draft?.projectCode ?? null)
  const [loadingProject, setLoadingProject] = useState(!!urlProjectId)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [saveConflict, setSaveConflict] = useState(false)
  const [saving, setSaving] = useState(false)
  // Lo último que esta pestaña vio en el servidor: savedAt + rev (contador que
  // sube en cada guardado). Para detectar que otro guardó en el medio se
  // compara por IGUALDAD, nunca por "más nuevo": savedAt lo pone el reloj de
  // cada PC y si una tiene la hora atrasada la comparación por fecha falla.
  const lastKnownSavedAtRef = useRef(null)
  const lastKnownRevRef = useRef(null)
  // Último contenido que esta pestaña sabe que está en el servidor (al cargar
  // o al guardar). Define si hay "cambios sin guardar" y es la "base" de la
  // mezcla de 3 vías cuando hay conflicto.
  const [baseContent, setBaseContent] = useState(null)
  const [resolvingConflict, setResolvingConflict] = useState(false)
  const [localBackupPrompt, setLocalBackupPrompt] = useState(null)
  const [teams, setTeams] = useState([])
  const [showNotifyModal, setShowNotifyModal] = useState(false)

  const loadedProjectIdRef = useRef(null)

  useEffect(() => {
    if (!urlProjectId || urlProjectId === loadedProjectIdRef.current) return
    loadedProjectIdRef.current = urlProjectId
    setLoadingProject(true)
    setLocalBackupPrompt(null)
    getDoc(doc(db, 'stores', storeId, 'projects', urlProjectId))
      .then(snap => {
        if (snap.exists()) {
          const p = snap.data()
          const loadedPalette = mergePaletteWithDefaults(p.palette || defaultPalette, defaultPalette)
          setCanvas(p.canvas || [])
          setDeletedItems(p.deletedItems || [])
          setPalette(loadedPalette)
          setProjectName(p.name || '')
          setCurrentProjectId(urlProjectId)
          currentProjectIdRef.current = urlProjectId
          setFolderLink(p.folderLink || '')
          setEventId(p.eventId || null)
          setProjectCode(p.projectCode || null)
          lastKnownSavedAtRef.current = p.savedAt ?? null
          lastKnownRevRef.current = p.rev ?? null
          setBaseContent(projectContent(p, loadedPalette))

          // Si en esta PC hay un backup local de este proyecto con datos que el
          // servidor no tiene, puede ser que un guardado se haya perdido (falla
          // de red, cierre de pestaña, conflicto, etc). Se lo ofrecemos siempre,
          // sin importar la fecha: aunque alguien haya guardado después en el
          // servidor, lo que solo existe en esta PC se perdería si no se ofrece.
          const backup = loadLocalBackup(storeId, urlProjectId)
          if (backup?.canvas) {
            const serverCanvas = p.canvas || []
            const serverDeletedIds = new Set((p.deletedItems || []).map(i => i.instanceId))
            const merged = mergeCanvasKeepingServerData(serverCanvas, backup.canvas, serverDeletedIds)
            if (!sameValue(merged, serverCanvas)) setLocalBackupPrompt(backup)
          }
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

  // Este borrador es solo para un proyecto TODAVÍA NO guardado (currentProjectId
  // null) — permite recuperar lo tipeado si se recarga la página antes del
  // primer "Guardar". Una vez que el proyecto tiene id propio, vive en su doc
  // de Firestore (accesible por ?p=) y en su backup local propio más abajo;
  // seguir pisando este mismo slot por tienda ya no aporta nada y es lo que
  // antes permitía que una pestaña nueva heredara sin querer un proyecto real.
  useEffect(() => {
    if (currentProjectId) return
    localStorage.setItem(draftKey(storeId), JSON.stringify({ canvas, deletedItems, palette, projectName, folderLink, eventId, projectCode }))
  }, [canvas, deletedItems, palette, projectName, currentProjectId, folderLink, eventId, projectCode, storeId])

  // Backup local por proyecto: se guarda en la PC del usuario en cada cambio,
  // independiente del autoguardado a Firestore. Sirve como red de contención
  // si un guardado se pierde por corte de red, conflicto o cierre de pestaña.
  // Mientras el aviso de backup está pendiente NO se pisa el backup: si no, al
  // recargar la página antes de decidir se perdería lo que solo estaba acá.
  useEffect(() => {
    if (!currentProjectId || loadingProject || localBackupPrompt) return
    try {
      localStorage.setItem(backupKey(storeId, currentProjectId), JSON.stringify({
        savedAt: Date.now(), canvas, deletedItems, palette, projectName, folderLink, eventId, projectCode,
      }))
    } catch (err) {
      console.error('No se pudo guardar el backup local:', err)
    }
  }, [canvas, deletedItems, palette, projectName, folderLink, eventId, projectCode, currentProjectId, loadingProject, storeId, localBackupPrompt])

  const mergeLocalBackup = () => {
    if (!localBackupPrompt) return
    const serverDeletedIds = new Set(deletedItems.map(i => i.instanceId))
    setCanvas(prevCanvas => mergeCanvasKeepingServerData(prevCanvas, localBackupPrompt.canvas ?? [], serverDeletedIds))
    setLocalBackupPrompt(null)
  }

  const dismissLocalBackup = () => setLocalBackupPrompt(null)

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

  const restorePreviewChanges = useMemo(
    () => previewVersion ? diffCanvasVersions(canvas, previewVersion.canvas) : [],
    [previewVersion, canvas]
  )

  // Guardado manual: no hay autoguardado. "Cambios sin guardar" = lo que hay en
  // pantalla es distinto de lo último que esta pestaña sabe que está en el
  // servidor. Un proyecto nuevo (sin id) cuenta como sin guardar si tiene algo.
  const isDirty = useMemo(() => {
    if (loadingProject) return false
    if (!currentProjectId) return canvas.length > 0 || !!projectName.trim()
    if (!baseContent) return false
    return !sameValue(
      projectContent({ canvas, deletedItems, name: projectName, folderLink, eventId, projectCode }, palette),
      baseContent
    )
  }, [loadingProject, currentProjectId, baseContent, canvas, deletedItems, projectName, folderLink, eventId, projectCode, palette])

  // Aviso del navegador si se intenta cerrar/recargar/salir con cambios sin guardar.
  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

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

  // Acepta un array de notas nuevo, o una función (notesActuales => notesNuevas).
  // La función se resuelve DENTRO del setCanvas funcional, sobre el estado más
  // fresco posible — evita que una operación async (ej. subir una imagen) pise
  // ediciones más nuevas hechas mientras esa operación estaba en curso.
  const updateCanvasNotes = (instanceId, notesOrUpdater) =>
    setCanvas(prev => prev.map(item => {
      if (item.instanceId !== instanceId) return item
      const notes = typeof notesOrUpdater === 'function' ? notesOrUpdater(item.notes) : notesOrUpdater
      return { ...item, notes }
    }))

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

  const confirmRestoreVersion = () => {
    if (!previewVersion) return
    setCanvas(previewVersion.canvas || [])
    setPreviewVersion(null)
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
  const currentLocalContent = () => projectContent(
    { canvas, deletedItems, name: projectName, folderLink, eventId, projectCode },
    palette
  )

  // Guarda `content` en el servidor. No depende del estado de React para que
  // se pueda llamar justo después de combinar (cuando el estado todavía no se
  // actualizó). Devuelve true si guardó.
  const saveProject = async (content) => {
    const isFirstSave = !currentProjectIdRef.current
    const id = currentProjectIdRef.current || crypto.randomUUID()
    currentProjectIdRef.current = id
    setCurrentProjectId(id)
    loadedProjectIdRef.current = id
    const knownSavedAt = lastKnownSavedAtRef.current
    const knownRev = lastKnownRevRef.current
    const project = { id, ...content, savedAt: Date.now(), rev: (knownRev ?? 0) + 1 }
    const ref = doc(db, 'stores', storeId, 'projects', id)
    const historyRef = doc(collection(db, 'stores', storeId, 'projects', id, 'history'))

    setSaving(true)
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        // Si el servidor no tiene exactamente la versión que vimos nosotros,
        // otra pestaña/persona guardó en el medio: no la pisamos.
        if (snap.exists()) {
          const server = snap.data()
          if (server.savedAt !== knownSavedAt || (server.rev ?? null) !== knownRev) {
            throw new Error('SAVE_CONFLICT')
          }
        }
        tx.set(ref, project)
        tx.set(historyRef, { savedAt: project.savedAt, canvas: project.canvas })
      })
      pruneHistoryVersions(storeId, id)
      lastKnownSavedAtRef.current = project.savedAt
      lastKnownRevRef.current = project.rev
      setBaseContent(projectContent(project, project.palette))
      setSaveError(false)
      setSaveConflict(false)
      setSearchParams({ p: id }, { replace: true })
      // El aviso a los equipos solo al crear el proyecto, no en cada guardado.
      if (isFirstSave && teams.length > 0) {
        setShowNotifyModal(true)
      } else {
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 2000)
      }
      return true
    } catch (err) {
      if (err.message === 'SAVE_CONFLICT') {
        setSaveConflict(true)
      } else {
        console.error('No se pudo guardar:', err)
        setSaveError(true)
      }
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!projectName.trim() || saving || saveConflict) return
    const code = projectCode || generateProjectCode()
    if (!projectCode) setProjectCode(code)
    await saveProject({ ...currentLocalContent(), projectCode: code })
  }

  // Ctrl+S / Cmd+S guarda (en vez de abrir el "Guardar página" del navegador).
  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Conflicto de guardado ─────────────────────────

  const applyProjectContent = (content) => {
    setCanvas(content.canvas)
    setDeletedItems(content.deletedItems)
    setPalette(content.palette)
    setProjectName(content.name)
    setFolderLink(content.folderLink)
    setEventId(content.eventId)
    setProjectCode(content.projectCode)
  }

  const fetchServerContent = async () => {
    const snap = await getDoc(doc(db, 'stores', storeId, 'projects', currentProjectIdRef.current))
    const p = snap.data()
    const serverPalette = mergePaletteWithDefaults(p.palette || defaultPalette, defaultPalette)
    return { content: projectContent(p, serverPalette), savedAt: p.savedAt ?? null, rev: p.rev ?? null }
  }

  const adoptServerVersion = (server) => {
    setBaseContent(server.content)
    lastKnownSavedAtRef.current = server.savedAt
    lastKnownRevRef.current = server.rev
  }

  // Trae lo último del servidor, le suma lo que se hizo en esta pestaña y lo
  // guarda. Si justo otro volvió a guardar en el medio, vuelve a aparecer el
  // aviso de conflicto y se repite.
  const resolveConflictByMerging = async () => {
    setResolvingConflict(true)
    try {
      const server = await fetchServerContent()
      const base = baseContent ?? server.content
      const merged = mergeProjectThreeWay(base, currentLocalContent(), server.content)
      adoptServerVersion(server)
      applyProjectContent(merged)
      setSaveConflict(false)
      await saveProject(merged)
    } catch (err) {
      console.error('No se pudo combinar con el servidor:', err)
      alert('No se pudo combinar. Revisá la conexión y probá de nuevo — tus cambios siguen acá.')
    } finally {
      setResolvingConflict(false)
    }
  }

  const resolveConflictByDiscarding = async () => {
    if (!window.confirm('Se van a perder los cambios que hiciste en esta pestaña y se va a cargar lo que está guardado en el servidor. ¿Seguro?')) return
    setResolvingConflict(true)
    try {
      const server = await fetchServerContent()
      adoptServerVersion(server)
      applyProjectContent(server.content)
      setSaveConflict(false)
    } catch (err) {
      console.error('No se pudo cargar lo del servidor:', err)
      alert('No se pudo cargar lo del servidor. Revisá la conexión y probá de nuevo.')
    } finally {
      setResolvingConflict(false)
    }
  }

  const downloadLocalCopy = () => {
    const blob = new Blob([JSON.stringify({ projectId: currentProjectIdRef.current, storeId, exportedAt: Date.now(), ...currentLocalContent() }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `copia-${(projectName.trim() || 'proyecto').replace(/[^\w-]+/g, '_')}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  // Para salidas dentro de la app (volver al menú, "Nuevo"), que el aviso del
  // navegador (beforeunload) no cubre.
  const confirmDiscardChanges = () =>
    !isDirty || window.confirm('Tenés cambios sin guardar en este proyecto. Si salís, se pierden. ¿Salir igual?')

  const handleNew = () => {
    if (!confirmDiscardChanges()) return
    currentProjectIdRef.current = null
    loadedProjectIdRef.current = null
    lastKnownSavedAtRef.current = null
    lastKnownRevRef.current = null
    setBaseContent(null)
    setSaveConflict(false)
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
              onClick={() => confirmDiscardChanges() && navigate(`/store/${storeId}`)}
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
              <span className="app-nav__save-conflict">⚠ Sin guardar — conflicto</span>
            )}
          </div>

          <div className="app-nav__actions">
            {isDirty && !saving && (
              <span className="app-nav__dirty">
                <span className="app-nav__dirty-dot" />
                {projectName.trim() ? 'Cambios sin guardar' : 'Poné un nombre para poder guardar'}
              </span>
            )}
            <button className="btn-ghost" onClick={handleNew}>Nuevo</button>
            <button
              className={`btn-primary app-nav__save-btn${isDirty ? ' app-nav__save-btn--dirty' : ''}`}
              onClick={handleSave}
              disabled={!projectName.trim() || saving || saveConflict}
              title="Guardar (Ctrl+S)"
            >
              {saving ? 'Guardando…' : isDirty ? 'Guardar cambios' : 'Guardado ✓'}
            </button>
          </div>
        </nav>
      )}

      {localBackupPrompt && (
        <div className="local-backup-banner">
          <span>
            ⚠ En esta PC hay cambios de este proyecto que no están en el servidor
            (del {new Date(localBackupPrompt.savedAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}).
            ¿Combinarlos? Solo se van a completar los datos que falten — no se va a pisar nada de lo que ya está guardado.
          </span>
          <div className="local-backup-banner__actions">
            <button className="btn-ghost" onClick={dismissLocalBackup}>Descartar</button>
            <button className="btn-primary" onClick={mergeLocalBackup}>Combinar con lo guardado</button>
          </div>
        </div>
      )}

      {saveConflict && (
        <div className="save-conflict-overlay">
          <div className="save-conflict-modal" role="alertdialog" aria-modal="true" aria-labelledby="save-conflict-title">
            <p className="save-conflict-modal__title" id="save-conflict-title">⚠ Tus últimos cambios NO se guardaron</p>
            <p className="save-conflict-modal__text">
              Alguien más (u otra pestaña tuya) guardó cambios en este proyecto mientras lo tenías abierto.
              Para no pisar su trabajo, se frenó el guardado.
            </p>
            <p className="save-conflict-modal__text">
              <strong>Combinar</strong> trae lo último del servidor y le suma lo que hiciste acá, sin perder lo de ninguno de los dos.
              Si los dos cambiaron el mismo dato, queda el tuyo.
            </p>
            <div className="save-conflict-modal__actions">
              <button className="btn-primary" onClick={resolveConflictByMerging} disabled={resolvingConflict}>
                {resolvingConflict ? 'Combinando…' : 'Combinar mis cambios y guardar'}
              </button>
              <div className="save-conflict-modal__secondary">
                <button className="btn-ghost" onClick={downloadLocalCopy} disabled={resolvingConflict}>Descargar copia de mis cambios</button>
                <button className="btn-ghost save-conflict-modal__danger" onClick={resolveConflictByDiscarding} disabled={resolvingConflict}>Descartar mis cambios</button>
              </div>
            </div>
          </div>
        </div>
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
                      <button className="btn-primary history-panel__restore" onClick={() => setPreviewVersion(version)}>
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

      {previewVersion && (
        <div className="history-overlay" onMouseDown={e => e.target === e.currentTarget && setPreviewVersion(null)}>
          <div className="history-panel restore-preview-panel">
            <div className="history-panel__head">
              <span className="history-panel__title">Restaurar versión del {formatDeletedAt(previewVersion.savedAt)}</span>
              <button className="history-panel__close" onClick={() => setPreviewVersion(null)}>✕</button>
            </div>

            {restorePreviewChanges.length === 0 ? (
              <div className="history-panel__empty">Esta versión es idéntica al estado actual — no hay nada para restaurar.</div>
            ) : (
              <>
                <div className="restore-preview__hint">
                  Esto es lo que va a cambiar si restaurás esta versión (antes → después):
                </div>
                <ul className="changelog-list restore-preview__list">
                  <li className="changelog-entry">
                    <ul className="changelog-entry__changes">
                      {restorePreviewChanges.map((c, j) => (
                        <li key={j} className="changelog-change">
                          {c.type === 'created' && <>Primera versión registrada — {c.count} componente{c.count !== 1 ? 's' : ''}</>}
                          {c.type === 'added' && <><strong>{c.component}</strong> — se va a agregar de nuevo (existía en esa versión)</>}
                          {c.type === 'removed' && <><strong>{c.component}</strong> — se va a quitar (no existe en esa versión)</>}
                          {c.type === 'row-added' && <><strong>{c.component}</strong> — fila {c.row} se va a agregar</>}
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
                </ul>
              </>
            )}

            <div className="restore-preview__actions">
              <button className="btn-ghost" onClick={() => setPreviewVersion(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmRestoreVersion} disabled={restorePreviewChanges.length === 0}>
                ↺ Confirmar restauración
              </button>
            </div>
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
