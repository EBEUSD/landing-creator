// Repara los proyectos que quedaron con componentes/imagenes "pisados" entre si
// por el bug de "Duplicar proyecto" (no regeneraba instanceId/rowId, y las
// imagenes se guardan en Storage usando solo esos ids, sin tienda ni proyecto
// en la ruta). Para cada grupo de proyectos duplicados entre si, deja UNO
// intacto (el original) y a los demas les regenera los ids + copia las
// imagenes a rutas nuevas, para que de aca en mas sean totalmente independientes.
//
// Como correrlo (desde la raiz del proyecto, donde esta node_modules/firebase):
//   node scripts/fix-duplicate-ids.mjs
//
// Es seguro re-ejecutarlo: si algun proyecto fue editado por otra persona
// mientras corria, esa parte puntual falla con SAVE_CONFLICT y no pisa nada;
// se puede volver a correr despues sin problema (los que ya se arreglaron no
// se vuelven a tocar porque sus ids ya no colisionan con el "keep").

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, collection, runTransaction } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDg-tAXB345gmiOl-uPiTdf3P3lrUJURoo',
  authDomain: 'landing-creator-469a5.firebaseapp.com',
  projectId: 'landing-creator-469a5',
  storageBucket: 'landing-creator-469a5.firebasestorage.app',
  messagingSenderId: '199423614351',
  appId: '1:199423614351:web:9d0caaea8aca7f588cfffa',
}
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const BUCKET = 'landing-creator-469a5.firebasestorage.app'

const GROUPS = [
  { name: 'MADRES', keep: ['rouge', 'eb4c0432-c9dc-43b5-b411-11dbed3fdc69'], fix: [['beauty24', '4c73099e-f715-44fc-8526-611cd603ea47']] },
  { name: 'BEAUTY WEEK / GLAM DAYS', keep: ['rouge', '527f8ff8-df8b-40cc-8605-a904dabd0a84'], fix: [['rouge', 'df4b7f17-a907-48ad-a64f-0dc14ef214f4'], ['beauty24', '55640602-abe2-4d52-b0c0-9a82948f97d3']] },
  { name: 'AGOSTO/SEPTIEMBRE ROUGE BEAUTE', keep: ['rouge', '6662d75b-c90b-46c6-a93e-c0de204da73c'], fix: [['rouge', '0f9c6b02-cb63-49ee-bf47-d6e77764fd90']] },
  { name: 'B24 (beauty days / AGOSTO / SEPTIEMBRE)', keep: ['beauty24', 'c23dd8ac-4c7e-4129-91e7-c784448736ee'], fix: [['beauty24', 'a70ea8b2-7ce2-4840-988f-d9ea86a2efc2'], ['beauty24', 'ba9220dd-4799-4962-8343-9676c8e1353a']] },
]

function decodeValue(v) {
  if (v == null) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('mapValue' in v) return decodeMap(v.mapValue.fields || {})
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue)
  return null
}
function decodeMap(fields) {
  const out = {}
  for (const k of Object.keys(fields)) out[k] = decodeValue(fields[k])
  return out
}

async function fetchProjectRest(store, projectId) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/landing-creator-469a5/databases/(default)/documents/stores/${store}/projects/${projectId}`)
  const doc = await res.json()
  return decodeMap(doc.fields)
}

async function copyImage(oldUrl, newPath, ext) {
  const downloadRes = await fetch(oldUrl)
  if (!downloadRes.ok) throw new Error(`No se pudo descargar ${oldUrl}: ${downloadRes.status}`)
  const bytes = Buffer.from(await downloadRes.arrayBuffer())
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg'
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(newPath)}`
  const uploadRes = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': contentType }, body: bytes })
  if (!uploadRes.ok) throw new Error(`No se pudo subir ${newPath}: ${uploadRes.status}`)
  const uploadData = await uploadRes.json()
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(newPath)}?alt=media&token=${uploadData.downloadTokens}`
}

function extOf(url) {
  const m = url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)
  return m ? m[1].toLowerCase() : 'jpg'
}

async function fixProject(store, projectId, keepIds, groupName) {
  console.log(`\n--- Arreglando [${store}] ${projectId} (${groupName}) ---`)
  const current = await fetchProjectRest(store, projectId)
  const knownSavedAt = current.savedAt
  let itemsRemapped = 0, imagesCopied = 0

  const newCanvas = []
  for (const item of current.canvas) {
    if (!keepIds.has(item.instanceId)) { newCanvas.push(item); continue }
    const newInstanceId = crypto.randomUUID()
    itemsRemapped++
    const newNotes = []
    for (const row of item.notes || []) {
      const newRowId = crypto.randomUUID()
      const newRow = { ...row, id: newRowId }
      if (row.imageDesktop) {
        const ext = extOf(row.imageDesktop)
        newRow.imageDesktop = await copyImage(row.imageDesktop, `canvas-images/${newInstanceId}/${newRowId}/desktop.${ext}`, ext)
        imagesCopied++
      }
      if (row.imageMobile) {
        const ext = extOf(row.imageMobile)
        newRow.imageMobile = await copyImage(row.imageMobile, `canvas-images/${newInstanceId}/${newRowId}/mobile.${ext}`, ext)
        imagesCopied++
      }
      newNotes.push(newRow)
    }
    newCanvas.push({ ...item, instanceId: newInstanceId, notes: newNotes })
  }

  const payload = { ...current, canvas: newCanvas, savedAt: Date.now() }
  const ref = doc(db, 'stores', store, 'projects', projectId)
  const historyRef = doc(collection(db, 'stores', store, 'projects', projectId, 'history'))
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const serverSavedAt = snap.exists() ? snap.data().savedAt : null
    if (serverSavedAt && serverSavedAt > knownSavedAt) {
      throw new Error(`SAVE_CONFLICT en ${store}/${projectId}: alguien guardo algo mas nuevo mientras se reparaba`)
    }
    tx.set(ref, payload)
    tx.set(historyRef, { savedAt: payload.savedAt, canvas: payload.canvas })
  })

  console.log(`  OK: ${itemsRemapped} componentes remapeados, ${imagesCopied} imagenes copiadas. Nuevo savedAt: ${payload.savedAt}`)
  return { itemsRemapped, imagesCopied }
}

let totalItems = 0, totalImages = 0
const failures = []

for (const group of GROUPS) {
  console.log(`\n========== GRUPO: ${group.name} ==========`)
  const [keepStore, keepId] = group.keep
  const keepData = await fetchProjectRest(keepStore, keepId)
  const keepIds = new Set(keepData.canvas.map(i => i.instanceId))
  console.log(`KEEP: [${keepStore}] "${keepData.name}" -> sin tocar`)

  for (const [fixStore, fixId] of group.fix) {
    try {
      const result = await fixProject(fixStore, fixId, keepIds, group.name)
      totalItems += result.itemsRemapped
      totalImages += result.imagesCopied
    } catch (err) {
      console.error(`  FALLO en [${fixStore}] ${fixId}:`, err.message)
      failures.push({ store: fixStore, projectId: fixId, error: err.message })
    }
  }
}

console.log('\n========== RESUMEN FINAL ==========')
console.log('Total componentes remapeados:', totalItems)
console.log('Total imagenes copiadas:', totalImages)
console.log('Fallos:', failures.length ? JSON.stringify(failures, null, 2) : 'ninguno')
