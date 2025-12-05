import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import PointDetails from "./PointDetails";
import AddPointForm from "./AddPointForm";

// Fonction pour convertir GeoJSON en WKT
function geoJSONtoWKT(geometry: GeoJSON.Geometry): string {
  if (geometry.type === "Polygon") {
    const coords = geometry.coordinates[0]
      .map(([x, y]) => `${x} ${y}`)
      .join(", ");
    return `POLYGON((${coords}))`;
  }
  if (geometry.type === "LineString") {
    const coords = geometry.coordinates
      .map(([x, y]) => `${x} ${y}`)
      .join(", ");
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
          coordinates: [parseFloat(match[1]), parseFloat(match[2])]
        };
      }
    }

    // LINESTRING(x1 y1, x2 y2, ...)
    if (wktTrimmed.startsWith("LINESTRING")) {
      const match = wkt.match(/LINESTRING\s*\(\s*(.+)\s*\)/i);
      if (match) {
        const coords = match[1].split(",").map(pair => {
          const [x, y] = pair.trim().split(/\s+/);
          return [parseFloat(x), parseFloat(y)];
        });
        return {
          type: "LineString",
          coordinates: coords
        };
      }
    }

    // POLYGON((x1 y1, x2 y2, ...))
    if (wktTrimmed.startsWith("POLYGON")) {
      const match = wkt.match(/POLYGON\s*\(\s*\(\s*(.+)\s*\)\s*\)/i);
      if (match) {
        const coords = match[1].split(",").map(pair => {
          const [x, y] = pair.trim().split(/\s+/);
          return [parseFloat(x), parseFloat(y)];
        });
        return {
          type: "Polygon",
          coordinates: [coords]
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

// Helper pour formater une date complète
function formatDateFull(dateStr: string | null | undefined): string {
  if (!dateStr) return "Non défini";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// Type pour les entrées de la frise (pose ou dépose)
type TimelineEntry = {
  id: number;
  pointId: number;
  type: 'pose' | 'depose';
  date: Date;
  point: any;
};

// Composant Frise Chronologique
function TimelineView({ 
  points, 
  onPointClick, 
  fullscreen 
}: { 
  points: any[]; 
  onPointClick: (point: any) => void;
  fullscreen: boolean;
}) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'pose' | 'depose'>('all');
  const MAX_POINTS_PER_DAY = 5;

  const toggleDayExpansion = (day: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(day)) {
        newSet.delete(day);
      } else {
        newSet.add(day);
      }
      return newSet;
    });
  };

  // Créer des entrées séparées pour chaque pose et dépose
  const timelineEntries: TimelineEntry[] = [];
  let entryId = 0;
  
  points.forEach(p => {
    if (p.pose && (filter === 'all' || filter === 'pose')) {
      timelineEntries.push({
        id: entryId++,
        pointId: p.id,
        type: 'pose',
        date: new Date(p.pose),
        point: p,
      });
    }
    if (p.depose && (filter === 'all' || filter === 'depose')) {
      timelineEntries.push({
        id: entryId++,
        pointId: p.id,
        type: 'depose',
        date: new Date(p.depose),
        point: p,
      });
    }
  });

  // Trier par date
  timelineEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (timelineEntries.length === 0) {
    return (
      <div className="space-y-4">
        {/* Filtres */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === 'all' 
                ? 'bg-indigo-500 text-white shadow-md' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tout
          </button>
          <button
            onClick={() => setFilter('pose')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === 'pose' 
                ? 'bg-green-500 text-white shadow-md' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ▲ Poses
          </button>
          <button
            onClick={() => setFilter('depose')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === 'depose' 
                ? 'bg-red-500 text-white shadow-md' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ▼ Déposes
          </button>
        </div>
        
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-2">📅</div>
          <p>Aucun point avec dates</p>
        </div>
      </div>
    );
  }

  // Grouper les entrées par jour
  const groupedByDay: { [key: string]: TimelineEntry[] } = {};
  timelineEntries.forEach(entry => {
    const dateKey = entry.date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    if (!groupedByDay[dateKey]) {
      groupedByDay[dateKey] = [];
    }
    groupedByDay[dateKey].push(entry);
  });

  const days = Object.keys(groupedByDay);

  // Composant de filtres
  const FilterButtons = () => (
    <div className="flex gap-2 flex-wrap mb-4">
      <button
        onClick={() => setFilter('all')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          filter === 'all' 
            ? 'bg-indigo-500 text-white shadow-md' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        Tout ({points.filter(p => p.pose || p.depose).length})
      </button>
      <button
        onClick={() => setFilter('pose')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          filter === 'pose' 
            ? 'bg-green-500 text-white shadow-md' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        ▲ Poses ({points.filter(p => p.pose).length})
      </button>
      <button
        onClick={() => setFilter('depose')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          filter === 'depose' 
            ? 'bg-red-500 text-white shadow-md' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        ▼ Déposes ({points.filter(p => p.depose).length})
      </button>
    </div>
  );

  if (fullscreen) {
    // Vue plein écran : frise horizontale avec tous les jours
    return (
      <div className="space-y-6">
        <FilterButtons />
        
        {days.map((day) => (
          <div key={day} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600">
              <h3 className="text-white font-bold text-lg">{day}</h3>
              <p className="text-white/70 text-sm">{groupedByDay[day].length} événement(s)</p>
            </div>
            
            <div className="p-6">
              {/* Ligne de temps horizontale */}
              <div className="relative">
                {/* Ligne de base */}
                <div className="absolute top-8 left-0 right-0 h-1 bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 rounded-full"></div>
                
                {/* Points sur la frise */}
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {(() => {
                    const dayEntries = groupedByDay[day];
                    const isExpanded = expandedDays.has(day);
                    const visibleEntries = isExpanded ? dayEntries : dayEntries.slice(0, MAX_POINTS_PER_DAY);
                    const hiddenCount = dayEntries.length - MAX_POINTS_PER_DAY;
                    
                    return (
                      <>
                        {visibleEntries.map((entry) => (
                          <div 
                            key={entry.id}
                            className="flex-shrink-0 relative pt-12"
                            style={{ minWidth: fullscreen ? '200px' : '150px' }}
                          >
                            {/* Connecteur vertical */}
                            <div className={`absolute top-4 left-1/2 -translate-x-1/2 w-0.5 h-8 ${
                              entry.type === 'pose' ? 'bg-green-300' : 'bg-red-300'
                            }`}></div>
                            
                            {/* Point sur la ligne */}
                            <div 
                              className={`absolute top-6 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-4 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform ${
                                entry.type === 'pose' 
                                  ? 'bg-gradient-to-br from-green-400 to-green-600' 
                                  : 'bg-gradient-to-br from-red-400 to-red-600'
                              }`}
                              onClick={() => onPointClick(entry.point)}
                            ></div>
                            
                            {/* Carte du point */}
                            <div 
                              onClick={() => onPointClick(entry.point)}
                              className={`bg-white rounded-xl border-2 shadow-md hover:shadow-lg cursor-pointer transition-all p-4 ${
                                entry.type === 'pose' 
                                  ? 'border-green-200 hover:border-green-400' 
                                  : 'border-red-200 hover:border-red-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-lg ${entry.type === 'pose' ? 'text-green-500' : 'text-red-500'}`}>
                                  {entry.type === 'pose' ? '▲' : '▼'}
                                </span>
                                <span className="font-bold text-gray-800">Point #{entry.pointId}</span>
                              </div>
                              
                              <div className={`flex items-center gap-2 text-xs ${
                                entry.type === 'pose' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                <span className={`w-2 h-2 rounded-full ${
                                  entry.type === 'pose' ? 'bg-green-500' : 'bg-red-500'
                                }`}></span>
                                <span>
                                  {entry.type === 'pose' ? 'Pose' : 'Dépose'}: {entry.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              
                              <div className="text-xs text-gray-400 mt-2">
                                {entry.point.obstacles?.length || 0} obstacle(s)
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Bouton voir plus / voir moins */}
                        {hiddenCount > 0 && (
                          <div 
                            className="flex-shrink-0 relative pt-12"
                            style={{ minWidth: '120px' }}
                          >
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-indigo-300"></div>
                            <button
                              onClick={() => toggleDayExpansion(day)}
                              className="absolute top-6 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-4 border-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                            >
                              <span className="text-white font-bold text-xs">{isExpanded ? '−' : `+${hiddenCount}`}</span>
                            </button>
                            
                            <div className="mt-8 text-center">
                              <span className="text-xs text-gray-500">
                                {isExpanded ? 'Voir moins' : `${hiddenCount} de plus`}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Vue sidebar : frise verticale compacte
  return (
    <div className="space-y-4">
      <FilterButtons />
      
      {days.map((day) => {
        const dayEntries = groupedByDay[day];
        const isExpanded = expandedDays.has(day);
        const visibleEntries = isExpanded ? dayEntries : dayEntries.slice(0, MAX_POINTS_PER_DAY);
        const hiddenCount = dayEntries.length - MAX_POINTS_PER_DAY;
        
        return (
          <div key={day} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-3 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 border-b border-indigo-100 flex items-center justify-between">
              <h4 className="text-indigo-800 font-semibold text-xs">{day}</h4>
              <span className="text-indigo-600 text-xs">{dayEntries.length} événement(s)</span>
            </div>
            
            <div className="relative pl-6 pr-2 py-2">
              {/* Ligne verticale */}
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-300 to-purple-300"></div>
              
              {visibleEntries.map((entry) => (
                <div 
                  key={entry.id}
                  className="relative mb-3 last:mb-0"
                >
                  {/* Point sur la ligne */}
                  <div className={`absolute -left-3 top-2 w-3 h-3 rounded-full border-2 border-white shadow ${
                    entry.type === 'pose' 
                      ? 'bg-gradient-to-br from-green-400 to-green-600' 
                      : 'bg-gradient-to-br from-red-400 to-red-600'
                  }`}></div>
                  
                  {/* Carte du point */}
                  <div 
                    onClick={() => onPointClick(entry.point)}
                    className={`ml-2 p-2 rounded-lg cursor-pointer transition-colors border ${
                      entry.type === 'pose'
                        ? 'bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-300'
                        : 'bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm ${entry.type === 'pose' ? 'text-green-500' : 'text-red-500'}`}>
                        {entry.type === 'pose' ? '▲' : '▼'}
                      </span>
                      <span className="font-semibold text-gray-800 text-sm">Point #{entry.pointId}</span>
                    </div>
                    
                    <div className={`text-xs mt-0.5 ${
                      entry.type === 'pose' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {entry.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Bouton voir plus / voir moins */}
              {hiddenCount > 0 && (
                <div className="relative mb-3">
                  <button
                    onClick={() => toggleDayExpansion(day)}
                    className="ml-2 w-full p-2 bg-amber-50 hover:bg-amber-100 rounded-lg cursor-pointer transition-colors border border-amber-200 text-center"
                  >
                    <span className="text-amber-700 font-medium text-xs">
                      {isExpanded ? '▲ Voir moins' : `▼ Voir ${hiddenCount} événement(s) de plus`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OfflineMapLibre({ selectedEventId }: { selectedEventId: number | null }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [currentMarker, setCurrentMarker] = useState<maplibregl.Marker | null>(
    null
  );
  const pointsRef = useRef<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);
  const [addingPointCoords, setAddingPointCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [awaitingMapClick, setAwaitingMapClick] = useState(false);
  const awaitingMapClickRef = useRef(false);
  const selectedEventIdRef = useRef<number | null>(null);
  const [geometries, setGeometries] = useState<GeometryData[]>([]);
  const [drawingMode, setDrawingMode] = useState<"none" | "polygon" | "line">("none");
  const [isDrawingToolsOpen, setIsDrawingToolsOpen] = useState(false);
  const [selectedGeometryId, setSelectedGeometryId] = useState<number | null>(null);
  const [editingGeometryId, setEditingGeometryId] = useState<number | null>(null);
  const [isGeometryListOpen, setIsGeometryListOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"list" | "timeline">("list");
  const [isTimelineFullscreen, setIsTimelineFullscreen] = useState(false);

  // Synchroniser la ref avec le state
  useEffect(() => {
    selectedEventIdRef.current = selectedEvent?.id ?? selectedEventId;
  }, [selectedEvent, selectedEventId]);

  // Charger tous les événements au démarrage
  useEffect(() => {
    const loadAllEvents = async () => {
      try {
        const allEvents = await invoke("fetch_events");
        setEvents(allEvents as any[]);
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
          const allEvents = await invoke("fetch_events");
          const event = (allEvents as any[]).find(e => e.id === selectedEventId);
          setSelectedEvent(event);
          setEvents(allEvents as any[]);
        } catch (err) {
          console.error("Erreur lors du chargement de l'événement:", err);
        }
      }
    };
    loadSelectedEvent();
  }, [selectedEventId]);

  // Fonction pour changer d'événement
  const handleEventChange = (eventId: string) => {
    const event = events.find(e => e.id === parseInt(eventId));
    setSelectedEvent(event);
  };

  // Fonction pour rafraîchir les géométries sur la carte
  const refreshGeometriesOnMap = (mapObj: maplibregl.Map, geoms: GeometryData[]) => {
    // Supprimer les anciennes couches de géométries
    if (mapObj.getLayer("event-geometries-fill")) mapObj.removeLayer("event-geometries-fill");
    if (mapObj.getLayer("event-geometries-line")) mapObj.removeLayer("event-geometries-line");
    if (mapObj.getLayer("event-geometries-point")) mapObj.removeLayer("event-geometries-point");
    if (mapObj.getSource("event-geometries")) mapObj.removeSource("event-geometries");

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
      filter: ["any",
        ["==", ["geometry-type"], "LineString"],
        ["==", ["geometry-type"], "Polygon"]
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
  const getGeometryTypeLabel = (wkt: string): { label: string; icon: string } => {
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
    if (map.getLayer("highlight-geometry-fill")) map.removeLayer("highlight-geometry-fill");
    if (map.getLayer("highlight-geometry-line")) map.removeLayer("highlight-geometry-line");
    if (map.getSource("highlight-geometry")) map.removeSource("highlight-geometry");

    if (!geom) {
      setSelectedGeometryId(null);
      return;
    }

    setSelectedGeometryId(geom.id);

    const geometry = parseWKTtoGeoJSON(geom.geom);
    if (!geometry) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry,
        properties: { id: geom.id },
      }],
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
        new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
      );
      map.fitBounds(bounds, { padding: 100, maxZoom: 17 });
    }
  };

  // Fonction pour supprimer une géométrie
  const handleDeleteGeometry = async (geometryId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette géométrie ?")) return;

    try {
      await invoke("delete_geometry", { geometryId });
      console.log("✅ Géométrie supprimée:", geometryId);

      // Rafraîchir la liste
      const eventId = selectedEvent?.id;
      if (eventId) {
        const geoms = await invoke<GeometryData[]>("fetch_geometries_for_event", { eventId });
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
    drawRef.current.add(feature as any);
    drawRef.current.changeMode("direct_select", { featureId: `edit-${geom.id}` });

    // Masquer la géométrie originale
    if (map.getLayer("event-geometries-fill")) {
      map.setFilter("event-geometries-fill", ["!=", ["get", "id"], geom.id]);
    }
    if (map.getLayer("event-geometries-line")) {
      map.setFilter("event-geometries-line", ["all",
        ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "Polygon"]],
        ["!=", ["get", "id"], geom.id]
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
      await invoke("update_geometry", { geometryId: editingGeometryId, geom: wkt });
      console.log("✅ Géométrie mise à jour:", editingGeometryId);

      // Rafraîchir
      const eventId = selectedEvent?.id;
      if (eventId && map) {
        const geoms = await invoke<GeometryData[]>("fetch_geometries_for_event", { eventId });
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
      map.setFilter("event-geometries-fill", ["==", ["geometry-type"], "Polygon"]);
    }
    if (map.getLayer("event-geometries-line")) {
      map.setFilter("event-geometries-line", ["any",
        ["==", ["geometry-type"], "LineString"],
        ["==", ["geometry-type"], "Polygon"]
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
    const fetchAndDisplayPoints = async (mapObj: maplibregl.Map, eventId?: number | null) => {
      try {
        console.log("🔄 Chargement des points pour event_id:", eventId);
        const points = await invoke<any[]>("get_points", { eventId: eventId || null });
        console.log(`📍 ${points.length} point(s) récupéré(s)`);

        pointsRef.current = points;
        setPoints(points);

        const geojson = {
          type: "FeatureCollection",
          features: points.map((p: any) => ({
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
        } as GeoJSON.FeatureCollection<GeoJSON.Point, any>;

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
          mapObj.on("click", "db-points-layer", async (e: any) => {
            const f = e.features?.[0];
            if (!f) return;
            const pointId = f.properties?.id;

            // Trouver le point dans les données
            const clickedPoint = pointsRef.current.find(
              (p) => String(p.id) === String(pointId)
            );

            if (clickedPoint) {
              setSelectedPoint(clickedPoint);
            }
          });
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
          mapObj.on("mouseenter", "db-points-layer", () => (mapObj.getCanvas().style.cursor = "pointer"));
          mapObj.on("mouseleave", "db-points-layer", () => (mapObj.getCanvas().style.cursor = ""));

        } else {
          (mapObj.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson);
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
            filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
            paint: {
              "fill-color": "#6366f1",
              "fill-outline-color": "#4f46e5",
              "fill-opacity": 0.3,
            },
          },
          {
            id: "gl-draw-polygon-stroke-active",
            type: "line",
            filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
            paint: {
              "line-color": "#4f46e5",
              "line-width": 3,
            },
          },
          // Lignes
          {
            id: "gl-draw-line",
            type: "line",
            filter: ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
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
            filter: ["all", ["==", "meta", "midpoint"], ["==", "$type", "Point"]],
            paint: {
              "circle-radius": 4,
              "circle-color": "#4f46e5",
            },
          },
        ],
      });

      // Ajouter le contrôle Draw à la carte (compatible MapLibre)
      mapInstance.addControl(draw as unknown as maplibregl.IControl, "top-right");
      drawRef.current = draw;

      // Handler pour la création d'une géométrie
      mapInstance.on("draw.create", async (e: any) => {
        const feature = e.features[0];
        if (!feature) return;

        const eventId = selectedEventIdRef.current;
        if (!eventId) {
          alert("⚠️ Veuillez sélectionner un événement avant de dessiner une géométrie.");
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
          const geoms = await invoke<GeometryData[]>("fetch_geometries_for_event", { eventId });
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
  }, []);

  // Recharger les points quand l'événement sélectionné change
  useEffect(() => {
    if (!map) return;

    const reloadPoints = async () => {
      const eventId = selectedEvent?.id ?? null;
      console.log("🔄 Changement d'événement, rechargement des points pour event_id:", eventId);

      try {
        const freshPoints = await invoke<any[]>("get_points", { eventId: eventId });
        console.log(`📍 ${freshPoints.length} point(s) récupéré(s) pour event ${eventId}`);

        pointsRef.current = freshPoints;
        setPoints(freshPoints);

        // Mettre à jour la source GeoJSON
        if (map.getSource("db-points")) {
          const geojson = {
            type: "FeatureCollection",
            features: freshPoints.map((p: any) => ({
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
          (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson as any);
        }
      } catch (err) {
        console.error("Erreur rechargement points:", err);
      }
    };

    reloadPoints();
  }, [selectedEvent, map]);

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
        const geoms = await invoke<GeometryData[]>("fetch_geometries_for_event", { eventId });
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
  const handleSelect = (place: any) => {
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
            query
          )}&format=json&limit=5`
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
  const openPopupForPoint = async (point: any) => {
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
      const freshPoints = await invoke<any[]>("get_points", { eventId: currentEventId || null });
      pointsRef.current = freshPoints;
      setPoints(freshPoints);

      // Mettre à jour le point sélectionné s'il existe encore
      if (selectedPoint) {
        const updatedPoint = freshPoints.find(p => p.id === selectedPoint.id);
        setSelectedPoint(updatedPoint || null);
      }

      // Mettre à jour la source GeoJSON
      if (map.getSource("db-points")) {
        const geojson = {
          type: "FeatureCollection",
          features: freshPoints.map((p: any) => ({
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
        (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson as any);
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
        const freshPoints = await invoke<any[]>("get_points", { eventId: currentEventId || null });
        console.log(`📍 ${freshPoints.length} point(s) récupéré(s) après import`);
        pointsRef.current = freshPoints;
        setPoints(freshPoints);

        // Mettre à jour la source GeoJSON
        if (currentMap.getSource("db-points")) {
          const geojson = {
            type: "FeatureCollection",
            features: freshPoints.map((p: any) => ({
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
          (currentMap.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson as any);
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
    } catch (err) { }
    return () => {
      try { if (map) map.getCanvas().style.cursor = ""; } catch (e) { }
    };
  }, [awaitingMapClick, map]);

  return (
    <div className="h-full flex bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
      {/* Frise chronologique en plein écran */}
      {isTimelineFullscreen && (
        <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col">
          <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-between">
            <h2 className="text-white font-bold text-xl">📅 Frise chronologique</h2>
            <button
              onClick={() => setIsTimelineFullscreen(false)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
            >
              ✕ Fermer
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <TimelineView 
              points={points} 
              onPointClick={openPopupForPoint}
              fullscreen={true}
            />
          </div>
        </div>
      )}

      {/* Panneau gauche: liste des points ou frise */}
      <div className="w-72 bg-white/90 backdrop-blur-md border-r border-gray-200 shadow-lg flex flex-col z-20">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-lg">📍 Points</h3>
            <button
              onClick={handleAddPointClick}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${awaitingMapClick
                  ? 'bg-yellow-400 text-yellow-900 animate-pulse'
                  : 'bg-white/20 text-white hover:bg-white/30'
                }`}
            >
              {awaitingMapClick ? '⏳ Cliquez' : '+ Ajouter'}
            </button>
          </div>
          {/* Toggle Liste / Frise */}
          <div className="flex bg-white/20 rounded-lg p-1">
            <button
              onClick={() => setSidebarMode("list")}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                sidebarMode === "list"
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              📋 Liste
            </button>
            <button
              onClick={() => setSidebarMode("timeline")}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                sidebarMode === "timeline"
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              📅 Frise
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {sidebarMode === "list" ? (
            // Mode Liste
            points.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-2">📭</div>
                <p>Aucun point</p>
                <p className="text-xs mt-1">Cliquez sur "Ajouter" puis sur la carte</p>
              </div>
            ) : (
              points.map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => openPopupForPoint(p)}
                  className="p-3 mb-2 bg-white rounded-xl border border-gray-100 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all duration-200 hover:translate-x-1"
                >
                  <div className="font-semibold text-gray-800">Point #{p.id}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {p.obstacles?.length || 0} obstacle(s) • {p.comments?.length || 0} commentaire(s)
                  </div>
                  {(p.pose || p.depose) && (
                    <div className="text-xs text-purple-600 mt-1">
                      {p.pose && `🕐 Pose: ${formatDateShort(p.pose)}`}
                      {p.pose && p.depose && ' • '}
                      {p.depose && `Dépose: ${formatDateShort(p.depose)}`}
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            // Mode Frise
            <div className="space-y-2">
              {points.filter(p => p.pose || p.depose).length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-2">📅</div>
                  <p>Aucun point avec dates</p>
                  <p className="text-xs mt-1">Ajoutez des dates pose/dépose aux points</p>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setIsTimelineFullscreen(true)}
                    className="w-full px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    🔍 Voir en plein écran
                  </button>
                  <TimelineView 
                    points={points} 
                    onPointClick={openPopupForPoint}
                    fullscreen={false}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Conteneur principal de la carte */}
      <div className="flex-1 flex flex-col">
        {/* Sélecteur d'événements et barre de recherche */}
        <div className="relative z-30 bg-gradient-to-r from-indigo-500 via-purple-600 to-blue-600 backdrop-blur-md p-4 shadow-lg">
          {/* Dégradé de transition en bas */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-b from-transparent to-white/20"></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-white font-medium">Événement :</label>
            </div>
            <select
              value={selectedEvent?.id || ""}
              onChange={(e) => handleEventChange(e.target.value)}
              className="max-w-xs px-4 py-2 bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent text-gray-800 font-medium transition-all duration-300 hover:bg-white hover:shadow-lg"
            >
              <option value="">Choisir un événement...</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.event_type === 'Marathon' && '🏃‍♂️'}
                  {event.event_type === 'Cyclisme' && '🚴‍♂️'}
                  {event.event_type === 'Trail' && '🥾'}
                  {!['Marathon', 'Cyclisme', 'Trail'].includes(event.event_type)}
                  {event.name || `Événement #${event.id}`}
                  {event.status === 'active' && ' 🟢'}
                  {event.status === 'planned' && ' 🔵'}
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
                className="w-full px-4 py-2 bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent text-gray-800 font-medium transition-all duration-300 hover:bg-white hover:shadow-lg"
              />

              {/* Liste de suggestions */}
              <div className={`absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 max-h-40 overflow-y-auto transition-all duration-300 ease-out z-50 ${results.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none h-0 mt-0'}`}>
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-all duration-200 hover:pl-5"
                    onClick={() => handleSelect(r)}
                  >
                    <div className="text-sm text-gray-800">{r.display_name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Conteneur de la carte et panneau détails */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Carte */}
          <div ref={mapContainer} className="flex-1 h-full" />

          {/* Barre d'outils de dessin flottante - visible uniquement si un événement est sélectionné */}
          {selectedEvent && (
            <div className="absolute top-4 left-4 z-10">
              <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                {/* Bouton toggle */}
                <button
                  onClick={() => setIsDrawingToolsOpen(!isDrawingToolsOpen)}
                  className={`w-full px-4 py-3 flex items-center gap-2 font-medium transition-all duration-200 ${isDrawingToolsOpen
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <span className="text-lg">🛠️</span>
                  <span>Outils</span>
                  <span className={`ml-auto transition-transform duration-200 ${isDrawingToolsOpen ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {/* Panneau d'outils */}
                {isDrawingToolsOpen && (
                  <div className="p-3 border-t border-gray-100 space-y-2">
                    <p className="text-xs text-gray-500 mb-2">Dessiner une géométrie :</p>

                    {/* Bouton Polygone */}
                    <button
                      onClick={startDrawPolygon}
                      disabled={!selectedEvent}
                      className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 ${drawingMode === "polygon"
                          ? 'bg-indigo-500 text-white shadow-md'
                          : selectedEvent
                            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      <span className="text-lg">⬡</span>
                      <span>Polygone (zone)</span>
                    </button>

                    {/* Bouton Ligne */}
                    <button
                      onClick={startDrawLine}
                      disabled={!selectedEvent}
                      className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 ${drawingMode === "line"
                          ? 'bg-green-500 text-white shadow-md'
                          : selectedEvent
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      <span className="text-lg">╱</span>
                      <span>Ligne (chemin)</span>
                    </button>

                    {/* Bouton Annuler */}
                    {drawingMode !== "none" && (
                      <button
                        onClick={cancelDrawing}
                        className="w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-all duration-200"
                      >
                        <span className="text-lg">✕</span>
                        <span>Annuler le dessin</span>
                      </button>
                    )}

                    {/* Message d'aide */}
                    {drawingMode !== "none" && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                        <p className="font-medium">💡 Instructions :</p>
                        {drawingMode === "polygon" && (
                          <p>Cliquez pour placer les sommets du polygone. Double-cliquez pour terminer.</p>
                        )}
                        {drawingMode === "line" && (
                          <p>Cliquez pour placer les points du chemin. Double-cliquez pour terminer.</p>
                        )}
                      </div>
                    )}

                    {!selectedEvent && (
                      <p className="text-xs text-amber-600 mt-2">
                        ⚠️ Sélectionnez un événement pour dessiner
                      </p>
                    )}

                    {/* Affichage du nombre de géométries et liste */}
                    {selectedEvent && geometries.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => setIsGeometryListOpen(!isGeometryListOpen)}
                          className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-800"
                        >
                          <span>📐 {geometries.length} géométrie(s)</span>
                          <span className={`transition-transform ${isGeometryListOpen ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {isGeometryListOpen && (
                          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                            {geometries.map((geom) => {
                              const { label, icon } = getGeometryTypeLabel(geom.geom);
                              const isSelected = selectedGeometryId === geom.id;
                              const isEditing = editingGeometryId === geom.id;

                              return (
                                <div
                                  key={geom.id}
                                  className={`p-2 rounded-lg text-xs transition-all ${isEditing
                                      ? 'bg-amber-100 border border-amber-300'
                                      : isSelected
                                        ? 'bg-indigo-100 border border-indigo-300'
                                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                                    }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <button
                                      onClick={() => highlightGeometry(isSelected ? null : geom)}
                                      className="flex items-center gap-1 text-left flex-1"
                                    >
                                      <span>{icon}</span>
                                      <span className="font-medium">{label} #{geom.id}</span>
                                    </button>

                                    {!editingGeometryId && (
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => startEditGeometry(geom)}
                                          className="p-1 rounded hover:bg-blue-100 text-blue-600"
                                          title="Modifier"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          onClick={() => handleDeleteGeometry(geom.id)}
                                          className="p-1 rounded hover:bg-red-100 text-red-600"
                                          title="Supprimer"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {isEditing && (
                                    <div className="mt-2 flex gap-1">
                                      <button
                                        onClick={saveEditGeometry}
                                        className="flex-1 px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                                      >
                                        ✓ Sauvegarder
                                      </button>
                                      <button
                                        onClick={cancelEditGeometry}
                                        className="flex-1 px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
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
          )}

          {/* Panneau droit: détails du point sélectionné OU formulaire d'ajout */}
          {(selectedPoint || addingPointCoords) && (
            <div className="w-96 bg-white/95 backdrop-blur-md border-l border-gray-200 shadow-lg flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {selectedPoint ? (
                  <PointDetails
                    point={selectedPoint}
                    onClose={() => setSelectedPoint(null)}
                    onRefresh={refreshPoints}
                  />
                ) : addingPointCoords ? (
                  <AddPointForm
                    initialCoords={addingPointCoords}
                    onClose={() => setAddingPointCoords(null)}
                    onSaved={() => {
                      setAddingPointCoords(null);
                      refreshPoints();
                    }}
                    eventId={selectedEventIdRef.current}
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OfflineMapLibre;
