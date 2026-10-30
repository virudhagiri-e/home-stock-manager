import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearProductCache, lookupProduct, mapOpenFactsProduct } from './product-lookup.js'

vi.mock('../load-env.js', () => ({}))

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => clearProductCache())

describe('mapOpenFactsProduct', () => {
  it('maps name, first brand and package size to app units', () => {
    expect(
      mapOpenFactsProduct(
        {
          product_name: 'Nutella',
          brands: 'Ferrero, Nutella',
          product_quantity: 400,
          product_quantity_unit: 'g',
        },
        'GROCERY',
        'openfoodfacts',
      ),
    ).toEqual({
      name: 'Nutella',
      brand: 'Ferrero',
      quantity: 400,
      unit: 'GRAM',
      category: 'GROCERY',
      source: 'openfoodfacts',
    })
  })

  it('reads the size from text and converts centilitres', () => {
    expect(
      mapOpenFactsProduct({ product_name: 'Juice', quantity: '75 cl' }, 'GROCERY', 'openfoodfacts'),
    ).toMatchObject({ quantity: 750, unit: 'MILLILITER' })
    expect(
      mapOpenFactsProduct({ generic_name: 'Rice', quantity: '1,5 kg' }, 'GROCERY', 'openfoodfacts'),
    ).toMatchObject({ name: 'Rice', quantity: 1.5, unit: 'KILOGRAM' })
  })

  it('leaves unknown sizes empty and rejects nameless products', () => {
    const mapped = mapOpenFactsProduct(
      { product_name: 'Tea', quantity: '20 bags' },
      'GROCERY',
      'openfoodfacts',
    )
    expect(mapped).not.toHaveProperty('quantity')
    expect(mapOpenFactsProduct({ brands: 'Unknown' }, 'GROCERY', 'openfoodfacts')).toBeNull()
  })
})

describe('lookupProduct', () => {
  it('falls back to Open Products Facts for household products', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ status: 0 }, 404))
      .mockResolvedValueOnce(
        json({ status: 1, product: { product_name: 'Dish soap', quantity: '500 ml' } }),
      )

    await expect(lookupProduct('3017624010701', fetchMock)).resolves.toMatchObject({
      unavailable: false,
      product: {
        name: 'Dish soap',
        category: 'HOUSEHOLD',
        source: 'openproductsfacts',
        quantity: 500,
        unit: 'MILLILITER',
      },
    })
    expect(fetchMock.mock.calls[0][0]).toContain(
      'openfoodfacts.org/api/v2/product/3017624010701.json',
    )
    expect(fetchMock.mock.calls[0][1].headers['User-Agent']).toContain('HomeStockManager')
  })

  it('caches answers so repeated scans do not call the service again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ status: 1, product: { product_name: 'Nutella' } }))
    await lookupProduct('3017624010701', fetchMock)
    await lookupProduct('3017624010701', fetchMock)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache a miss caused by an outage, so it is retried later', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(json({ status: 0 }, 404))
      .mockResolvedValueOnce(json({ status: 1, product: { product_name: 'Nutella' } }))

    await expect(lookupProduct('3017624010701', fetchMock)).resolves.toEqual({
      product: null,
      unavailable: true,
    })
    await expect(lookupProduct('3017624010701', fetchMock)).resolves.toMatchObject({
      product: { name: 'Nutella' },
      unavailable: false,
    })
  })

  it('reports a definite "not found" separately from an outage', async () => {
    const notFound = vi.fn().mockResolvedValue(json({ status: 0 }, 404))
    await expect(lookupProduct('9780201379624', notFound)).resolves.toEqual({
      product: null,
      unavailable: false,
    })

    const busy = vi.fn().mockResolvedValue(json({ status_verbose: 'busy' }, 503))
    await expect(lookupProduct('5000112548167', busy)).resolves.toEqual({
      product: null,
      unavailable: true,
    })
  })
})
