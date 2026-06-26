export const STORES = [
  { id: 'rouge',         name: 'Rouge',          color: '#e11d48', textColor: '#fff' },
  { id: 'beauty24',      name: 'Beauty24',        color: '#0ea5e9', textColor: '#fff' },
  { id: 'maison',        name: 'Maison',          color: '#92400e', textColor: '#fff' },
  { id: 'mercadolibre',  name: 'Mercado Libre',   color: '#eab308', textColor: '#1a1a1a' },
]

export function storageKey(storeId) {
  return `landing-creator-projects-${storeId}`
}

export function draftKey(storeId) {
  return `landing-creator-draft-${storeId}`
}
