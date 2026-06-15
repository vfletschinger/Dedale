import { describe, it, expect } from 'vitest'
import { getMapStyle } from '../../utils/mapStyles'

describe('mapStyles', () => {
  it('uses the provided PMTiles URL', () => {
    const style = getMapStyle('file:///tmp/strasbourg.pmtiles')

    expect(style.sources).toHaveProperty('raster-tiles')
    const source = style.sources['raster-tiles'] as { url: string; type: string }

    expect(source.type).toBe('raster')
    expect(source.url).toBe('pmtiles://file:///tmp/strasbourg.pmtiles')
  })

  it('defaults to the local PMTiles path when none is provided', () => {
    const style = getMapStyle()
    const source = style.sources['raster-tiles'] as { url: string }

    expect(source.url).toBe('pmtiles:///eurometropole_strasbourg.pmtiles')
  })

  it('includes the raster layer', () => {
    const style = getMapStyle('asset://tiles.pmtiles')
    const layerIds = style.layers?.map((layer) => layer.id) || []

    expect(layerIds).toContain('raster-layer')
  })
})
