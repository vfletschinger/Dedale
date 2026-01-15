
// GeoJSON type for local use
interface GeoJSONObject {
  type: string
  geometry?: {
    type: string
    coordinates: number[] | number[][] | number[][][]
  }
  properties?: Record<string, unknown>
  features?: GeoJSONObject[]
  coordinates?: number[] | number[][] | number[][][]
}

// Fonction pour convertir GeoJSON en WKT
export function geoJSONtoWKT(geometry: GeoJSON.Geometry): string {
  if (geometry.type === "Polygon") {
    const coords = geometry.coordinates[0]
      .map(([x, y]) => `${x} ${y}`)
      .join(", ");
    return `POLYGON((${coords}))`;
  }
  if (geometry.type === "LineString") {
    const coords = geometry.coordinates.map(([x, y]) => `${x} ${y}`).join(", ");
    return `LINESTRING(${coords})`;
  }
  if (geometry.type === "Point") {
    const [x, y] = geometry.coordinates;
    return `POINT(${x} ${y})`;
  }
  throw new Error(`Type de géométrie non supporté: ${geometry.type}`);
}

// Fonction pour parser WKT et convertir en GeoJSON
export function parseWKTtoGeoJSON(wkt: string): GeoJSON.Geometry | null {
  try {
    const wktTrimmed = wkt.trim().toUpperCase();

    // POINT(x y)
    if (wktTrimmed.startsWith("POINT")) {
      const match = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (match) {
        return {
          type: "Point",
          coordinates: [parseFloat(match[1]), parseFloat(match[2])],
        };
      }
    }

    // LINESTRING(x1 y1, x2 y2, ...)
    if (wktTrimmed.startsWith("LINESTRING")) {
      const match = wkt.match(/LINESTRING\s*\(\s*(.+)\s*\)/i);
      if (match) {
        const coords = match[1].split(",").map((pair) => {
          const [x, y] = pair.trim().split(/\s+/);
          return [parseFloat(x), parseFloat(y)];
        });
        return {
          type: "LineString",
          coordinates: coords,
        };
      }
    }

    // POLYGON((x1 y1, x2 y2, ...))
    if (wktTrimmed.startsWith("POLYGON")) {
      const match = wkt.match(/POLYGON\s*\(\s*\(\s*(.+)\s*\)\s*\)/i);
      if (match) {
        const coords = match[1].split(",").map((pair) => {
          const [x, y] = pair.trim().split(/\s+/);
          return [parseFloat(x), parseFloat(y)];
        });
        return {
          type: "Polygon",
          coordinates: [coords],
        };
      }
    }

    console.warn("WKT non reconnu:", wkt);
    return null;
  } catch (err) {
    console.error("Erreur parsing WKT:", err, wkt);
    return null;
  }
}

// Helper pour formater une date courte
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format distance in a human-readable format
 * @param distance Distance in meters
 * @returns Formatted distance string
 */
export function formatDistance(distance: number): string {
  if (distance < 0) return '0 m'
  if (distance < 1000) return `${Math.round(distance)} m`
  return `${(distance / 1000).toFixed(1)} km`
}

/**
 * Format duration in a human-readable format
 * @param seconds Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number): string {
  if (seconds === 0) return '0 seconds'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  const parts = []
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`)
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs} second${secs !== 1 ? 's' : ''}`)
  
  return parts.join(' ')
}

interface Coordinates {
  latitude: number
  longitude: number
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param point1 First point
 * @param point2 Second point
 * @returns Distance in meters
 */
export function calculateDistance(point1: Coordinates, point2: Coordinates): number {
  // Validate coordinates
  if (!validateCoordinates(point1.latitude, point1.longitude) || 
      !validateCoordinates(point2.latitude, point2.longitude)) {
    throw new Error('Invalid coordinates')
  }
  
  const R = 6371000 // Earth's radius in meters
  const φ1 = (point1.latitude * Math.PI) / 180
  const φ2 = (point2.latitude * Math.PI) / 180
  const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180
  const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Calculate bearing from point1 to point2
 * @param point1 Starting point
 * @param point2 Destination point
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(point1: Coordinates, point2: Coordinates): number {
  if (point1.latitude === point2.latitude && point1.longitude === point2.longitude) {
    return 0
  }
  
  const φ1 = (point1.latitude * Math.PI) / 180
  const φ2 = (point2.latitude * Math.PI) / 180
  const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  
  const θ = Math.atan2(y, x)
  const bearing = ((θ * 180) / Math.PI + 360) % 360

  return bearing
}

/**
 * Format coordinates to string
 * @param latitude Latitude
 * @param longitude Longitude
 * @param precision Precision or format type ('DMS' for degrees, minutes, seconds)
 * @returns Formatted coordinate string
 */
export function formatCoordinates(latitude: number, longitude: number, precision: number | 'DMS' = 4): string {
  if (precision === 'DMS') {
    return formatDMS(latitude, longitude)
  }
  
  const latDir = latitude >= 0 ? 'N' : 'S'
  const lonDir = longitude >= 0 ? 'E' : 'W'
  const lat = Math.abs(latitude).toFixed(precision)
  const lon = Math.abs(longitude).toFixed(precision)
  
  return `${lat}°${latDir}, ${lon}°${lonDir}`
}

function formatDMS(latitude: number, longitude: number): string {
  const latDMS = toDMS(Math.abs(latitude))
  const lonDMS = toDMS(Math.abs(longitude))
  const latDir = latitude >= 0 ? 'N' : 'S'
  const lonDir = longitude >= 0 ? 'E' : 'W'
  
  return `${latDMS}${latDir}, ${lonDMS}${lonDir}`
}

function toDMS(decimal: number): string {
  const degrees = Math.floor(decimal)
  const minutesDecimal = (decimal - degrees) * 60
  const minutes = Math.floor(minutesDecimal)
  const seconds = ((minutesDecimal - minutes) * 60).toFixed(0)
  
  return `${degrees}°${minutes}'${seconds}"`
}

/**
 * Validate if coordinates are within valid ranges
 * @param latitude Latitude to validate
 * @param longitude Longitude to validate
 * @returns true if coordinates are valid
 */
export function validateCoordinates(latitude: unknown, longitude: unknown): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false
  }
  if (isNaN(latitude) || isNaN(longitude)) {
    return false
  }
  if (latitude < -90 || latitude > 90) {
    return false
  }
  if (longitude < -180 || longitude > 180) {
    return false
  }
  return true
}

