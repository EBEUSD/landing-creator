import { useState, useEffect } from 'react'

const PROXY       = (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
const VTEX_SEARCH = 'https://www.perfumeriasrouge.com/api/catalog_system/pub/products/search'
const VTEX_BRANDS = 'https://www.perfumeriasrouge.com/api/catalog_system/pub/brand/list'

const CATEGORY_KEYS = [
  { key: 'perfumes',   label: 'Perfumes',   catId: 100 },
  { key: 'maquillaje', label: 'Maquillaje', catId: 105 },
]

const SORTS = [
  { id: 'OrderByTopSaleDESC',      label: 'Más vendidos'    },
  { id: 'OrderByBestDiscountDESC', label: 'Mayor descuento' },
]

function buildUrl(brandId, catId, sort, to = 4) {
  return PROXY(`${VTEX_SEARCH}?fq=B:${brandId}&fq=C:${catId}&O=${sort}&_from=0&_to=${to}`)
}

export default function SKUSearchModal({ onClose, onAdd }) {
  const [query, setQuery]             = useState('')
  const [categoryKey, setCategoryKey] = useState('perfumes')
  const [sort, setSort]               = useState('OrderByTopSaleDESC')
  const [brands, setBrands]           = useState([])
  const [skus, setSkus]               = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [selected, setSelected]       = useState(new Set())

  useEffect(() => {
    fetch(PROXY(VTEX_BRANDS), { headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then(data => setBrands(data.filter(b => b.isActive)))
      .catch(() => {})
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    const match = brands.find(b => b.name.toLowerCase().includes(q.toLowerCase()))
    const cat   = CATEGORY_KEYS.find(c => c.key === categoryKey)

    setLoading(true)
    setError(null)
    setSkus(null)
    setSelected(new Set())

    const ftUrl = PROXY(`${VTEX_SEARCH}?ft=${encodeURIComponent(q)}&fq=C:${cat.catId}&O=${sort}&_from=0&_to=4`)

    try {
      let res
      if (match) {
        res = await fetch(buildUrl(match.id, cat.catId, sort, 4), { headers: { Accept: 'application/json' } })
        if (res.status === 413) res = await fetch(ftUrl, { headers: { Accept: 'application/json' } })
      } else {
        res = await fetch(ftUrl, { headers: { Accept: 'application/json' } })
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const products = await res.json()
      const flat = products.flatMap(p =>
        p.items.map(item => ({
          itemId:   item.itemId,
          refId:    item.referenceId?.[0]?.Value ?? item.itemId,
          name:     item.nameComplete || p.productName,
          imageUrl: item.images?.[0]?.imageUrl ?? null,
        }))
      )
      setSkus(flat)
      if (flat.length === 0) setError(`Sin resultados para "${q}" en ${cat.label}.`)
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'Sin conexión con Rouge. Puede que la API no permita acceso externo (CORS).'
          : `Error: ${err.message}`
      )
    } finally {
      setLoading(false)
    }
  }

  const toggle = (refId) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(refId) ? next.delete(refId) : next.add(refId)
      return next
    })

  const handleAdd = () => {
    onAdd([...selected])
    onClose()
  }

  return (
    <div className="sku-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sku-modal">
        <div className="sku-modal__head">
          <span className="sku-modal__title">Buscar SKUs · Rouge</span>
          <button className="sku-modal__close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="sku-modal__filters">
          <div className="sku-pills">
            {CATEGORY_KEYS.map(c => (
              <button
                key={c.key}
                type="button"
                className={`sku-pill${categoryKey === c.key ? ' sku-pill--on' : ''}`}
                onClick={() => setCategoryKey(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="sku-pills sku-pills--right">
            {SORTS.map(s => (
              <button
                key={s.id}
                type="button"
                className={`sku-pill${sort === s.id ? ' sku-pill--on' : ''}`}
                onClick={() => setSort(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <form className="sku-modal__search-row" onSubmit={handleSearch}>
          <input
            className="sku-modal__query"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Marca, ej: Versace, Lancôme…"
            autoFocus
            spellCheck={false}
          />
          <button
            className="btn-primary"
            type="submit"
            disabled={loading || !query.trim()}
          >
            {loading ? '…' : 'Buscar'}
          </button>
        </form>

        <div className="sku-modal__body">
          {error && <p className="sku-modal__msg sku-modal__msg--error">{error}</p>}

          {skus && skus.length > 0 && (
            <ul className="sku-list">
              {skus.map(sku => (
                <li
                  key={sku.itemId}
                  className={`sku-list__item${selected.has(sku.refId) ? ' sku-list__item--on' : ''}`}
                  onClick={() => toggle(sku.refId)}
                >
                  {sku.imageUrl
                    ? <img className="sku-list__img" src={sku.imageUrl} alt={sku.name} />
                    : <div className="sku-list__img sku-list__img--empty" />
                  }
                  <div className="sku-list__info">
                    <span className="sku-list__name">{sku.name}</span>
                    <span className="sku-list__id">{sku.refId}</span>
                  </div>
                  <span className="sku-list__check">✓</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected.size > 0 && (
          <div className="sku-modal__foot">
            <button className="btn-primary" onClick={handleAdd} type="button">
              Agregar {selected.size} SKU{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
