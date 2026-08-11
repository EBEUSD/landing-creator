// Formato compartido de medidas: "1920x640dk / 750x1000mb" (mobile opcional)

const DIVIDER_RE = /^[.\-–·_]{2,}$/
const PAIR_RE = /(\d+)\s*[x×]\s*(\d+)\s*(dk|mb)?/i

export function formatDims({ width, height, widthMb, heightMb } = {}) {
  if (!width || !height) return ''
  const dk = `${width}x${height}`
  if (widthMb && heightMb) return `${dk}dk / ${widthMb}x${heightMb}mb`
  return dk
}

// Acepta "1920x640dk / 750x1000mb", "1920x640 - 750x1000mb" o simplemente "1920x640"
export function parseDimsText(raw) {
  if (!raw) return null
  const groups = String(raw).split(/[/\-–]/).map(s => s.trim()).filter(Boolean)
  const readings = groups
    .map(g => {
      const m = g.match(PAIR_RE)
      if (!m) return null
      return { w: +m[1], h: +m[2], kind: m[3] ? m[3].toLowerCase() : null }
    })
    .filter(Boolean)

  if (!readings.length) return null

  const unlabeled = readings.filter(r => !r.kind)
  let dk = readings.find(r => r.kind === 'dk')
  let mb = readings.find(r => r.kind === 'mb')
  if (!dk) dk = unlabeled[0] || readings[0]
  if (!mb) mb = unlabeled.find(r => r !== dk)

  return {
    width: dk ? dk.w : null,
    height: dk ? dk.h : null,
    widthMb: mb ? mb.w : null,
    heightMb: mb ? mb.h : null,
  }
}

function extractNameAndDims(line) {
  const m = line.match(/^(.*?)\(([^)]*)\)\s*$/)
  if (!m) return { name: line, dimsRaw: null }
  return { name: m[1].trim(), dimsRaw: m[2].trim() }
}

// DSL de importación masiva:
//   Grupo:
//     Variante A (1920x640dk / 750x1000mb)
//     Variante B (700x945)
//   Item suelto (1000x480dk/400x600mb)
// Los items sin medidas se omiten. Las líneas de puntos/guiones cierran el grupo actual.
export function parseBulkPaletteText(text) {
  const lines = String(text || '').split('\n').map(l => l.trim())
  const groups = []
  let pending = null

  const flushPending = () => {
    if (pending && pending.variants.length > 0) groups.push(pending)
    pending = null
  }

  for (const line of lines) {
    if (!line) continue
    if (DIVIDER_RE.test(line)) { flushPending(); continue }

    const { name, dimsRaw } = extractNameAndDims(line)
    const dims = dimsRaw ? parseDimsText(dimsRaw) : null

    if (dims && dims.width && dims.height) {
      const variant = { name, width: dims.width, height: dims.height, widthMb: dims.widthMb, heightMb: dims.heightMb }
      if (pending) {
        pending.variants.push(variant)
      } else {
        groups.push({ name, variants: [variant] })
      }
    } else {
      const headerName = name.replace(/:+\s*$/, '').trim()
      if (!headerName) continue
      if (!pending) {
        pending = { name: headerName, variants: [] }
      } else if (pending.variants.length === 0) {
        pending.name = headerName
      }
      // si pending ya tiene variantes, esta línea sin medidas se omite sin cerrar el grupo
    }
  }
  flushPending()

  return groups
}

// Inversa de parseBulkPaletteText, para poder editar el estado actual como texto
export function serializePaletteToText(palette) {
  return palette
    .map(cat => {
      if (cat.variants.length > 1) {
        const lines = cat.variants.map(v => {
          const dims = formatDims(v)
          return dims ? `  ${v.name} (${dims})` : `  ${v.name}`
        })
        return `${cat.name}:\n${lines.join('\n')}`
      }
      const dims = formatDims(cat.variants[0])
      return dims ? `${cat.name} (${dims})` : cat.name
    })
    .join('\n\n')
}
