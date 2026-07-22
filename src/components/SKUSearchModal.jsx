import { useState, useEffect } from 'react'

const PROXY = import.meta.env.DEV
  ? (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
  : (url) => `/api/vtex?url=${encodeURIComponent(url)}`
const VTEX_SEARCH = 'https://www.perfumeriasrouge.com/api/catalog_system/pub/products/search'
const VTEX_FACETS = 'https://www.perfumeriasrouge.com/api/catalog_system/pub/facets/search'
const VTEX_BRANDS = 'https://www.perfumeriasrouge.com/api/catalog_system/pub/brand/list'

const proxiedFetch = (url, opts) => fetch(PROXY(url), opts)

const PAGE_SIZE = 15

const CATEGORY_KEYS = [
  { key: 'perfumes',   label: 'Perfumes',   catId: 100, slug: 'perfumes-y-fragancias', hasGender: true },
  { key: 'maquillaje', label: 'Maquillaje', catId: 105, slug: 'maquillaje' },
]

function toSlug(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-')
}

const SORTS = [
  { id: 'OrderByTopSaleDESC',      label: 'Más vendidos'    },
  { id: 'OrderByBestDiscountDESC', label: 'Mayor descuento' },
]

function flattenProducts(raw) {
  const list = Array.isArray(raw) ? raw : (raw?.products ?? [])
  return list.flatMap(p =>
    (p.items || []).map(item => ({
      itemId:   item.itemId,
      refId:    item.referenceId?.[0]?.Value ?? item.itemId,
      name:     item.nameComplete || item.name || p.productName,
      imageUrl: item.images?.[0]?.imageUrl ?? null,
    }))
  )
}

// Descubrimos el specificationFilter ID de "Género" desde la API de facetas.
// generoSpec = { id: "194", hombre: "Hombre", mujer: "Mujer" } (o null si no carga)
async function fetchGeneroSpec() {
  try {
    const url = `${VTEX_FACETS}/perfumes-y-fragancias?map=c`
    const r   = await proxiedFetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    const data = await r.json()

    const specFilters = data?.SpecificationFilters ?? {}
    const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const key  = Object.keys(specFilters).find(k => norm(k) === 'genero')
    if (!key) return null

    const facets = specFilters[key]
    const list   = Array.isArray(facets) ? facets : Object.values(facets || {}).flat()
    if (!list.length) return null

    // Todos los facets del mismo spec comparten el mismo Map (ej. "specificationFilter_194")
    const m = (list[0]?.Map ?? '').match(/specificationFilter_(\d+)/)
    if (!m) return null

    const spec = { id: m[1] }
    for (const facet of list) {
      const n = norm(facet.Name ?? facet.Value ?? '')
      if (n === 'hombre') spec.hombre = facet.Value ?? facet.Name
      if (n === 'mujer')  spec.mujer  = facet.Value ?? facet.Name
    }
    return (spec.hombre || spec.mujer) ? spec : null
  } catch { return null }
}

export default function SKUSearchModal({ onClose, onAdd }) {
  const [query, setQuery]             = useState('')
  const [categoryKey, setCategoryKey] = useState('perfumes')
  const [gender, setGender]           = useState(null) // null | 'hombre' | 'mujer'
  const [sort, setSort]               = useState('OrderByTopSaleDESC')
  const [brands, setBrands]           = useState([])
  const [generoSpec, setGeneroSpec]   = useState(null)
  const [skus, setSkus]               = useState(null)
  const [loading, setLoading]         = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]             = useState(null)
  const [selected, setSelected]       = useState(new Set())
  const [urlBuilder, setUrlBuilder]   = useState(null)
  const [hasMore, setHasMore]         = useState(false)
  const [offset, setOffset]           = useState(0)

  useEffect(() => {
    proxiedFetch(VTEX_BRANDS, { headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then(data => setBrands(data.filter(b => b.isActive)))
      .catch(() => {})

    // Descubrir spec ID de Género al montar el componente
    fetchGeneroSpec().then(spec => { if (spec) setGeneroSpec(spec) })
  }, [])

  useEffect(() => {
    const cat = CATEGORY_KEYS.find(c => c.key === categoryKey)
    if (!cat?.hasGender) setGender(null)
  }, [categoryKey])

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
    setHasMore(false)
    setOffset(0)

    const H = { headers: { Accept: 'application/json' } }

    const tryFetch = async (url) => {
      try {
        const r = await proxiedFetch(url, H)
        if (!r.ok) return null
        const data = await r.json()
        if (Array.isArray(data) && data.length > 0) return data
        if (data?.products?.length > 0) return data.products
        return null
      } catch { return null }
    }

    try {
      let rawProducts = null
      let builder     = null

      // 1. Marca reconocida + género + spec ID descubierto
      //    → catalog search con fq=specificationFilter_ID:Valor
      if (match && gender && generoSpec?.id && generoSpec[gender]) {
        const genderValue = generoSpec[gender]
        const specBuilder = (from, to) =>
          `${VTEX_SEARCH}?fq=B:${match.id}&fq=C:${cat.catId}&fq=specificationFilter_${generoSpec.id}:${genderValue}&O=${sort}&_from=${from}&_to=${to}`
        rawProducts = await tryFetch(specBuilder(0, PAGE_SIZE - 1))
        if (rawProducts) builder = specBuilder
      }

      // 2. Marca reconocida sin género (o spec falló) → brand-ID catalog search
      if (!rawProducts && match) {
        const brandBuilder = (from, to) =>
          `${VTEX_SEARCH}?fq=B:${match.id}&fq=C:${cat.catId}&O=${sort}&_from=${from}&_to=${to}`
        rawProducts = await tryFetch(brandBuilder(0, PAGE_SIZE - 1))
        if (rawProducts) builder = brandBuilder
      }

      // 3. Sin marca reconocida → full-text (nombres de producto, marcas no listadas)
      //    Con género activo agrega keyword para acotar ("sauvage mujer")
      if (!rawProducts) {
        const ftQ = gender ? `${q} ${gender}` : q
        const ftBuilder = (from, to) =>
          `${VTEX_SEARCH}?ft=${encodeURIComponent(ftQ)}&fq=C:${cat.catId}&O=${sort}&_from=${from}&_to=${to}`
        const r = await proxiedFetch(ftBuilder(0, PAGE_SIZE - 1), H)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        rawProducts = await r.json()
        builder     = ftBuilder
      }

      const flat = flattenProducts(rawProducts)
      setSkus(flat)
      setOffset(PAGE_SIZE)
      setHasMore(flat.length === PAGE_SIZE)
      setUrlBuilder(() => builder)
      if (flat.length === 0) {
        setError(`Sin resultados para "${q}" en ${cat.label}${gender ? ` (${gender})` : ''}.`)
      }
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

  const handleLoadMore = async () => {
    if (!urlBuilder) return
    setLoadingMore(true)
    const H = { headers: { Accept: 'application/json' } }
    try {
      const url  = urlBuilder(offset, offset + PAGE_SIZE - 1)
      const r    = await proxiedFetch(url, H)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      const flat = flattenProducts(data)
      setSkus(prev => [...(prev || []), ...flat])
      setOffset(o => o + PAGE_SIZE)
      setHasMore(flat.length === PAGE_SIZE)
    } catch { }
    finally { setLoadingMore(false) }
  }

  const toggle = (refId) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(refId) ? next.delete(refId) : next.add(refId)
      return next
    })

  const handleAdd = () => { onAdd([...selected]); onClose() }

  const cat = CATEGORY_KEYS.find(c => c.key === categoryKey)

  return (
    <div className="sku-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sku-modal">
        <div className="sku-modal__head">
          <span className="sku-modal__title">Buscar SKUs · Rouge</span>
          <button className="sku-modal__close" onClick={onClose} type="button">✕</button>
        </div>

        {/* Categoría + Orden */}
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

        {/* Género — solo para categorías que lo soportan */}
        {cat?.hasGender && (
          <div className="sku-modal__filters sku-modal__filters--gender">
            <span className="sku-modal__filter-label">Género</span>
            <div className="sku-pills">
              {[
                { key: null,     label: 'Todos'  },
                { key: 'mujer',  label: 'Mujer'  },
                { key: 'hombre', label: 'Hombre' },
              ].map(g => (
                <button
                  key={String(g.key)}
                  type="button"
                  className={`sku-pill${gender === g.key ? ' sku-pill--on' : ''}`}
                  onClick={() => setGender(g.key)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {cat.hasGender && !generoSpec && (
              <span className="sku-modal__filter-hint">cargando filtros…</span>
            )}
          </div>
        )}

        <form className="sku-modal__search-row" onSubmit={handleSearch}>
          <input
            className="sku-modal__query"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Marca o producto, ej: Versace, sauvage…"
            autoFocus
            spellCheck={false}
          />
          <button className="btn-primary" type="submit" disabled={loading || !query.trim()}>
            {loading ? '…' : 'Buscar'}
          </button>
        </form>

        <div className="sku-modal__body">
          {error && <p className="sku-modal__msg sku-modal__msg--error">{error}</p>}

          {skus && skus.length > 0 && (
            <>
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

              {hasMore && (
                <div className="sku-load-more">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Cargando…' : 'Ver 15 más'}
                  </button>
                </div>
              )}
            </>
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
