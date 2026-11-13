// Separa proyectos que comparten instanceId/rowId por el bug viejo de
// "Duplicar proyecto" (las imágenes se guardan en Storage solo por esos ids,
// así que subir una foto en uno pisaba la del otro).
//
// Busca solo los pares en TODAS las tiendas. En cada par deja intacto el
// proyecto más viejo y al más nuevo (la copia) le genera ids nuevos para los
// componentes/filas compartidos y le copia sus imágenes a rutas nuevas.
//
// Imágenes cuyo link ya no funciona (porque el otro proyecto subió encima y
// pisó el archivo) no se pueden recuperar: se dejan vacías en el proyecto que
// las perdió y se listan al final para volver a subirlas.
//
// Como correrlo (desde la raíz del proyecto):
//   node scripts/separar-duplicados.mjs          -> solo muestra qué haría
//   node scripts/separar-duplicados.mjs --apply  -> lo aplica
//
// Si alguien guarda uno de los proyectos mientras corre, ese proyecto se
// saltea (SAVE_CONFLICT) sin pisar nada; se puede volver a correr.

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, collection, getDocs, runTransaction } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getAuth, signInAnonymously } from 'firebase/auth'

const APPLY = process.argv.includes('--apply')
const app = initializeApp({
  apiKey: 'AIzaSyDg-tAXB345gmiOl-uPiTdf3P3lrUJURoo',
  authDomain: 'landing-creator-469a5.firebaseapp.com',
  projectId: 'landing-creator-469a5',
  storageBucket: 'landing-creator-469a5.firebasestorage.app',
})
const db = getFirestore(app)
const storage = getStorage(app)
await signInAnonymously(getAuth(app))

const STORES = ['rouge', 'beauty24', 'maison', 'mercadolibre']
const IMG = ['imageDesktop', 'imageMobile']
const t = (ms) => new Date(ms).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false })

// ── Cargar todo ─────────────────────────────────────
const projects = []
for (const s of STORES) {
  for (const d of (await getDocs(collection(db, 'stores', s, 'projects'))).docs) {
    const p = d.data()
    const hist = await getDocs(collection(db, 'stores', s, 'projects', d.id, 'history'))
    const createdAt = Math.min(p.savedAt ?? Infinity, ...hist.docs.map(h => h.data().savedAt ?? Infinity))
    projects.push({ store: s, id: d.id, name: p.name, data: p, createdAt })
  }
}
const label = (p) => `[${p.store}] "${p.name}" (${p.id.slice(0, 8)})`

const allItems = (p) => [...(p.data.canvas || []), ...(p.data.deletedItems || [])]
const owners = new Map()
for (const p of projects) for (const i of allItems(p)) {
  if (!owners.has(i.instanceId)) owners.set(i.instanceId, new Set())
  owners.get(i.instanceId).add(p)
}

// Proyectos a remapear: en cada grupo que comparte un instanceId, todos menos el más viejo.
const toFix = new Map() // project -> Set(instanceId)
for (const [iid, set] of owners) {
  if (set.size < 2) continue
  const sorted = [...set].sort((a, b) => a.createdAt - b.createdAt)
  for (const p of sorted.slice(1)) {
    if (!toFix.has(p)) toFix.set(p, new Set())
    toFix.get(p).add(iid)
  }
}

const linkWorks = async (url) => {
  try { const r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } }); return r.ok } catch { return false }
}

const extOf = (url) => (url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)?.[1] || 'jpg').toLowerCase()
const typeOf = (ext) => ({ png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext] || 'image/jpeg')

