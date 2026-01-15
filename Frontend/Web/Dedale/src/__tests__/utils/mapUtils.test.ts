import { describe, it, expect } from 'vitest'
import {
  formatDistance,
  formatDuration,
  calculateDistance,
  calculateBearing,
  formatCoordinates,
  validateCoordinates,
  parseGeoJSON,
  validateEventData,
  sortEventsByDate,
  filterEventsByStatus
} from '../../utils/maputils'

describe('mapUtils', () => {
  describe('formatDistance', () => {
    it('should format distance in meters', () => {
      expect(formatDistance(150)).toBe('150 m')
      expect(formatDistance(999)).toBe('999 m')
    })

    it('should format distance in kilometers', () => {
      expect(formatDistance(1000)).toBe('1.0 km')
      expect(formatDistance(1500)).toBe('1.5 km')
      expect(formatDistance(10000)).toBe('10.0 km')
    })

    it('should handle zero distance', () => {
      expect(formatDistance(0)).toBe('0 m')
    })

    it('should handle negative distance', () => {
      expect(formatDistance(-100)).toBe('0 m')
    })

    it('should round decimal places correctly', () => {
      expect(formatDistance(1234)).toBe('1.2 km')
      expect(formatDistance(1678)).toBe('1.7 km')
    })
  })

  describe('formatDuration', () => {
    it('should format duration in seconds', () => {
      expect(formatDuration(30)).toBe('30 seconds')
      expect(formatDuration(59)).toBe('59 seconds')
    })

    it('should format duration in minutes', () => {
      expect(formatDuration(60)).toBe('1 minute')
      expect(formatDuration(120)).toBe('2 minutes')
      expect(formatDuration(90)).toBe('1 minute 30 seconds')
    })

    it('should format duration in hours', () => {
      expect(formatDuration(3600)).toBe('1 hour')
      expect(formatDuration(7200)).toBe('2 hours')
      expect(formatDuration(3660)).toBe('1 hour 1 minute')
      expect(formatDuration(3690)).toBe('1 hour 1 minute 30 seconds')
    })

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0 seconds')
    })
  })

  describe('calculateDistance', () => {
    const strasbourg = { latitude: 48.5734, longitude: 7.7521 }
    const colmar = { latitude: 48.0817, longitude: 7.3589 }

    it('should calculate distance between two points', () => {
      const distance = calculateDistance(strasbourg, colmar)
      
      // Distance should be approximately 55-65 km
      expect(distance).toBeGreaterThan(50000)
      expect(distance).toBeLessThan(65000)
    })

    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(strasbourg, strasbourg)
      
      expect(distance).toBe(0)
    })

    it('should handle coordinates at equator', () => {
      const point1 = { latitude: 0, longitude: 0 }
      const point2 = { latitude: 0, longitude: 1 }
      
      const distance = calculateDistance(point1, point2)
      
      expect(distance).toBeGreaterThan(110000) // ~111 km
      expect(distance).toBeLessThan(112000)
    })

    it('should handle coordinates near poles', () => {
      const point1 = { latitude: 89, longitude: 0 }
      const point2 = { latitude: 89, longitude: 180 }
      
      const distance = calculateDistance(point1, point2)
      
      expect(typeof distance).toBe('number')
      expect(distance).toBeGreaterThan(0)
    })

    it('should throw error for invalid coordinates', () => {
      const invalidPoint = { latitude: 200, longitude: 7.7521 }
      
      expect(() => calculateDistance(strasbourg, invalidPoint)).toThrow()
    })
  })

  describe('calculateBearing', () => {
    const strasbourg = { latitude: 48.5734, longitude: 7.7521 }
    const colmar = { latitude: 48.0817, longitude: 7.3589 }

    it('should calculate bearing between two points', () => {
      const bearing = calculateBearing(strasbourg, colmar)
      
      expect(bearing).toBeGreaterThanOrEqual(0)
      expect(bearing).toBeLessThan(360)
      expect(typeof bearing).toBe('number')
    })

    it('should calculate bearing to north', () => {
      const point1 = { latitude: 0, longitude: 0 }
      const point2 = { latitude: 1, longitude: 0 }
      
      const bearing = calculateBearing(point1, point2)
      
      expect(bearing).toBeCloseTo(0, 1) // Should be close to 0 (north)
    })

    it('should calculate bearing to east', () => {
      const point1 = { latitude: 0, longitude: 0 }
      const point2 = { latitude: 0, longitude: 1 }
      
      const bearing = calculateBearing(point1, point2)
      
      expect(bearing).toBeCloseTo(90, 1) // Should be close to 90 (east)
    })

    it('should return 0 for same coordinates', () => {
      const bearing = calculateBearing(strasbourg, strasbourg)
      
      expect(bearing).toBe(0)
    })
  })

  describe('formatCoordinates', () => {
    it('should format coordinates in decimal degrees', () => {
      const formatted = formatCoordinates(48.5734, 7.7521)
      
      expect(formatted).toBe('48.5734°N, 7.7521°E')
    })

    it('should format negative coordinates', () => {
      const formatted = formatCoordinates(-48.5734, -7.7521)
      
      expect(formatted).toBe('48.5734°S, 7.7521°W')
    })

    it('should handle zero coordinates', () => {
      const formatted = formatCoordinates(0, 0)
      
      expect(formatted).toBe('0.0000°N, 0.0000°E')
    })

    it('should format with specified precision', () => {
      const formatted = formatCoordinates(48.5734123, 7.7521456, 2)
      
      expect(formatted).toBe('48.57°N, 7.75°E')
    })

    it('should format in DMS format', () => {
      const formatted = formatCoordinates(48.5734, 7.7521, 'DMS')
      
      expect(formatted).toMatch(/°.*'.*"/)
    })
  })

  describe('validateCoordinates', () => {
    it('should validate correct coordinates', () => {
      expect(validateCoordinates(48.5734, 7.7521)).toBe(true)
      expect(validateCoordinates(0, 0)).toBe(true)
      expect(validateCoordinates(-90, -180)).toBe(true)
      expect(validateCoordinates(90, 180)).toBe(true)
    })

    it('should reject invalid latitude', () => {
      expect(validateCoordinates(91, 7.7521)).toBe(false)
      expect(validateCoordinates(-91, 7.7521)).toBe(false)
    })

    it('should reject invalid longitude', () => {
      expect(validateCoordinates(48.5734, 181)).toBe(false)
      expect(validateCoordinates(48.5734, -181)).toBe(false)
    })

    it('should reject NaN values', () => {
      expect(validateCoordinates(NaN, 7.7521)).toBe(false)
      expect(validateCoordinates(48.5734, NaN)).toBe(false)
    })

    it('should reject non-numeric values', () => {
      expect(validateCoordinates('48.5734', 7.7521)).toBe(false)
      expect(validateCoordinates(48.5734, '7.7521')).toBe(false)
    })
  })

  describe('parseGeoJSON', () => {
    const validGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [7.7521, 48.5734]
          },
          properties: {
            name: 'Test Point'
          }
        }
      ]
    }

    it('should parse valid GeoJSON', () => {
      const parsed = parseGeoJSON(JSON.stringify(validGeoJSON))
      
      expect(parsed).toEqual(validGeoJSON)
      expect(parsed.features).toHaveLength(1)
    })

    it('should throw error for invalid JSON', () => {
      expect(() => parseGeoJSON('invalid json')).toThrow()
    })

    it('should throw error for invalid GeoJSON structure', () => {
      const invalidGeoJSON = { type: 'InvalidType' }
      
      expect(() => parseGeoJSON(JSON.stringify(invalidGeoJSON))).toThrow()
    })

    it('should handle empty feature collection', () => {
      const emptyGeoJSON = {
        type: 'FeatureCollection',
        features: []
      }
      
      const parsed = parseGeoJSON(JSON.stringify(emptyGeoJSON))
      
      expect(parsed.features).toHaveLength(0)
    })
  })

  describe('validateEventData', () => {
    const validEvent = {
      name: 'Test Event',
      start_date: '2024-01-01',
      end_date: '2024-01-31',
      statut: 'actif'
    }

    it('should validate correct event data', () => {
      expect(validateEventData(validEvent)).toBe(true)
    })

    it('should reject event without name', () => {
      const invalidEvent = { ...validEvent, name: '' }
      
      expect(validateEventData(invalidEvent)).toBe(false)
    })

    it('should reject event with invalid date format', () => {
      const invalidEvent = { ...validEvent, start_date: 'invalid-date' }
      
      expect(validateEventData(invalidEvent)).toBe(false)
    })

    it('should reject event with end date before start date', () => {
      const invalidEvent = {
        ...validEvent,
        start_date: '2024-01-31',
        end_date: '2024-01-01'
      }

      expect(validateEventData(invalidEvent)).toBe(false)
    })
  })

  describe('sortEventsByDate', () => {
    // Events with all required fields (id, name, start_date, end_date, statut)
    const events = [
      { id: '1', name: 'Event C', start_date: '2024-03-01', end_date: '2024-03-15', statut: 'actif' },
      { id: '2', name: 'Event A', start_date: '2024-01-01', end_date: '2024-01-15', statut: 'actif' },
      { id: '3', name: 'Event B', start_date: '2024-02-01', end_date: '2024-02-15', statut: 'actif' }
    ]

    it('should sort events by start date ascending', () => {
      const sorted = sortEventsByDate(events, 'asc')

      expect(sorted[0].name).toBe('Event A')
      expect(sorted[1].name).toBe('Event B')
      expect(sorted[2].name).toBe('Event C')
    })

    it('should sort events by start date descending', () => {
      const sorted = sortEventsByDate(events, 'desc')
      
      expect(sorted[0].name).toBe('Event C')
      expect(sorted[1].name).toBe('Event B')
      expect(sorted[2].name).toBe('Event A')
    })

    it('should handle empty array', () => {
      const sorted = sortEventsByDate([])

      expect(sorted).toEqual([])
    })

    it('should not mutate original array', () => {
      const original = [...events]
      sortEventsByDate(events)

      expect(events).toEqual(original)
    })
  })

  describe('filterEventsByStatus', () => {
    // Events with all required fields (id, name, start_date, end_date, statut)
    const events = [
      { id: '1', name: 'Event A', start_date: '2024-01-01', end_date: '2024-01-15', statut: 'actif' },
      { id: '2', name: 'Event B', start_date: '2024-02-01', end_date: '2024-02-15', statut: 'planifie' },
      { id: '3', name: 'Event C', start_date: '2024-03-01', end_date: '2024-03-15', statut: 'actif' },
      { id: '4', name: 'Event D', start_date: '2024-04-01', end_date: '2024-04-15', statut: 'termine' }
    ]

    it('should filter events by status', () => {
      const filtered = filterEventsByStatus(events, 'actif')

      expect(filtered).toHaveLength(2)
      expect(filtered[0].name).toBe('Event A')
      expect(filtered[1].name).toBe('Event C')
    })

    it('should return empty array for non-existent status', () => {
      const filtered = filterEventsByStatus(events, 'non_existent')
      
      expect(filtered).toHaveLength(0)
    })

    it('should handle empty array', () => {
      const filtered = filterEventsByStatus([], 'actif')
      
      expect(filtered).toEqual([])
    })
  })
})