import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyDg-tAXB345gmiOl-uPiTdf3P3lrUJURoo',
  authDomain: 'landing-creator-469a5.firebaseapp.com',
  projectId: 'landing-creator-469a5',
  storageBucket: 'landing-creator-469a5.firebasestorage.app',
  messagingSenderId: '199423614351',
  appId: '1:199423614351:web:9d0caaea8aca7f588cfffa',
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const storage = getStorage(app)