async function copyImage(url, path) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`descarga ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const ext = path.split('.').pop()
  const r = ref(storage, path)
  await uploadBytes(r, bytes, { contentType: typeOf(ext) })
  return getDownloadURL(r)
}

const reupload = [] // filas que hay que volver a subir a mano
const failures = []

// ── 1) Proyectos que se quedan con los ids: limpiar links rotos ───
const keepers = new Set(projects.filter(p => !toFix.has(p) && allItems(p).some(i => owners.get(i.instanceId).size > 1)))

async function cleanBroken(p, sharedOnly) {
  let changed = false
  const fixList = async (list, where) => {
    for (const item of list || []) {
      if (sharedOnly && owners.get(item.instanceId).size < 2) continue
      for (const row of item.notes || []) {
        for (const k of IMG) {
          if (!row[k] || await linkWorks(row[k])) continue
          reupload.push(`${label(p)} · ${item.name}${where} · ${row.titulo || 'fila ' + ((item.notes.indexOf(row)) + 1)} · ${k === 'imageDesktop' ? 'desktop' : 'mobile'}`)
          row[k] = null
          changed = true
        }
      }
    }
  }
  await fixList(p.data.canvas, '')
  await fixList(p.data.deletedItems, ' (en eliminados)')
  return changed
}

// ── 2) Copias: ids nuevos + imágenes copiadas ─────────
async function remap(p, iids) {
  const idMap = new Map()
  let images = 0
  const remapList = async (list, where) => {
    const out = []
    for (const item of list || []) {
      if (!iids.has(item.instanceId)) { out.push(item); continue }
      if (!idMap.has(item.instanceId)) idMap.set(item.instanceId, crypto.randomUUID())
      const newIid = idMap.get(item.instanceId)
      const notes = []
      for (const [idx, row] of (item.notes || []).entries()) {
        const key = item.instanceId + '|' + row.id
        if (!idMap.has(key)) idMap.set(key, crypto.randomUUID())
        const newRow = { ...row, id: idMap.get(key) }
        for (const k of IMG) {
          if (!row[k]) continue
          if (!(await linkWorks(row[k]))) {
            reupload.push(`${label(p)} · ${item.name}${where} · ${row.titulo || 'fila ' + (idx + 1)} · ${k === 'imageDesktop' ? 'desktop' : 'mobile'}`)
            newRow[k] = null
            continue
          }
          const path = `canvas-images/${newIid}/${newRow.id}/${k === 'imageDesktop' ? 'desktop' : 'mobile'}.${extOf(row[k])}`
          newRow[k] = APPLY ? await copyImage(row[k], path) : `(copiar a ${path})`
          images++
        }
        notes.push(newRow)
      }
      out.push({ ...item, instanceId: newIid, notes })
    }
    return out
  }
  p.data.canvas = await remapList(p.data.canvas, '')
  p.data.deletedItems = await remapList(p.data.deletedItems, ' (en eliminados)')
  return { items: [...idMap.keys()].filter(k => !k.includes('|')).length, images }
}

async function save(p, knownSavedAt) {
  const r = doc(db, 'stores', p.store, 'projects', p.id)
  const histRef = doc(collection(db, 'stores', p.store, 'projects', p.id, 'history'))
  const payload = { ...p.data, savedAt: Date.now() }
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(r)
    if (snap.data()?.savedAt !== knownSavedAt) throw new Error('SAVE_CONFLICT: alguien guardó mientras corría')
    tx.set(r, payload)
    tx.set(histRef, { savedAt: payload.savedAt, canvas: payload.canvas })
  })
}

console.log(APPLY ? '=== APLICANDO ===' : '=== MODO PRUEBA (no escribe nada; usar --apply) ===')
for (const [p, iids] of toFix) {
  const known = p.data.savedAt
  const others = new Set([...iids].flatMap(i => [...owners.get(i)]).filter(x => x !== p))
  console.log(`\nCOPIA ${label(p)} — comparte ${iids.size} componentes con ${[...others].map(label).join(', ')}`)
  try {
    const r = await remap(p, iids)
    console.log(`  ${r.items} componentes con ids nuevos, ${r.images} imágenes ${APPLY ? 'copiadas' : 'a copiar'}`)
    if (APPLY) { await save(p, known); console.log('  guardado OK') }
  } catch (e) { console.log('  FALLÓ:', e.message); failures.push(label(p) + ': ' + e.message) }
}
for (const p of keepers) {
  const known = p.data.savedAt
  try {
    const changed = await cleanBroken(p, true)
    console.log(`\nORIGINAL ${label(p)} — ${changed ? 'tenía imágenes pisadas (se dejan vacías)' : 'sin imágenes rotas, no se toca'}`)
    if (APPLY && changed) { await save(p, known); console.log('  guardado OK') }
  } catch (e) { console.log('  FALLÓ:', e.message); failures.push(label(p) + ': ' + e.message) }
}

console.log(`\n=== Imágenes que hay que volver a subir a mano (${reupload.length}) ===`)
for (const x of reupload) console.log('  ' + x)
console.log('\nFallos:', failures.length ? failures.join('\n  ') : 'ninguno')
process.exit(0)
