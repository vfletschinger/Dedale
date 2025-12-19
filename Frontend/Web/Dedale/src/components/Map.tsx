import { useRef, useEffect, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import PointDetails, { type Point } from "./PointDetails";
import AddPointForm from "./AddPointForm";

// Date initiale pour le calcul de la timeline (stable pour éviter les re-renders)
const INITIAL_NOW = Date.now();

// Fonction pour convertir GeoJSON en WKT
function geoJSONtoWKT(geometry: GeoJSON.Geometry): string {
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

// Type pour les géométries de la DB
interface GeometryData {
  id: number;
  event_id: number;
  geom: string;
}

// Type pour les obstacles
interface Obstacle {
  id?: number;
  name?: string;
  number?: number;
  description?: string;
  width?: number;
  length?: number;
}

// Type pour les points de la carte
interface MapPoint {
  id: number;
  x: number;
  y: number;
  pose?: string | null;
  depose?: string | null;
  obstacles?: Obstacle[];
  comments?: { id: number; value: string }[];
  pictures?: { id: number; image: string }[];
}

// Type pour les événements
interface MapEvent {
  id: number;
  name?: string;
  event_type?: string;
  status?: string;
  statut?: string;
}

// Type pour les résultats de recherche Nominatim
interface SearchResult {
  lon: string;
  lat: string;
  display_name: string;
}

// Fonction pour parser WKT et convertir en GeoJSON
function parseWKTtoGeoJSON(wkt: string): GeoJSON.Geometry | null {
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
function formatDateShort(dateStr: string | null | undefined): string {
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

// Composant Frise Chronologique personnalisée
function TimelinePanel({
  points,
  onPointClick,
}: {
  points: MapPoint[];
  onPointClick: (point: MapPoint) => void;
}) {
  const [obstacleFilter, setObstacleFilter] = useState<string>("all");
  const containerRef = useRef<HTMLDivElement>(null);

  // Extraire tous les types d'obstacles uniques des points (obstacles sont des objets avec name)
  const obstacleTypes = useMemo(() => {
    const types = new Set<string>();
    points.forEach((p) => {
      if (p.obstacles && Array.isArray(p.obstacles)) {
        p.obstacles.forEach((obs: Obstacle) => {
          // Les obstacles sont des objets avec une propriété 'name'
          const obsName = obs?.name;
          if (obsName) types.add(obsName);
        });
      }
    });
    return Array.from(types).sort();
  }, [points]);

  // Helper pour vérifier si un point contient un type d'obstacle
  const pointHasObstacle = (point: MapPoint, obstacleName: string) => {
    if (!point.obstacles || !Array.isArray(point.obstacles)) return false;
    return point.obstacles.some((obs: Obstacle) => {
      const obsName = obs?.name;
      return obsName === obstacleName;
    });
  };

  // Filtrer les points selon le filtre d'obstacle et trier par date de début
  const filteredPoints = useMemo(() => {
    let filtered;
    if (obstacleFilter === "all") {
      filtered = points.filter((p) => p.pose && p.depose);
    } else {
      filtered = points.filter(
        (p) => p.pose && p.depose && pointHasObstacle(p, obstacleFilter),
      );
    }
    // Trier par date de pose (la plus proche en premier)
    return filtered.sort(
      (a, b) => new Date(a.pose!).getTime() - new Date(b.pose!).getTime(),
    );
  }, [points, obstacleFilter]);

  // Calculer les bornes de temps
  const timeRange = useMemo(() => {
    if (filteredPoints.length === 0) {
      return {
        min: INITIAL_NOW - 12 * 60 * 60 * 1000,
        max: INITIAL_NOW + 12 * 60 * 60 * 1000,
      };
    }

    const times = filteredPoints.flatMap((p) => [
      new Date(p.pose!).getTime(),
      new Date(p.depose!).getTime(),
    ]);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const padding = (max - min) * 0.1 || 3600000;

    return { min: min - padding, max: max + padding };
  }, [filteredPoints]);

  // Fonction pour formater une date
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Fonction pour calculer la position en pourcentage
  const getPosition = (timestamp: number) => {
    const range = timeRange.max - timeRange.min;
    if (range === 0) return 50;
    return ((timestamp - timeRange.min) / range) * 100;
  };

  // Nombre total de points avec dates
  const totalPointsWithDates = points.filter((p) => p.pose && p.depose).length;

  // Générer les marqueurs de temps - doit être avant tout return conditionnel
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const range = timeRange.max - timeRange.min;
    const step = range / 6; // 6 marqueurs
    for (let i = 0; i <= 6; i++) {
      markers.push(timeRange.min + step * i);
    }
    return markers;
  }, [timeRange]);

  if (totalPointsWithDates === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 bg-gray-50">
        <div className="text-center p-8">
          <div className="text-6xl mb-4 animate-bounce">📅</div>
          <p className="text-lg font-semibold text-gray-700 mb-2">
            Aucun point avec dates pose/dépose
          </p>
          <p className="text-sm text-gray-500 mt-2 bg-white/60 px-4 py-2 rounded-xl">
            Ajoutez des dates aux points pour les voir sur la frise
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Barre de filtre */}
      <div className="shrink-0 px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 shadow-sm">
        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span className="text-lg">🏷️</span>
          <span>Type d'obstacle:</span>
        </label>
        <select
          value={obstacleFilter}
          onChange={(e) => setObstacleFilter(e.target.value)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 font-medium text-gray-700"
        >
          <option value="all">Tous les points ({totalPointsWithDates})</option>
          {obstacleTypes.map((type) => {
            const count = points.filter(
              (p) => p.pose && p.depose && pointHasObstacle(p, type),
            ).length;
            return (
              <option key={type} value={type}>
                {type} ({count})
              </option>
            );
          })}
        </select>
        {obstacleFilter !== "all" && (
          <button
            onClick={() => setObstacleFilter("all")}
            className="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow"
          >
            ✕ Réinitialiser
          </button>
        )}
        <span className="text-xs text-gray-600 ml-auto font-semibold bg-white px-3 py-1 rounded-full border border-gray-200">
          {filteredPoints.length} point(s) affiché(s)
        </span>
      </div>

      {/* Timeline */}
      {filteredPoints.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center p-8">
            <div className="text-6xl mb-4 animate-bounce">🔍</div>
            <p className="text-base font-medium text-gray-700 mb-2">
              Aucun point avec l'obstacle "{obstacleFilter}"
            </p>
            <button
              onClick={() => setObstacleFilter("all")}
              className="mt-4 px-5 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
            >
              Voir tous les points
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col overflow-hidden"
          ref={containerRef}
        >
          {/* En-tête avec les marqueurs de temps */}
          <div className="shrink-0 flex border-b border-gray-200 bg-slate-700 shadow-md">
            <div className="w-24 shrink-0 px-2 py-2 text-xs font-bold text-white border-r border-slate-600 flex items-center justify-center">
              <span>📍 Points</span>
            </div>
            <div className="flex-1 relative h-8">
              {timeMarkers.map((time, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center"
                  style={{ left: `${(i / 6) * 100}%` }}
                >
                  <span className="text-[10px] text-white font-semibold whitespace-nowrap transform -translate-x-1/2 bg-slate-800/50 px-1.5 py-0.5 rounded">
                    {formatTime(time)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Corps de la timeline avec scroll */}
          <div className="flex-1 overflow-y-auto">
            {filteredPoints.map((point, index) => {
              const startPos = getPosition(new Date(point.pose!).getTime());
              const endPos = getPosition(new Date(point.depose!).getTime());
              const width = Math.max(endPos - startPos, 2);

              return (
                <div
                  key={point.id}
                  className={`flex border-b border-gray-100 transition-all duration-200 hover:bg-blue-50/50 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  style={{ height: "44px" }}
                >
                  {/* Label du point */}
                  <div className="w-24 shrink-0 px-2 flex items-center text-xs font-semibold text-gray-700 border-r border-gray-200 bg-gray-50">
                    Point #{point.id}
                  </div>

                  {/* Barre de temps */}
                  <div className="flex-1 relative">
                    {/* Grille verticale */}
                    {timeMarkers.map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-gray-200/60"
                        style={{ left: `${(i / 6) * 100}%` }}
                      />
                    ))}

                    {/* Bloc de durée */}
                    <div
                      onClick={() => onPointClick(point)}
                      className="absolute top-1.5 bottom-1.5 rounded-lg cursor-pointer transition-all duration-300 hover:scale-y-125 hover:shadow-lg hover:z-10 shadow-md group"
                      style={{
                        left: `${startPos}%`,
                        width: `${width}%`,
                        background:
                          "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                        minWidth: "24px",
                      }}
                      title={`Point #${point.id}\nPose: ${formatTime(new Date(point.pose!).getTime())}\nDépose: ${formatTime(new Date(point.depose!).getTime())}`}
                    >
                      <div className="h-full flex items-center justify-center px-1.5 overflow-hidden">
                        <span className="text-[10px] text-white font-bold truncate drop-shadow-sm group-hover:scale-110 transition-transform">
                          #{point.id}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OfflineMapLibre({
  selectedEventId,
}: {
  selectedEventId: number | null;
}) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentMarker, setCurrentMarker] = useState<maplibregl.Marker | null>(
    null,
  );
  const pointsRef = useRef<MapPoint[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [addingPointCoords, setAddingPointCoords] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [awaitingMapClick, setAwaitingMapClick] = useState(false);
  const awaitingMapClickRef = useRef(false);
  const selectedEventIdRef = useRef<number | null>(null);
  const [geometries, setGeometries] = useState<GeometryData[]>([]);
  const [drawingMode, setDrawingMode] = useState<"none" | "polygon" | "line">(
    "none",
  );

  const [selectedGeometryId, setSelectedGeometryId] = useState<number | null>(
    null,
  );
  const [editingGeometryId, setEditingGeometryId] = useState<number | null>(
    null,
  );
  const [isGeometryListOpen, setIsGeometryListOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"points" | "timeline">("points");

  // Synchroniser la ref avec le state
  useEffect(() => {
    selectedEventIdRef.current = selectedEvent?.id ?? selectedEventId;
  }, [selectedEvent, selectedEventId]);

  // Charger tous les événements au démarrage
  useEffect(() => {
    const loadAllEvents = async () => {
      try {
        const allEvents = await invoke<MapEvent[]>("fetch_events");
        setEvents(allEvents);
      } catch (err) {
        console.error("Erreur lors du chargement des événements:", err);
      }
    };
    loadAllEvents();
  }, []);

  // Charger l'événement sélectionné
  useEffect(() => {
    const loadSelectedEvent = async () => {
      if (selectedEventId) {
        try {
          const allEvents = await invoke<MapEvent[]>("fetch_events");
          const event = allEvents.find((e) => e.id === selectedEventId);
          setSelectedEvent(event ?? null);
          setEvents(allEvents);
        } catch (err) {
          console.error("Erreur lors du chargement de l'événement:", err);
        }
      }
    };
    loadSelectedEvent();
  }, [selectedEventId]);

  // Fonction pour rafraîchir les géométries sur la carte
  const refreshGeometriesOnMap = (
    mapObj: maplibregl.Map,
    geoms: GeometryData[],
  ) => {
    // Supprimer les anciennes couches de géométries
    if (mapObj.getLayer("event-geometries-fill"))
      mapObj.removeLayer("event-geometries-fill");
    if (mapObj.getLayer("event-geometries-line"))
      mapObj.removeLayer("event-geometries-line");
    if (mapObj.getLayer("event-geometries-point"))
      mapObj.removeLayer("event-geometries-point");
    if (mapObj.getSource("event-geometries"))
      mapObj.removeSource("event-geometries");

    if (geoms.length === 0) return;

    // Convertir les WKT en GeoJSON features
    const features = geoms
      .map((g) => {
        const geometry = parseWKTtoGeoJSON(g.geom);
        if (!geometry) return null;
        return {
          type: "Feature",
          geometry,
          properties: {
            id: g.id,
            event_id: g.event_id,
            geom_type: geometry.type,
          },
        } as GeoJSON.Feature;
      })
      .filter((f): f is GeoJSON.Feature => f !== null);

    if (features.length === 0) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features,
    };

    // Ajouter la source
    mapObj.addSource("event-geometries", {
      type: "geojson",
      data: geojson,
    });

    // Ajouter la couche pour les polygones (fill)
    mapObj.addLayer({
      id: "event-geometries-fill",
      type: "fill",
      source: "event-geometries",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#6366f1",
        "fill-opacity": 0.3,
      },
    });

    // Ajouter la couche pour les lignes (incluant les contours des polygones)
    mapObj.addLayer({
      id: "event-geometries-line",
      type: "line",
      source: "event-geometries",
      filter: [
        "any",
        ["==", ["geometry-type"], "LineString"],
        ["==", ["geometry-type"], "Polygon"],
      ],
      paint: {
        "line-color": "#4f46e5",
        "line-width": 3,
        "line-opacity": 0.8,
      },
    });

    // Ajouter la couche pour les points
    mapObj.addLayer({
      id: "event-geometries-point",
      type: "circle",
      source: "event-geometries",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 10,
        "circle-color": "#8b5cf6",
        "circle-stroke-color": "#4f46e5",
        "circle-stroke-width": 3,
        "circle-opacity": 0.8,
      },
    });

    console.log("✅ Géométries affichées sur la carte:", features.length);
  };

  // Fonctions pour activer les modes de dessin
  const startDrawPolygon = () => {
    if (!drawRef.current) return;
    if (!selectedEvent) {
      alert("⚠️ Veuillez sélectionner un événement avant de dessiner.");
      return;
    }
    setDrawingMode("polygon");
    drawRef.current.changeMode("draw_polygon");
  };

  const startDrawLine = () => {
    if (!drawRef.current) return;
    if (!selectedEvent) {
      alert("⚠️ Veuillez sélectionner un événement avant de dessiner.");
      return;
    }
    setDrawingMode("line");
    drawRef.current.changeMode("draw_line_string");
  };

  const cancelDrawing = () => {
    if (!drawRef.current) return;
    setDrawingMode("none");
    drawRef.current.changeMode("simple_select");
    drawRef.current.deleteAll();
  };

  // Fonction pour obtenir le type lisible d'une géométrie WKT
  const getGeometryTypeLabel = (
    wkt: string,
  ): { label: string; icon: string } => {
    const upper = wkt.toUpperCase();
    if (upper.startsWith("POLYGON")) return { label: "Polygone", icon: "⬡" };
    if (upper.startsWith("LINESTRING")) return { label: "Ligne", icon: "╱" };
    if (upper.startsWith("POINT")) return { label: "Point", icon: "●" };
    return { label: "Inconnu", icon: "?" };
  };

  // Fonction pour surligner une géométrie sur la carte
  const highlightGeometry = (geom: GeometryData | null) => {
    if (!map) return;

    // Supprimer l'ancien surlignage
    if (map.getLayer("highlight-geometry-fill"))
      map.removeLayer("highlight-geometry-fill");
    if (map.getLayer("highlight-geometry-line"))
      map.removeLayer("highlight-geometry-line");
    if (map.getSource("highlight-geometry"))
      map.removeSource("highlight-geometry");

    if (!geom) {
      setSelectedGeometryId(null);
      return;
    }

    setSelectedGeometryId(geom.id);

    const geometry = parseWKTtoGeoJSON(geom.geom);
    if (!geometry) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry,
          properties: { id: geom.id },
        },
      ],
    };

    map.addSource("highlight-geometry", {
      type: "geojson",
      data: geojson,
    });

    // Style de surlignage plus visible
    if (geometry.type === "Polygon") {
      map.addLayer({
        id: "highlight-geometry-fill",
        type: "fill",
        source: "highlight-geometry",
        paint: {
          "fill-color": "#fbbf24",
          "fill-opacity": 0.5,
        },
      });
    }

    map.addLayer({
      id: "highlight-geometry-line",
      type: "line",
      source: "highlight-geometry",
      paint: {
        "line-color": "#f59e0b",
        "line-width": 5,
        "line-dasharray": [2, 2],
      },
    });

    // Centrer la carte sur la géométrie
    let coords: number[][] = [];
    if (geometry.type === "Polygon") {
      coords = geometry.coordinates[0] as number[][];
    } else if (geometry.type === "LineString") {
      coords = geometry.coordinates as number[][];
    } else if (geometry.type === "Point") {
      coords = [geometry.coordinates as number[]];
    }

    if (coords.length > 0) {
      const bounds = coords.reduce(
        (acc: maplibregl.LngLatBounds, coord: number[]) => {
          return acc.extend(coord as [number, number]);
        },
        new maplibregl.LngLatBounds(
          coords[0] as [number, number],
          coords[0] as [number, number],
        ),
      );
      map.fitBounds(bounds, { padding: 100, maxZoom: 17 });
    }
  };

  // Fonction pour supprimer une géométrie
  const handleDeleteGeometry = async (geometryId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette géométrie ?"))
      return;

    try {
      await invoke("delete_geometry", { geometryId });
      console.log("✅ Géométrie supprimée:", geometryId);

      // Rafraîchir la liste
      const eventId = selectedEvent?.id;
      if (eventId) {
        const geoms = await invoke<GeometryData[]>(
          "fetch_geometries_for_event",
          { eventId },
        );
        setGeometries(geoms);
        if (map) refreshGeometriesOnMap(map, geoms);
      }

      // Désélectionner si c'était la géométrie sélectionnée
      if (selectedGeometryId === geometryId) {
        highlightGeometry(null);
      }
    } catch (err) {
      console.error("Erreur suppression géométrie:", err);
      alert("Erreur lors de la suppression");
    }
  };

  // Fonction pour démarrer l'édition d'une géométrie
  const startEditGeometry = (geom: GeometryData) => {
    if (!drawRef.current || !map) return;

    setEditingGeometryId(geom.id);
    highlightGeometry(null); // Supprimer le surlignage

    // Convertir WKT en GeoJSON et l'ajouter au Draw
    const geometry = parseWKTtoGeoJSON(geom.geom);
    if (!geometry) return;

    const feature: GeoJSON.Feature = {
      type: "Feature",
      id: `edit-${geom.id}`,
      geometry,
      properties: { originalId: geom.id },
    };

    // Supprimer toutes les features du Draw et ajouter celle-ci
    drawRef.current.deleteAll();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    drawRef.current.add(feature as any);
    drawRef.current.changeMode("direct_select", {
      featureId: `edit-${geom.id}`,
    });

    // Masquer la géométrie originale
    if (map.getLayer("event-geometries-fill")) {
      map.setFilter("event-geometries-fill", ["!=", ["get", "id"], geom.id]);
    }
    if (map.getLayer("event-geometries-line")) {
      map.setFilter("event-geometries-line", [
        "all",
        [
          "any",
          ["==", ["geometry-type"], "LineString"],
          ["==", ["geometry-type"], "Polygon"],
        ],
        ["!=", ["get", "id"], geom.id],
      ]);
    }
  };

  // Fonction pour sauvegarder les modifications d'une géométrie
  const saveEditGeometry = async () => {
    if (!drawRef.current || !editingGeometryId) return;

    const features = drawRef.current.getAll();
    if (features.features.length === 0) {
      alert("Aucune géométrie à sauvegarder");
      return;
    }

    const feature = features.features[0];
    try {
      const wkt = geoJSONtoWKT(feature.geometry as GeoJSON.Geometry);
      await invoke("update_geometry", {
        geometryId: editingGeometryId,
        geom: wkt,
      });
      console.log("✅ Géométrie mise à jour:", editingGeometryId);

      // Rafraîchir
      const eventId = selectedEvent?.id;
      if (eventId && map) {
        const geoms = await invoke<GeometryData[]>(
          "fetch_geometries_for_event",
          { eventId },
        );
        setGeometries(geoms);
        refreshGeometriesOnMap(map, geoms);
      }

      cancelEditGeometry();
    } catch (err) {
      console.error("Erreur mise à jour géométrie:", err);
      alert("Erreur lors de la mise à jour");
    }
  };

  // Fonction pour annuler l'édition
  const cancelEditGeometry = () => {
    if (!drawRef.current || !map) return;

    drawRef.current.deleteAll();
    drawRef.current.changeMode("simple_select");
    setEditingGeometryId(null);

    // Restaurer les filtres des couches
    if (map.getLayer("event-geometries-fill")) {
      map.setFilter("event-geometries-fill", [
        "==",
        ["geometry-type"],
        "Polygon",
      ]);
    }
    if (map.getLayer("event-geometries-line")) {
      map.setFilter("event-geometries-line", [
        "any",
        ["==", ["geometry-type"], "LineString"],
        ["==", ["geometry-type"], "Polygon"],
      ]);
    }
  };

  // Initialisation de la carte
  useEffect(() => {
    if (map || !mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: "http://localhost:8080/styles/basic-preview/style.json",
      center: [7.7635, 48.5465],
      zoom: 13,
    });

    // Récupère les points via la commande Tauri `get_points`
    const fetchAndDisplayPoints = async (
      mapObj: maplibregl.Map,
      eventId?: number | null,
    ) => {
      try {
        console.log("🔄 Chargement des points pour event_id:", eventId);
        const points = await invoke<MapPoint[]>("get_points", {
          eventId: eventId || null,
        });
        console.log(`${points.length} point(s) récupéré(s)`);

        pointsRef.current = points;
        setPoints(points);

        const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
          type: "FeatureCollection",
          features: points.map((p: MapPoint) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [Number(p.x), Number(p.y)] as [number, number],
            },
            properties: {
              id: p.id,
              obstacles: p.obstacles,
              comments: p.comments,
              pictures: p.pictures,
            },
          })),
        };

        if (!mapObj.getSource("db-points")) {
          mapObj.addSource("db-points", {
            type: "geojson",
            data: geojson,
            cluster: true,
            clusterRadius: 50,
          });

          mapObj.addLayer({
            id: "db-points-layer",
            type: "circle",
            source: "db-points",
            paint: {
              "circle-radius": 6,
              "circle-color": "#FF5722",
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1,
            },
          });

          // --- CLICK LISTENER START ---
          mapObj.on(
            "click",
            "db-points-layer",
            async (e: maplibregl.MapLayerMouseEvent) => {
              const f = e.features?.[0];
              if (!f) return;
              const pointId = f.properties?.id;

              // Trouver le point dans les données
              const clickedPoint = pointsRef.current.find(
                (p) => String(p.id) === String(pointId),
              );

              if (clickedPoint) {
                setSelectedPoint(clickedPoint);
              }
            },
          );
          // --- CLICK LISTENER END ---

          // --- ADD POINT ON MAP CLICK ---
          mapObj.on("click", (e: maplibregl.MapMouseEvent) => {
            // Only open add form if we're in "add mode"
            if (!awaitingMapClickRef.current) return;

            // Check if we clicked on an existing point
            const features = mapObj.queryRenderedFeatures(e.point, {
              layers: ["db-points-layer"],
            });
            if (features.length > 0) return; // Don't open add form if clicking on existing point

            // Reset the awaiting state
            awaitingMapClickRef.current = false;
            setAwaitingMapClick(false);

            const { lng, lat } = e.lngLat;

            // Fermer les détails du point si ouverts et ouvrir le formulaire d'ajout
            setSelectedPoint(null);
            setAddingPointCoords({ lng, lat });
          });
          // --- ADD POINT ON MAP CLICK END ---

          // Mouse cursors
          mapObj.on(
            "mouseenter",
            "db-points-layer",
            () => (mapObj.getCanvas().style.cursor = "pointer"),
          );
          mapObj.on(
            "mouseleave",
            "db-points-layer",
            () => (mapObj.getCanvas().style.cursor = ""),
          );
        } else {
          (mapObj.getSource("db-points") as maplibregl.GeoJSONSource).setData(
            geojson,
          );
        }
      } catch (err) {
        console.error("fetchAndDisplayPoints error", err);
      }
    };

    mapInstance.on("load", () => {
      fetchAndDisplayPoints(mapInstance, selectedEventId);

      // Initialiser MapboxDraw pour le dessin de géométries
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: "simple_select",
        styles: [
          // Polygones
          {
            id: "gl-draw-polygon-fill",
            type: "fill",
            filter: [
              "all",
              ["==", "$type", "Polygon"],
              ["!=", "mode", "static"],
            ],
            paint: {
              "fill-color": "#6366f1",
              "fill-outline-color": "#4f46e5",
              "fill-opacity": 0.3,
            },
          },
          {
            id: "gl-draw-polygon-stroke-active",
            type: "line",
            filter: [
              "all",
              ["==", "$type", "Polygon"],
              ["!=", "mode", "static"],
            ],
            paint: {
              "line-color": "#4f46e5",
              "line-width": 3,
            },
          },
          // Lignes
          {
            id: "gl-draw-line",
            type: "line",
            filter: [
              "all",
              ["==", "$type", "LineString"],
              ["!=", "mode", "static"],
            ],
            paint: {
              "line-color": "#22c55e",
              "line-width": 4,
            },
          },
          // Points des sommets pendant le dessin
          {
            id: "gl-draw-polygon-and-line-vertex-active",
            type: "circle",
            filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
            paint: {
              "circle-radius": 6,
              "circle-color": "#fff",
              "circle-stroke-color": "#4f46e5",
              "circle-stroke-width": 2,
            },
          },
          // Point de milieu
          {
            id: "gl-draw-polygon-midpoint",
            type: "circle",
            filter: [
              "all",
              ["==", "meta", "midpoint"],
              ["==", "$type", "Point"],
            ],
            paint: {
              "circle-radius": 4,
              "circle-color": "#4f46e5",
            },
          },
        ],
      });

      // Ajouter le contrôle Draw à la carte (compatible MapLibre)
      mapInstance.addControl(
        draw as unknown as maplibregl.IControl,
        "top-right",
      );
      drawRef.current = draw;

      // Handler pour la création d'une géométrie
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mapInstance.on("draw.create", async (e: any) => {
        const feature = e.features[0];
        if (!feature) return;

        const eventId = selectedEventIdRef.current;
        if (!eventId) {
          alert(
            "⚠️ Veuillez sélectionner un événement avant de dessiner une géométrie.",
          );
          draw.delete(feature.id);
          return;
        }

        try {
          const wkt = geoJSONtoWKT(feature.geometry);
          console.log("📐 Création géométrie:", wkt);

          await invoke("create_geometry", {
            eventId: eventId,
            geom: wkt,
          });

          console.log("✅ Géométrie sauvegardée");

          // Supprimer la feature dessinée (elle sera rechargée depuis la DB)
          draw.delete(feature.id);

          // Recharger les géométries depuis la DB
          const geoms = await invoke<GeometryData[]>(
            "fetch_geometries_for_event",
            { eventId },
          );
          setGeometries(geoms);

          // Rafraîchir l'affichage des géométries sur la carte
          refreshGeometriesOnMap(mapInstance, geoms);
        } catch (err) {
          console.error("Erreur sauvegarde géométrie:", err);
          alert("Erreur lors de la sauvegarde de la géométrie");
          draw.delete(feature.id);
        }
      });
    });

    const initialMarker = new maplibregl.Marker()
      .setLngLat([7.7635, 48.5465])
      .setPopup(new maplibregl.Popup().setText("Strasbourg !"))
      .addTo(mapInstance);

    setCurrentMarker(initialMarker);
    setMap(mapInstance);
    mapRef.current = mapInstance;

    return () => mapInstance.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recharger les points quand l'événement sélectionné change
  useEffect(() => {
    if (!map) return;

    const reloadPoints = async () => {
      const eventId = selectedEvent?.id ?? null;
      console.log(
        "🔄 Changement d'événement, rechargement des points pour event_id:",
        eventId,
      );

      try {
        const freshPoints = await invoke<MapPoint[]>("get_points", {
          eventId: eventId,
        });
        console.log(
          `📍 ${freshPoints.length} point(s) récupéré(s) pour event ${eventId}`,
        );

        pointsRef.current = freshPoints;
        setPoints(freshPoints);

        // Mettre à jour la source GeoJSON
        if (map.getSource("db-points")) {
          const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
            type: "FeatureCollection",
            features: freshPoints.map((p: MapPoint) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [Number(p.x), Number(p.y)] as [number, number],
              },
              properties: {
                id: p.id,
                obstacles: p.obstacles,
                comments: p.comments,
                pictures: p.pictures,
              },
            })),
          };
          (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(
            geojson as GeoJSON.FeatureCollection,
          );
        }
      } catch (err) {
        console.error("Erreur rechargement points:", err);
      }
    };

    reloadPoints();
  }, [selectedEvent, map]);

  // Listener pour la mise à jour des points en temps réel (transfert du mobile)
  useEffect(() => {
    if (!map) return;

    const unlistenPromise = listen<number>("points-updated", async (event) => {
      const updatedEventId = event.payload;
      console.log(
        "🔄 Événement 'points-updated' reçu pour event_id:",
        updatedEventId,
      );

      // Si l'événement reçu est celui actuellement affichée, recharger les points
      if (selectedEvent?.id === updatedEventId) {
        console.log("📍 Mise à jour des points pour l'événement actuel");
        try {
          const freshPoints = await invoke<MapPoint[]>("get_points", {
            eventId: updatedEventId,
          });
          console.log(
            `✅ ${freshPoints.length} nouveau/nouveaux point(s) détecté(s)`,
          );

          pointsRef.current = freshPoints;
          setPoints(freshPoints);

          // Mettre à jour la source GeoJSON
          if (map.getSource("db-points")) {
            const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
              type: "FeatureCollection",
              features: freshPoints.map((p: MapPoint) => ({
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [Number(p.x), Number(p.y)] as [number, number],
                },
                properties: {
                  id: p.id,
                  obstacles: p.obstacles,
                  comments: p.comments,
                  pictures: p.pictures,
                },
              })),
            };
            (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(
              geojson as GeoJSON.FeatureCollection,
            );
          }
        } catch (err) {
          console.error("Erreur mise à jour des points via transfert:", err);
        }
      } else {
        console.log(
          "📝 Points reçus pour un autre événement (id:",
          updatedEventId,
          ") - non affiché actuellement",
        );
      }
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [map, selectedEvent]);

  // Charger et afficher les géométries quand l'événement sélectionné change
  useEffect(() => {
    if (!map) return;

    const loadGeometries = async () => {
      const eventId = selectedEvent?.id ?? null;

      if (!eventId) {
        setGeometries([]);
        refreshGeometriesOnMap(map, []);
        return;
      }

      try {
        console.log("📐 Chargement des géométries pour event_id:", eventId);
        const geoms = await invoke<GeometryData[]>(
          "fetch_geometries_for_event",
          { eventId },
        );
        console.log(`📐 ${geoms.length} géométrie(s) récupérée(s)`);
        setGeometries(geoms);
        refreshGeometriesOnMap(map, geoms);
      } catch (err) {
        console.error("Erreur chargement géométries:", err);
      }
    };

    loadGeometries();
  }, [selectedEvent, map]);

  // Fonction pour sélectionner une suggestion
  const handleSelect = (place: SearchResult) => {
    if (!map) return;

    const { lon, lat, display_name } = place;

    if (currentMarker) currentMarker.remove();

    const marker = new maplibregl.Marker()
      .setLngLat([parseFloat(lon), parseFloat(lat)])
      .setPopup(new maplibregl.Popup().setText(display_name))
      .addTo(map);

    setCurrentMarker(marker);

    map.flyTo({ center: [parseFloat(lon), parseFloat(lat)], zoom: 15 });

    setQuery(display_name);
    setResults([]);
  };

  // Debounce pour limiter les appels à Nominatim
  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `http://localhost:8081/search?q=${encodeURIComponent(
            query,
          )}&format=json&limit=5`,
        );
        const data = await response.json();
        setResults(data);
      } catch (error) {
        console.error("Erreur recherche adresse :", error);
      }
    }, 300); // délai 300ms après la dernière frappe

    return () => clearTimeout(timeout);
  }, [query]);

  // Sélectionne un point et centre la carte dessus (utilisé par la liste à gauche)
  const openPopupForPoint = async (point: MapPoint) => {
    if (!map || !point) return;
    const coords: [number, number] = [Number(point.x), Number(point.y)];
    map.flyTo({ center: coords, zoom: 15 });
    setSelectedPoint(point);
  };

  // Rafraîchir les points et mettre à jour le point sélectionné
  const refreshPoints = async () => {
    if (!map) return;
    const currentEventId = selectedEventIdRef.current;
    try {
      const freshPoints = await invoke<MapPoint[]>("get_points", {
        eventId: currentEventId || null,
      });
      pointsRef.current = freshPoints;
      setPoints(freshPoints);

      // Mettre à jour le point sélectionné s'il existe encore
      if (selectedPoint) {
        const updatedPoint = freshPoints.find((p) => p.id === selectedPoint.id);
        setSelectedPoint(updatedPoint || null);
      }

      // Mettre à jour la source GeoJSON
      if (map.getSource("db-points")) {
        const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
          type: "FeatureCollection",
          features: freshPoints.map((p: MapPoint) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [Number(p.x), Number(p.y)] as [number, number],
            },
            properties: {
              id: p.id,
              obstacles: p.obstacles,
              comments: p.comments,
              pictures: p.pictures,
            },
          })),
        };
        (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(
          geojson as GeoJSON.FeatureCollection,
        );
      }
    } catch (err) {
      console.error("Erreur refresh points:", err);
    }
  };

  // Écouter les mises à jour de points depuis le backend (ex: import mobile)
  useEffect(() => {
    const unlisten = listen<number>("points-updated", async (event) => {
      console.log("📥 Points mis à jour, event_id:", event.payload);

      // Utiliser mapRef pour accéder à la carte
      const currentMap = mapRef.current;
      if (!currentMap) {
        console.log("⚠️ Map non prête, skip refresh");
        return;
      }

      const currentEventId = selectedEventIdRef.current;
      try {
        const freshPoints = await invoke<MapPoint[]>("get_points", {
          eventId: currentEventId || null,
        });
        console.log(
          `📍 ${freshPoints.length} point(s) récupéré(s) après import`,
        );
        pointsRef.current = freshPoints;
        setPoints(freshPoints);

        // Mettre à jour la source GeoJSON
        if (currentMap.getSource("db-points")) {
          const geojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: freshPoints.map((p: MapPoint) => ({
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [Number(p.x), Number(p.y)] as [number, number],
              },
              properties: {
                id: p.id,
                obstacles: p.obstacles,
                comments: p.comments,
                pictures: p.pictures,
              },
            })),
          };
          (
            currentMap.getSource("db-points") as maplibregl.GeoJSONSource
          ).setData(geojson);
          console.log("✅ Carte mise à jour avec les nouveaux points");
        }
      } catch (err) {
        console.error("Erreur refresh points après import:", err);
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Gestion du clic pour ajouter un point
  const handleAddPointClick = () => {
    if (!map) {
      alert("Carte non initialisée");
      return;
    }
    setAwaitingMapClick(true);
    awaitingMapClickRef.current = true;
  };

  // Effet pour le curseur crosshair quand on attend un clic
  useEffect(() => {
    if (!map) return;
    try {
      const canvas = map.getCanvas();
      canvas.style.cursor = awaitingMapClick ? "crosshair" : "";
    } catch {
      /* ignore */
    }
    return () => {
      try {
        if (map) map.getCanvas().style.cursor = "";
      } catch {
        /* ignore */
      }
    };
  }, [awaitingMapClick, map]);

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* En-tête avec sélecteur d'événements, barre de recherche et onglets */}
      <div className="bg-slate-700 shadow-lg">
        {/* Ligne 1: Sélecteur d'événement et recherche */}
        <div className="p-4 pb-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-white font-semibold text-base flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <span>Événement</span>
              </label>
            </div>
            <select
              value={selectedEvent?.id || ""}
              onChange={(e) => {
                const event = events.find(
                  (ev) => ev.id === parseInt(e.target.value),
                );
                setSelectedEvent(event ?? null);
              }}
              className="min-w-[200px] px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 font-semibold transition-all duration-200 hover:bg-gray-50 hover:shadow-md cursor-pointer text-sm"
            >
              <option value="">Choisir un événement...</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.event_type === "Marathon" && "🏃‍♂️"}
                  {event.event_type === "Cyclisme" && "🚴‍♂️"}
                  {event.event_type === "Trail" && "🥾"}
                  {event.name || `Événement #${event.id}`}
                  {event.status === "active" && " 🟢"}
                  {event.status === "planned" && " 🔵"}
                </option>
              ))}
            </select>

            {/* Barre de recherche d'adresses */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="🔍 Rechercher un lieu..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => setTimeout(() => setResults([]), 150)}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 font-semibold transition-all duration-200 hover:bg-gray-50 hover:shadow-md placeholder-gray-400 text-sm"
              />

              {/* Liste de suggestions */}
              <div
                className={`absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto transition-all duration-300 ease-out z-50 ${results.length > 0 ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none h-0 mt-0"}`}
              >
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-all duration-200 group"
                    onClick={() => handleSelect(r)}
                  >
                    <div className="text-sm text-gray-800 font-medium flex items-center gap-2">
                      <span className="text-lg group-hover:scale-125 transition-transform">
                        📍
                      </span>
                      <span>{r.display_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ligne 2: Onglets de navigation */}
        <div className="flex items-center gap-2 px-4 mt-3 border-t border-slate-600">
          <button
            onClick={() => setViewMode("points")}
            className={`px-4 py-2.5 text-sm font-semibold transition-all duration-200 border-b-2 ${
              viewMode === "points"
                ? "text-white border-blue-400"
                : "text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-500"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>📋</span>
              <span>Liste des points</span>
              <span className="text-xs bg-slate-600 px-2 py-0.5 rounded-full">
                {points.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`px-4 py-2.5 text-sm font-semibold transition-all duration-200 border-b-2 ${
              viewMode === "timeline"
                ? "text-white border-blue-400"
                : "text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-500"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>📅</span>
              <span>Frise chronologique</span>
            </span>
          </button>
        </div>
      </div>

      {/* Conteneur principal avec disposition horizontale */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panneau latéral gauche: Liste des points OU Formulaire d'ajout OU Détails (mode points uniquement) */}
        {viewMode === "points" && (
          <div className="w-96 bg-white border-r border-gray-200 shadow-lg flex flex-col">
            {/* Si on est en train d'ajouter un point, afficher le formulaire */}
            {addingPointCoords ? (
              <div className="flex-1 overflow-y-auto">
                <AddPointForm
                  initialCoords={addingPointCoords}
                  onClose={() => setAddingPointCoords(null)}
                  onSaved={() => {
                    setAddingPointCoords(null);
                    refreshPoints();
                  }}
                  eventId={selectedEventIdRef.current}
                />
              </div>
            ) : selectedPoint ? (
              /* Si un point est sélectionné, afficher ses détails */
              <div className="flex-1 overflow-y-auto">
                <PointDetails
                  point={
                    {
                      ...selectedPoint,
                      obstacles: (selectedPoint.obstacles || []).map((o) => ({
                        ...o,
                        id: o.id ?? 0,
                      })),
                      comments: (selectedPoint.comments || []).map((c) => ({
                        ...c,
                      })),
                      pictures: (selectedPoint.pictures || []).map((p) => ({
                        ...p,
                      })),
                    } as Point
                  }
                  onClose={() => setSelectedPoint(null)}
                  onRefresh={refreshPoints}
                />
              </div>
            ) : (
              /* Sinon, afficher la liste des points */
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {points.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <div className="text-5xl mb-3">📭</div>
                    <p className="text-base font-semibold text-gray-700 mb-2">
                      Aucun point
                    </p>
                    <p className="text-sm text-gray-500 px-4">
                      Utilisez les boutons en haut à gauche de la carte pour
                      ajouter des points et géométries
                    </p>
                  </div>
                ) : (
                  points.map((p: MapPoint) => (
                    <div
                      key={p.id}
                      onClick={() => openPopupForPoint(p)}
                      className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                          <span className="text-base group-hover:scale-110 transition-transform">
                            📍
                          </span>
                          <span>Point #{p.id}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPopupForPoint(p);
                          }}
                          className="text-blue-600 hover:text-blue-700 text-xs font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-all"
                        >
                          Détails →
                        </button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded text-xs font-medium border border-orange-200 flex items-center gap-1">
                          <span>🚧</span>
                          <span>{p.obstacles?.length || 0}</span>
                        </span>
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium border border-blue-200 flex items-center gap-1">
                          <span>💬</span>
                          <span>{p.comments?.length || 0}</span>
                        </span>
                        {p.pictures && p.pictures.length > 0 && (
                          <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-medium border border-purple-200 flex items-center gap-1">
                            <span>📷</span>
                            <span>{p.pictures.length}</span>
                          </span>
                        )}
                      </div>
                      {(p.pose || p.depose) && (
                        <div className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded font-medium border border-gray-200">
                          {p.pose && `🕐 ${formatDateShort(p.pose)}`}
                          {p.pose && p.depose && " → "}
                          {p.depose && `${formatDateShort(p.depose)}`}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        {/* Vue Frise chronologique (50% à GAUCHE en mode timeline) */}
        {viewMode === "timeline" && (
          <div className="w-1/2 bg-white border-r border-gray-200 shadow-lg flex flex-col">
            <div className="flex-1 overflow-hidden">
              <TimelinePanel points={points} onPointClick={openPopupForPoint} />
            </div>
          </div>
        )}

        {/* Zone de la carte (prend le reste de l'espace) */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Carte */}
          <div ref={mapContainer} className="flex-1 h-full" />

          {/* Boutons d'outils flottants - visibles uniquement si un événement est sélectionné */}
          {selectedEvent && (
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
              {/* Message d'aide contextuel */}
              {drawingMode !== "none" && (
                <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium max-w-xs">
                  💡{" "}
                  {drawingMode === "polygon"
                    ? "Cliquez pour placer les sommets. Double-cliquez pour terminer."
                    : "Cliquez pour placer les points. Double-cliquez pour terminer."}
                </div>
              )}

              {/* Boutons d'action rapide */}
              <div className="flex gap-2">
                {/* Bouton Ajouter Point */}
                <button
                  onClick={handleAddPointClick}
                  disabled={!selectedEvent}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 ${
                    awaitingMapClick
                      ? "bg-amber-500 text-white animate-pulse"
                      : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
                  }`}
                  title="Ajouter un point sur la carte"
                >
                  <span className="text-xl">📍</span>
                </button>

                {/* Bouton Polygone */}
                <button
                  onClick={startDrawPolygon}
                  disabled={!selectedEvent}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 ${
                    drawingMode === "polygon"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
                  }`}
                  title="Dessiner un polygone"
                >
                  <span className="text-xl">⬡</span>
                </button>

                {/* Bouton Ligne */}
                <button
                  onClick={startDrawLine}
                  disabled={!selectedEvent}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 ${
                    drawingMode === "line"
                      ? "bg-green-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
                  }`}
                  title="Dessiner une ligne"
                >
                  <span className="text-xl">╱</span>
                </button>

                {/* Bouton Annuler (visible en mode dessin) */}
                {(drawingMode !== "none" || awaitingMapClick) && (
                  <button
                    onClick={() => {
                      if (drawingMode !== "none") cancelDrawing();
                      if (awaitingMapClick) {
                        setAwaitingMapClick(false);
                        awaitingMapClickRef.current = false;
                      }
                    }}
                    className="px-4 py-3 rounded-lg font-semibold bg-red-500 text-white hover:bg-red-600 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                    title="Annuler"
                  >
                    <span className="text-xl">✕</span>
                    <span className="text-sm">Annuler</span>
                  </button>
                )}
              </div>

              {/* Liste des géométries (compacte) */}
              {selectedEvent && geometries.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden max-w-sm">
                  <button
                    onClick={() => setIsGeometryListOpen(!isGeometryListOpen)}
                    className="w-full px-4 py-2 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">📐</span>
                      <span>{geometries.length} géométrie(s)</span>
                    </span>
                    <span
                      className={`transition-transform duration-200 ${isGeometryListOpen ? "rotate-180" : ""}`}
                    >
                      ▼
                    </span>
                  </button>

                  {isGeometryListOpen && (
                    <div className="max-h-64 overflow-y-auto border-t border-gray-200 bg-gray-50">
                      {geometries.map((geom) => {
                        const { label, icon } = getGeometryTypeLabel(geom.geom);
                        const isSelected = selectedGeometryId === geom.id;
                        const isEditing = editingGeometryId === geom.id;

                        return (
                          <div
                            key={geom.id}
                            className={`p-3 border-b border-gray-200 last:border-b-0 transition-all duration-200 ${
                              isEditing
                                ? "bg-amber-50"
                                : isSelected
                                  ? "bg-blue-50"
                                  : "bg-white hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                onClick={() =>
                                  highlightGeometry(isSelected ? null : geom)
                                }
                                className="flex items-center gap-2 text-left flex-1 min-w-0"
                              >
                                <span className="text-base shrink-0">
                                  {icon}
                                </span>
                                <span className="font-semibold text-xs truncate">
                                  {label} #{geom.id}
                                </span>
                              </button>

                              {!editingGeometryId && (
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    onClick={() => startEditGeometry(geom)}
                                    className="p-1.5 rounded hover:bg-blue-100 bg-blue-50 text-blue-600 transition-all duration-200"
                                    title="Modifier"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteGeometry(geom.id)
                                    }
                                    className="p-1.5 rounded hover:bg-red-100 bg-red-50 text-red-600 transition-all duration-200"
                                    title="Supprimer"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                            </div>

                            {isEditing && (
                              <div className="mt-2 flex gap-2">
                                <button
                                  onClick={saveEditGeometry}
                                  className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 transition-all duration-200"
                                >
                                  ✓ Sauvegarder
                                </button>
                                <button
                                  onClick={cancelEditGeometry}
                                  className="flex-1 px-3 py-1.5 bg-gray-500 text-white rounded text-xs font-semibold hover:bg-gray-600 transition-all duration-200"
                                >
                                  ✕ Annuler
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OfflineMapLibre;
