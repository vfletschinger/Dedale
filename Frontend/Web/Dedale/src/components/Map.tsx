import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { invoke } from "@tauri-apps/api/core";
import PointDetails from "./PointDetails";
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
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(!!selectedEventId);

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
          setShowFilters(true);
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
    if (event) {
      setShowFilters(true);
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
    const fetchAndDisplayPoints = async (mapObj: maplibregl.Map) => {
      try {
        const points = await invoke<any[]>("get_points");

        pointsRef.current = points;

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
      fetchAndDisplayPoints(mapInstance);
    });

    const initialMarker = new maplibregl.Marker()
      .setLngLat([7.7635, 48.5465])
      .setPopup(new maplibregl.Popup().setText("Strasbourg !"))
      .addTo(mapInstance);

    setCurrentMarker(initialMarker);
    setMap(mapInstance);

    return () => mapInstance.remove();
  }, []);

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

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Panneau de filtres à gauche */}
      {showFilters && (
        <div className="w-80 bg-white/80 backdrop-blur-md border-r border-white/20 shadow-xl overflow-y-auto">
          <div className="p-6">
            {/* Header du panneau */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                🎯 Filtres d'Événement
              </h2>
              <button
                onClick={() => setShowFilters(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Événement sélectionné */}
            {selectedEvent && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Événement Sélectionné</h3>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">
                      {selectedEvent.event_type === 'Marathon' && '🏃‍♂️'}
                      {selectedEvent.event_type === 'Cyclisme' && '🚴‍♂️'}
                      {selectedEvent.event_type === 'Trail' && '🥾'}
                      {!['Marathon', 'Cyclisme', 'Trail'].includes(selectedEvent.event_type) && '🏆'}
                    </span>
                    <h4 className="font-bold text-gray-800">{selectedEvent.name}</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{selectedEvent.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className={`px-2 py-1 rounded-full ${
                      selectedEvent.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : selectedEvent.status === 'planned'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedEvent.status}
                    </span>
                    <span>📐 {selectedEvent.geometries?.length || 0} géométries</span>
                  </div>
                </div>
              </div>
            )}

            {/* Filtres de géométrie */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Filtres de Géométrie</h3>
              <div className="space-y-2">
                {['Parcours', 'Zone de départ', 'Zone d\'arrivée', 'Ravitaillement', 'Point médical', 'Zone interdite', 'Point de contrôle', 'Zone de sécurité'].map((type) => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded"
                      defaultChecked
                    />
                    <span className="text-sm text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
                Appliquer les filtres
              </button>
              <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteneur principal de la carte */}
      <div className="flex-1 flex flex-col">
        {/* Sélecteur d'événements */}
        <div className="bg-gradient-to-r from-indigo-500 via-purple-600 to-blue-600 backdrop-blur-md border-b border-white/20 p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">🎯</span>
              <label className="text-white font-medium">Sélectionner un événement :</label>
            </div>
            <select
              value={selectedEvent?.id || ""}
              onChange={(e) => handleEventChange(e.target.value)}
              className="flex-1 max-w-md px-4 py-2 bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent text-gray-800 font-medium"
            >
              <option value="">Choisir un événement...</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.event_type === 'Marathon' && '🏃‍♂️'} 
                  {event.event_type === 'Cyclisme' && '🚴‍♂️'} 
                  {event.event_type === 'Trail' && '🥾'} 
                  {!['Marathon', 'Cyclisme', 'Trail'].includes(event.event_type) && '🏆'} 
                  {event.name || `Événement #${event.id}`}
                  {event.status === 'active' && ' 🟢'}
                  {event.status === 'planned' && ' 🔵'}
                </option>
              ))}
            </select>
            {selectedEvent && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <span>📐 {selectedEvent.geometries?.length || 0} géométries</span>
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
        <div className="bg-white/80 backdrop-blur-md border-b border-white/20 p-4">
          <div className="flex gap-3">
            {!showFilters && (
              <button
                onClick={() => setShowFilters(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg"
              >
                🎯 Filtres
              </button>
            )}
            <input
              type="text"
              placeholder="🔍 Rechercher un lieu..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
            />
          </div>

          {/* Liste de suggestions */}
          {results.length > 0 && (
            <div className="mt-3 bg-white rounded-xl shadow-lg border border-gray-200 max-h-40 overflow-y-auto">
              {results.map((r, i) => (
                <div
                  key={i}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                  onClick={() => handleSelect(r)}
                >
                  <div className="text-sm text-gray-800">{r.display_name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conteneur de la carte */}
        <div ref={mapContainer} className="flex-1" />
      </div>
    </div>
  );
}

export default OfflineMapLibre;
