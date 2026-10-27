// Regenera los ids del proyecto CYBER de beauty24 (44ffeba1-...), que se
// duplicó desde CYBER de rouge con la versión publicada que todavía tenía el
// bug de "Duplicar proyecto" (copiaba instanceId/rowId tal cual, y las
// imágenes se guardan en Storage usando solo esos ids → subir una foto en uno
// pisaba la del otro).
//
// Al momento de duplicarlo ninguno de los dos proyectos tenía imágenes, así
// que no hace falta copiar archivos: solo se cambian los ids. Si para cuando
// se corre ya hay alguna imagen, el script aborta sin tocar nada.
//
// Como correrlo (desde la raiz del proyecto, donde esta node_modules/firebase):
//   node scripts/fix-b24-cyber-ids.mjs

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

const STORE_ID = 'beauty24'
const PROJECT_ID = '44ffeba1-1282-4400-b610-781c0fee4dd9'
const ORIGINAL = ['rouge', '9c7a70bc-29c1-4c6b-924f-fe7e3be58352']

const ref = doc(db, 'stores', STORE_ID, 'projects', PROJECT_ID)
const historyRef = doc(collection(db, 'stores', STORE_ID, 'projects', PROJECT_ID, 'history'))

try {
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const origSnap = await tx.get(doc(db, 'stores', ORIGINAL[0], 'projects', ORIGINAL[1]))
    if (!snap.exists()) throw new Error('No existe el proyecto de beauty24')
    const current = snap.data()
    const original = origSnap.data()

    const hasImages = (p) => (p.canvas || []).some(i => (i.notes || []).some(n => n.imageDesktop || n.imageMobile))
    if (hasImages(current) || hasImages(original)) {
      throw new Error('Ya hay imágenes cargadas: hay que copiarlas a rutas nuevas, este script no lo hace')
    }

    const originalIds = new Set((original.canvas || []).map(i => i.instanceId))
    let remapped = 0, rows = 0
    const canvas = (current.canvas || []).map(item => {
      if (!originalIds.has(item.instanceId)) return item
      remapped++
      return {
        ...item,
        instanceId: crypto.randomUUID(),
        notes: (item.notes || []).map(n => { rows++; return { ...n, id: crypto.randomUUID() } }),
      }
    })

    const payload = { ...current, canvas, savedAt: Date.now() }
    tx.set(ref, payload)
    tx.set(historyRef, { savedAt: payload.savedAt, canvas: payload.canvas })
    return { remapped, rows, total: canvas.length, savedAt: payload.savedAt }
  })
  console.log(`✅ CYBER (beauty24): ${result.remapped}/${result.total} componentes y ${result.rows} filas con ids nuevos. Nuevo savedAt: ${result.savedAt}`)
  process.exit(0)
} catch (err) {
  console.error('❌ FALLO:', err.message)
  process.exit(1)
}
