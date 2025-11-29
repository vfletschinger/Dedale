import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { invoke } from "@tauri-apps/api/core";
import PointDetails from "./PointDetails";
import AddPointForm from "./AddPointForm";

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

function OfflineMapLibre({ selectedEventId }: { selectedEventId: number | null }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
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
    });

    const initialMarker = new maplibregl.Marker()
      .setLngLat([7.7635, 48.5465])
      .setPopup(new maplibregl.Popup().setText("Strasbourg !"))
      .addTo(mapInstance);

    setCurrentMarker(initialMarker);
    setMap(mapInstance);

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
      
      // Supprimer les anciennes couches de géométries
      if (map.getLayer("event-geometries-fill")) map.removeLayer("event-geometries-fill");
      if (map.getLayer("event-geometries-line")) map.removeLayer("event-geometries-line");
      if (map.getLayer("event-geometries-point")) map.removeLayer("event-geometries-point");
      if (map.getSource("event-geometries")) map.removeSource("event-geometries");

      if (!eventId) {
        setGeometries([]);
        return;
      }

      try {
        console.log("📐 Chargement des géométries pour event_id:", eventId);
        const geoms = await invoke<GeometryData[]>("fetch_geometries_for_event", { eventId });
        console.log(`📐 ${geoms.length} géométrie(s) récupérée(s)`);
        setGeometries(geoms);

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
        map.addSource("event-geometries", {
          type: "geojson",
          data: geojson,
        });

        // Ajouter la couche pour les polygones (fill)
        map.addLayer({
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
        map.addLayer({
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
        map.addLayer({
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

        console.log("✅ Géométries affichées sur la carte");
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
    } catch (err) {}
    return () => {
      try { if (map) map.getCanvas().style.cursor = ""; } catch (e) {}
    };
  }, [awaitingMapClick, map]);

  return (
    <div className="h-full flex bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
      {/* Panneau gauche: liste des points */}
      <div className="w-72 bg-white/90 backdrop-blur-md border-r border-gray-200 shadow-lg flex flex-col z-20">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-lg">📍 Points</h3>
            <button
              onClick={handleAddPointClick}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                awaitingMapClick
                  ? 'bg-yellow-400 text-yellow-900 animate-pulse'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {awaitingMapClick ? '⏳ Cliquez sur la carte' : '+ Ajouter'}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {points.length === 0 ? (
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
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conteneur principal de la carte */}
      <div className="flex-1 flex flex-col">
        {/* Sélecteur d'événements */}
        <div className="relative bg-gradient-to-r from-indigo-500 via-purple-600 to-blue-600 backdrop-blur-md p-4 shadow-lg">
          {/* Dégradé de transition en bas */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-b from-transparent to-white/20"></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-white font-medium">Sélectionner un événement :</label>
            </div>
            <select
              value={selectedEvent?.id || ""}
              onChange={(e) => handleEventChange(e.target.value)}
              className="flex-1 max-w-md px-4 py-2 bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent text-gray-800 font-medium transition-all duration-300 hover:bg-white hover:shadow-lg"
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
            {selectedEvent && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <span> {selectedEvent.geometries?.length || 0} géométries</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  selectedEvent.status === 'active' 
                    ? 'bg-green-400/20 text-green-100' 
                    : selectedEvent.status === 'planned'
                    ? 'bg-blue-400/20 text-blue-100'
                    : 'bg-gray-400/20 text-gray-100'
                }`}>
                  {selectedEvent.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="relative bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-md p-4 shadow-sm">
          {/* Dégradé de transition en bas vers la carte */}
          <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-b from-transparent to-slate-100/50"></div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="🔍 Rechercher un lieu..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all duration-300 hover:shadow-md focus:shadow-lg focus:bg-white"
            />
          </div>

          {/* Liste de suggestions */}
          <div className={`mt-3 bg-white rounded-xl shadow-lg border border-gray-200 max-h-40 overflow-y-auto transition-all duration-300 ease-out ${results.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none h-0 mt-0'}`}>
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

        {/* Conteneur de la carte et panneau détails */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Carte */}
          <div ref={mapContainer} className="flex-1 h-full" />
          
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
