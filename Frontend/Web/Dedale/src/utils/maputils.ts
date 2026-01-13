
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
