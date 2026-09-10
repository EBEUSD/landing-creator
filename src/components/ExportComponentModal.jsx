import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase'
import { STORES } from '../stores'

function cloneCanvasItem(item) {
  return {
    ...item,
    instanceId: crypto.randomUUID(),
    notes: (item.notes || []).map(n => ({ ...n, id: crypto.randomUUID() })),
  }
}

export default function ExportComponentModal({ item, currentStoreId, onClose }) {
  const [targetStoreId, setTargetStoreId] = useState(currentStoreId)
  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [search, setSearch] = useState('')
  const [targetProjectId, setTargetProjectId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingProjects(true)
    setTargetProjectId(null)
    const q = query(collection(db, 'stores', targetStoreId, 'projects'), orderBy('savedAt', 'desc'))
    getDocs(q)
      .then(snap => {
        if (cancelled) return
        setProjects(snap.docs.map(d => d.data()))
        setLoadingProjects(false)
      })
      .catch(() => { if (!cancelled) setLoadingProjects(false) })
    return () => { cancelled = true }
  }, [targetStoreId])

  const targetStore = STORES.find(s => s.id === targetStoreId)
  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.projectCode && p.projectCode.toLowerCase().includes(search.toLowerCase()))
  )

  const handleExport = async () => {
    if (!targetProjectId || exporting) return
    setExporting(true)
    setError(false)
    try {
      const cloned = cloneCanvasItem(item)
      await updateDoc(doc(db, 'stores', targetStoreId, 'projects', targetProjectId), {
        canvas: arrayUnion(cloned),
        savedAt: Date.now(),
      })
      const targetProject = projects.find(p => p.id === targetProjectId)
      setExported({ name: targetProject?.name || 'el proyecto', storeId: targetStoreId, projectId: targetProjectId })
    } catch (err) {
      console.error('Export falló:', err)
      setError(true)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="pl-modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="pl-modal export-modal">
        <div className="pl-modal__head">
          <div className="pl-modal__head-info">
            <span className="pl-modal__store-dot" style={{ background: targetStore?.color }} />
            <h3 className="pl-modal__title">Exportar componente</h3>
          </div>
          <button className="pl-modal__close" type="button" onClick={onClose}>✕</button>
        </div>

        {exported ? (
          <div className="pl-modal__form">
            <div className="export-modal__success">
              ✓ "{item.label || item.name}" exportado a <strong>{exported.name}</strong>
            </div>
            <div className="pl-modal__actions">
              <button className="btn-ghost" onClick={onClose}>Cerrar</button>
              <a
                className="btn-primary"
                href={`/#/store/${exported.storeId}/editor?p=${exported.projectId}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir proyecto ↗
              </a>
            </div>
          </div>
        ) : (
          <div className="pl-modal__form">
            <div className="export-modal__source">
              Componente: <strong>{item.label || item.name}</strong>
              {item.variantName && item.variantName !== 'Completo' ? ` — ${item.variantName}` : ''}
            </div>

            <div className="pl-modal__field">
              <label>Tienda destino</label>
              <select value={targetStoreId} onChange={e => setTargetStoreId(e.target.value)}>
                {STORES.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="pl-modal__field">
              <label>Proyecto destino</label>
              <input
                type="text"
                className="export-modal__search"
                placeholder="Buscar proyecto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="export-modal__project-list">
                {loadingProjects ? (
                  <div className="export-modal__empty">Cargando proyectos...</div>
                ) : filtered.length === 0 ? (
                  <div className="export-modal__empty">
                    {search ? 'Sin resultados.' : `${targetStore?.name} no tiene proyectos guardados todavía.`}
                  </div>
                ) : (
                  filtered.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`export-modal__project${targetProjectId === p.id ? ' export-modal__project--active' : ''}`}
                      onClick={() => setTargetProjectId(p.id)}
                    >
                      {p.projectCode && <span className="export-modal__project-code">{p.projectCode}</span>}
                      <span className="export-modal__project-name">{p.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {error && <div className="export-modal__error">⚠ No se pudo exportar. Probá de nuevo.</div>}

            <div className="pl-modal__actions">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!targetProjectId || exporting}
                onClick={handleExport}
              >
                {exporting ? 'Exportando...' : 'Exportar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
