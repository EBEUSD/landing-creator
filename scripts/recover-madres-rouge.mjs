// Restaura el proyecto MADRES de rouge (eb4c0432-c9dc-43b5-b411-11dbed3fdc69),
// que aparecio vaciado (nombre "Sin titulo", 0 componentes) sin que quedara
// ningun rastro en el historial de la app para ese cambio puntual.
//
// Usa la ultima version buena guardada en el historial: 1/10/2026 16:59 (hora
// AR), 18 componentes, con todos los links/imagenes/estados intactos.
//
// Como correrlo (desde la raiz del proyecto, donde esta node_modules/firebase):
//   node scripts/recover-madres-rouge.mjs
//
// Es seguro: si alguien volvio a guardar algo en este proyecto DESPUES de que
// se vacio (osea, hay un cambio real mas nuevo que proteger), el script lo
// detecta y aborta sin escribir nada, para no pisar ese cambio.

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

const STORE_ID = 'rouge'
const PROJECT_ID = 'eb4c0432-c9dc-43b5-b411-11dbed3fdc69'
const GOOD_HISTORY_DOC = '3goQvQt2fxiV5aQswsrW' // 1/10/2026 16:59:36 hora AR, 18 componentes

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

const histRes = await fetch(`https://firestore.googleapis.com/v1/projects/landing-creator-469a5/databases/(default)/documents/stores/${STORE_ID}/projects/${PROJECT_ID}/history/${GOOD_HISTORY_DOC}`)
const histDoc = await histRes.json()
const good = decodeMap(histDoc.fields)
console.log('Version buena encontrada, savedAt:', new Date(good.savedAt).toISOString(), '| componentes:', good.canvas.length)

const curRes = await fetch(`https://firestore.googleapis.com/v1/projects/landing-creator-469a5/databases/(default)/documents/stores/${STORE_ID}/projects/${PROJECT_ID}`)
const curDoc = await curRes.json()
const current = decodeMap(curDoc.fields)
const knownSavedAt = current.savedAt
console.log('Doc actual (vacio) savedAt:', new Date(knownSavedAt).toISOString())

const payload = {
  id: PROJECT_ID,
  name: 'MADRES',
  savedAt: Date.now(),
  canvas: good.canvas,
  deletedItems: [],
  palette: current.palette, // el historial no guarda paleta; se mantiene la actual (default rouge)
  folderLink: '',
  eventId: null,
  projectCode: '483J7',
}

const ref = doc(db, 'stores', STORE_ID, 'projects', PROJECT_ID)
const historyRef = doc(collection(db, 'stores', STORE_ID, 'projects', PROJECT_ID, 'history'))

try {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const serverSavedAt = snap.exists() ? snap.data().savedAt : null
    console.log('serverSavedAt justo antes de escribir:', serverSavedAt, '| conocido:', knownSavedAt)
    if (serverSavedAt && serverSavedAt > knownSavedAt) {
      throw new Error('SAVE_CONFLICT: alguien guardo algo mas nuevo mientras se preparaba la recuperacion')
    }
    tx.set(ref, payload)
    tx.set(historyRef, { savedAt: payload.savedAt, canvas: payload.canvas })
  })
  console.log('✅ MADRES (rouge) restaurado. Nuevo savedAt:', payload.savedAt, '| componentes:', payload.canvas.length)
} catch (err) {
  console.error('❌ FALLO:', err.message)
  process.exit(1)
}
