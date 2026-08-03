const { onRequest } = require('firebase-functions/v2/https')

exports.vtex = onRequest({ cors: true }, async (req, res) => {
  const url = req.query.url
  if (!url || !url.includes('perfumeriasrouge.com')) {
    return res.status(400).json({ error: 'Invalid URL' })
  }
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    const text = await r.text()
    res.set('Content-Type', 'application/json').status(r.status).send(text)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
