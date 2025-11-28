import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { invoke } from "@tauri-apps/api/core";
import PointDetails from "./PointDetails";
import AddPointForm from "./AddPointForm";
import ReactDOM from "react-dom/client";

function OfflineMapLibre({ selectedEventId }: { selectedEventId: number | null }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [currentMarker, setCurrentMarker] = useState<maplibregl.Marker | null>(
    null
  );
  const [currentPopup, setCurrentPopup] = useState<maplibregl.Popup | null>(null);
  const pointsRef = useRef<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [awaitingMapClick, setAwaitingMapClick] = useState(false);
  const awaitingMapClickRef = useRef(false);
  const selectedEventIdRef = useRef<number | null>(null);

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
            const coords = (f.geometry as any).coordinates.slice();
            const pointId = f.properties?.id;

            // Remove previous popup
            if (currentPopup) {
              currentPopup.remove();
              setCurrentPopup(null);
            }

            // DOM Setup
            const container = document.createElement("div");
            container.style.maxWidth = "600px";
            container.style.maxHeight = "600px";
            container.style.width = "350px";
            container.style.height = "450px";
            container.style.overflow = "auto";
            container.style.padding = "8px";

            const popup = new maplibregl.Popup({
              offset: 12,
              closeButton: false,
              className: "custom-popup",
            })
              .setLngLat(coords)
              .setDOMContent(container)
              .addTo(mapObj);

            setCurrentPopup(popup);
            const root = ReactDOM.createRoot(container);

            const handleClose = () => popup.remove();

            const renderPopupUI = () => {
              const freshPoint = pointsRef.current.find(
                (p) => String(p.id) === String(pointId)
              );

              // If point was deleted, close the popup
              if (!freshPoint) {
                handleClose();
                return;
              }

              root.render(
                <PointDetails
                  point={freshPoint}
                  onClose={handleClose}
                  onRefresh={async () => {
                    await fetchAndDisplayPoints(mapObj);
                    renderPopupUI();
                  }}
                />
              );
            };

            // Initial render
            renderPopupUI();

            // Cleanup
            popup.on("close", () => {
              setTimeout(() => root.unmount(), 0);
              setCurrentPopup(null);
            });
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

            // Remove previous popup
            if (currentPopup) {
              currentPopup.remove();
              setCurrentPopup(null);
            }

            // DOM Setup for AddPointForm
            const container = document.createElement("div");
            container.style.maxWidth = "400px";
            container.style.maxHeight = "500px";
            container.style.width = "360px";
            container.style.overflow = "auto";
            container.style.padding = "8px";

            const popup = new maplibregl.Popup({
              offset: 12,
              closeButton: true,
              className: "custom-popup add-point-popup",
            })
              .setLngLat([lng, lat])
              .setDOMContent(container)
              .addTo(mapObj);

            setCurrentPopup(popup);
            const root = ReactDOM.createRoot(container);

            const handleClose = () => popup.remove();
            const handleSaved = async () => {
              console.log("🔄 handleSaved appelé - rafraîchissement des points...");
              popup.remove();
              try {
                const currentEventId = selectedEventIdRef.current;
                const freshPoints = await invoke<any[]>("get_points", { eventId: currentEventId || null });
                console.log(`📍 ${freshPoints.length} point(s) après refresh pour event ${currentEventId}`);
                pointsRef.current = freshPoints;
                setPoints(freshPoints);
                
                // Mettre à jour la source GeoJSON
                if (mapObj.getSource("db-points")) {
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
                  (mapObj.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson as any);
                }
              } catch (err) {
                console.error("Erreur refresh points:", err);
              }
            };

            root.render(
              <AddPointForm
                initialCoords={{ lng, lat }}
                onClose={handleClose}
                onSaved={handleSaved}
                eventId={selectedEventIdRef.current}
              />
            );

            popup.on("close", () => {
              setTimeout(() => root.unmount(), 0);
              setCurrentPopup(null);
            });
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

  // Ouvre un popup pour un point (utilisé par la liste à gauche)
  const openPopupForPoint = async (point: any) => {
    if (!map || !point) return;
    const coords: [number, number] = [Number(point.x), Number(point.y)];
    map.flyTo({ center: coords, zoom: 15 });
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
    <div className="h-screen flex bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
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

        {/* Conteneur de la carte */}
        <div ref={mapContainer} className="flex-1" />
      </div>
    </div>
  );
}

export default OfflineMapLibre;