/**
 * Parse GeoJSON string
 * @param geoJSON GeoJSON string
 * @returns Parsed GeoJSON object
 */
export function parseGeoJSON(geoJSON: string): GeoJSONObject {
  try {
    const parsed = JSON.parse(geoJSON) as GeoJSONObject
    
    // Validate basic GeoJSON structure
    if (!parsed.type) {
      throw new Error('Invalid GeoJSON: missing type')
    }
    
    if (parsed.type === 'FeatureCollection' && !parsed.features) {
      throw new Error('Invalid GeoJSON: FeatureCollection missing features')
    }
    
    if (!['FeatureCollection', 'Feature', 'Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection'].includes(parsed.type)) {
      throw new Error('Invalid GeoJSON type')
    }
    
    return parsed
  } catch (error) {
    throw new Error(`Failed to parse GeoJSON: ${error}`)
  }
}

/**
 * Generate GeoJSON from coordinates
 * @param coordinates Array of [longitude, latitude] pairs
 * @param properties Optional properties
 * @returns GeoJSON object
 */
export function generateGeoJSON(coordinates: number[][], properties: Record<string, unknown> = {}): GeoJSONObject {
  if (!coordinates || coordinates.length === 0) {
    throw new Error('Coordinates array cannot be empty')
  }
  
  // Single point
  if (coordinates.length === 1) {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coordinates[0]
      },
      properties
    }
  }
  
  // Line
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates
    },
    properties
  }
}

interface Event {
  id: string
  name: string
  start_date: string
  end_date: string
  statut: string
  [key: string]: unknown
}

/**
 * Normalize event data
 * @param event Event data
 * @returns Normalized event
 */
export function normalizeEventData(event: Record<string, unknown>): Event {
  return {
    id: (event.id as string) || (event._id as string) || '',
    name: (event.name as string) || (event.title as string) || '',
    start_date: (event.start_date as string) || (event.startDate as string) || '',
    end_date: (event.end_date as string) || (event.endDate as string) || '',
    statut: (event.statut as string) || (event.status as string) || 'pending',
    ...event
  }
}

/**
 * Validate event data
 * @param event Event data to validate
 * @returns true if event is valid
 */
export function validateEventData(event: unknown): boolean {
  if (!event) return false
  if (typeof event !== 'object') return false
  const e = event as Record<string, unknown>
  if (!e.name || typeof e.name !== 'string') return false
  if (!e.start_date || typeof e.start_date !== 'string') return false
  if (!e.end_date || typeof e.end_date !== 'string') return false
  
  // Validate dates
  const startDate = new Date(e.start_date)
  const endDate = new Date(e.end_date)
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return false
  }
  
  if (endDate < startDate) {
    return false
  }
  
  return true
}

/**
 * Sort events by date
 * @param events Array of events
 * @param order 'asc' or 'desc'
 * @returns Sorted events
 */
export function sortEventsByDate(events: Event[], order: 'asc' | 'desc' = 'asc'): Event[] {
  return [...events].sort((a, b) => {
    const dateA = new Date(a.start_date).getTime()
    const dateB = new Date(b.start_date).getTime()
    return order === 'asc' ? dateA - dateB : dateB - dateA
  })
}

/**
 * Filter events by status
 * @param events Array of events
 * @param status Status to filter by
 * @returns Filtered events
 */
export function filterEventsByStatus(events: Event[], status: string): Event[] {
  return events.filter(event => event.statut === status)
}

/**
 * Search events by query
 * @param events Array of events
 * @param query Search query
 * @returns Filtered events matching query
 */
export function searchEvents(events: Event[], query: string): Event[] {
  if (!query || query.trim() === '') return events
  
  const lowerQuery = query.toLowerCase().trim()
  
  return events.filter(event => {
    return (
      event.name.toLowerCase().includes(lowerQuery) ||
      event.statut.toLowerCase().includes(lowerQuery) ||
      event.id.toLowerCase().includes(lowerQuery)
    )
  })
}
