// Compara versiones consecutivas del canvas guardadas en el historial y arma
// un registro legible de "qué se puso, dónde y cuándo" (campo por campo).

const FIELD_LABELS = {
  status: 'Estado',
  titulo: 'Título',
  urlImagen: 'URL imagen',
  idProductos: 'IDs desktop',
  idProductosMobile: 'IDs mobile',
  skus: 'SKUs',
  gwp: 'GWP',
  linkPieza: 'Link pieza',
  imageDesktop: 'Img DK',
  imageMobile: 'Img MB',
}

const STATUS_LABELS = {
  '': '—',
  'por-hacer': 'Por hacer',
  'programado': 'Programado',
  'listo-no-subido': 'Listo · no subido',
  'terminado': 'Terminado y cargado',
  'eliminar': 'Eliminar',
}

function formatFieldValue(field, value) {
  if (field === 'status') return STATUS_LABELS[value] ?? (value || '—')
  if (field === 'imageDesktop' || field === 'imageMobile') return value ? '(imagen cargada)' : '—'
  const str = (value ?? '').toString().trim()
  return str ? str : '—'
}

function itemLabel(item) {
  return item.label || item.name || 'Componente'
}

// Devuelve la lista de cambios entre dos versiones consecutivas del canvas.
export function diffCanvasVersions(prevCanvas, nextCanvas) {
  const changes = []
  const prevItems = prevCanvas || []
  const nextItems = nextCanvas || []
  const prevById = new Map(prevItems.map(i => [i.instanceId, i]))
  const nextById = new Map(nextItems.map(i => [i.instanceId, i]))

  for (const nextItem of nextItems) {
    const prevItem = prevById.get(nextItem.instanceId)
    if (!prevItem) {
      changes.push({ type: 'added', component: itemLabel(nextItem) })
      continue
    }

    if ((prevItem.label || '') !== (nextItem.label || '')) {
      changes.push({
        type: 'field', component: itemLabel(nextItem), field: 'Nombre',
        from: prevItem.label || prevItem.name || '—', to: nextItem.label || nextItem.name || '—',
      })
    }
    if ((prevItem.comment || '') !== (nextItem.comment || '')) {
      changes.push({
        type: 'field', component: itemLabel(nextItem), field: 'Comentario',
        from: prevItem.comment || '—', to: nextItem.comment || '—',
      })
    }

    const prevRowsById = new Map((prevItem.notes || []).map(r => [r.id, r]))
    const nextRows = nextItem.notes || []

    nextRows.forEach((row, idx) => {
      const prevRow = prevRowsById.get(row.id)
      if (!prevRow) {
        changes.push({ type: 'row-added', component: itemLabel(nextItem), row: idx + 1 })
        return
      }
      for (const field of Object.keys(FIELD_LABELS)) {
        const a = prevRow[field] ?? ''
        const b = row[field] ?? ''
        if (a !== b) {
          changes.push({
            type: 'field',
            component: itemLabel(nextItem),
            row: idx + 1,
            field: FIELD_LABELS[field],
            from: formatFieldValue(field, a),
            to: formatFieldValue(field, b),
          })
        }
      }
    })
  }

  for (const prevItem of prevItems) {
    if (!nextById.has(prevItem.instanceId)) {
      changes.push({ type: 'removed', component: itemLabel(prevItem) })
    }
  }

  return changes
}

// versions: array de { id, savedAt, canvas }, ordenado por savedAt DESCENDENTE
// (como lo devuelve la consulta de Firestore). Devuelve entradas más nuevas primero.
export function buildChangeLog(versions) {
  const asc = [...versions].sort((a, b) => a.savedAt - b.savedAt)
  const entries = []

  asc.forEach((version, idx) => {
    if (idx === 0) {
      entries.push({
        savedAt: version.savedAt,
        changes: [{ type: 'created', count: (version.canvas || []).length }],
      })
      return
    }
    const changes = diffCanvasVersions(asc[idx - 1].canvas, version.canvas)
    if (changes.length > 0) entries.push({ savedAt: version.savedAt, changes })
  })

  return entries.reverse()
}
