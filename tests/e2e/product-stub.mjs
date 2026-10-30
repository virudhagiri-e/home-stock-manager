// Stands in for Open Food Facts and Open Products Facts during browser tests,
// so CI never depends on (or adds load to) the real services.
import http from 'node:http'

const port = Number(process.env.PRODUCT_STUB_PORT ?? 4010)

const products = {
  // Simulates Open Food Facts and Open Products Facts both being overloaded.
  unavailable: new Set(['5000112548167']),
  off: {
    3017624010701: {
      product_name: 'Nutella',
      brands: 'Ferrero, Nutella',
      product_quantity: 400,
      product_quantity_unit: 'g',
    },
    4006381333931: { product_name: 'Organic Jeera seeds', brands: 'Pure Spice', quantity: '200 g' },
  },
  opf: {
    5901234123457: { product_name: 'Dish soap', brands: 'Sparkle', quantity: '500 ml' },
  },
}

http
  .createServer((request, response) => {
    const match = request.url?.match(/^\/(off|opf)\/api\/v2\/product\/(\d+)\.json/)
    if (match && products.unavailable.has(match[2])) {
      response.writeHead(503, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ status_verbose: 'temporarily unavailable' }))
      return
    }
    const product = match ? products[match[1]][match[2]] : undefined
    response.writeHead(product ? 200 : 404, { 'Content-Type': 'application/json' })
    response.end(
      JSON.stringify(
        product
          ? { status: 1, code: match[2], product }
          : { status: 0, status_verbose: 'product not found' },
      ),
    )
  })
  .listen(port, () => console.log(`Product stub listening on http://localhost:${port}`))
