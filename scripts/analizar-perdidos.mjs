// SOLO LECTURA. Busca datos (links, ids de productos, títulos, etc.) que
// estuvieron en alguna versión del historial de un proyecto y que hoy faltan.
// No escribe nada en la base.
//
// Como correrlo (desde la raiz del proyecto):
//   node scripts/analizar-perdidos.mjs <projectId>
// Ejemplo:
//   node scripts/analizar-perdidos.mjs b84749ce-6eba-41a0-b117-2638c139b66f
//
// Deja además el detalle completo en scripts/out-<projectId>.json

import { writeFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyDg-tAXB345gmiOl-uPiTdf3P3lrUJURoo',
  authDomain: 'landing-creator-469a5.firebaseapp.com',
  projectId: 'landing-creator-469a5',
  storageBucket: 'landing-creator-469a5.firebasestorage.app',
  messagingSenderId: '199423614351',
  appId: '1:199423614351:web:9d0caaea8aca7f588cfffa',
}
const STORES = ['rouge', 'beauty24', 'maison', 'mercadolibre']
const SKIP = new Set(['id', 'status'])

const projectId = process.argv[2]
if (!projectId) { console.error('Falta el projectId'); process.exit(1) }

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
await signInAnonymously(getAuth(app))

const t = (ms) => new Date(ms).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false })

let storeId = null, current = null
for (const s of STORES) {
  const snap = await getDoc(doc(db, 'stores', s, 'projects', projectId))
  if (snap.exists()) { storeId = s; current = snap.data(); break }
}
if (!current) { console.error('No encontré el proyecto en ninguna tienda'); process.exit(1) }

const histSnap = await getDocs(collection(db, 'stores', storeId, 'projects', projectId, 'history'))
const history = histSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.savedAt - b.savedAt)

console.log(`Proyecto "${current.name}" [${storeId}] — último guardado ${t(current.savedAt)}, ${current.canvas.length} componentes`)
console.log(`Historial: ${history.length} versiones` + (history.length ? `, de ${t(history[0].savedAt)} a ${t(history.at(-1).savedAt)}` : ''))

// Caídas de cantidad de datos entre versiones consecutivas (pista de cuándo se perdió algo)
const filled = (c = []) => c.reduce((a, i) => a + (i.notes || []).reduce((b, n) => b + Object.entries(n).filter(([k, v]) => v && !SKIP.has(k)).length, 0), 0)
let prev = null
for (const h of history) {
  const f = filled(h.canvas)
  if (prev !== null && f < prev) console.log(`  baja de datos: ${t(h.savedAt)}  ${prev} -> ${f}  (${(h.canvas || []).length} componentes)`)
  prev = f
}

// Datos que estuvieron alguna vez y hoy faltan (por componente/fila), con la última versión que los tenía
const curItems = new Map(current.canvas.map(i => [i.instanceId, i]))
const deletedIds = new Set((current.deletedItems || []).map(i => i.instanceId))
const lost = new Map()
for (const h of history) {
  for (const item of h.canvas || []) {
    for (const row of item.notes || []) {
      for (const [k, v] of Object.entries(row)) {
        if (!v || SKIP.has(k)) continue
        const ci = curItems.get(item.instanceId)
        const cr = ci?.notes?.find(r => r.id === row.id)
        if (cr && cr[k]) continue
        lost.set(`${item.instanceId}|${row.id}|${k}`, {
          lastSeen: t(h.savedAt), historyId: h.id,
          component: item.name, instanceId: item.instanceId, rowId: row.id, field: k, value: v,
          now: !ci ? (deletedIds.has(item.instanceId) ? 'componente en eliminados' : 'componente no está') : !cr ? 'fila no está' : 'campo vacío',
        })
      }
    }
  }
}

console.log(`\nDatos que estuvieron y hoy faltan: ${lost.size}`)
for (const x of lost.values()) {
  console.log(`  ${x.lastSeen} | ${x.component} (${x.instanceId.slice(0, 8)}) fila ${x.rowId.slice(0, 8)} | ${x.field} = ${String(x.value).slice(0, 90)} | ahora: ${x.now}`)
}

const out = `scripts/out-${projectId}.json`
writeFileSync(out, JSON.stringify({ storeId, projectId, name: current.name, lost: [...lost.values()] }, null, 2))
console.log(`\nDetalle completo en ${out}`)
process.exit(0)
