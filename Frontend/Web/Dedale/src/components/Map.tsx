import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Composants
import PointDetails, { type Point } from "./PointDetails";
import GeometryDetails from "./GeometryDetails";
import AddPointForm from "./AddPointForm";
import AddressSearch from "./AdressSearch";
import TimelineBar from "./TimelineBar";

// Hooks personnalisés
import { useMapPoints } from "../hooks/useMapPoints";
import { useMapGeometries } from "../hooks/useMapGeometries";

// Types et Utils
import { MapEvent, SearchResult } from "../types/map";
import { formatDateShort } from "../utils/maputils";

function OfflineMapLibre({
  selectedEventId,
}: {
  selectedEventId: string | null;
}) {
  // --- ÉTATS GLOBAUX DU COMPOSANT ---
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  
  // Gestion des événements (Sélecteur en haut à gauche)
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  
  // Gestion du marqueur d'adresse (Recherche)
  const [currentMarker, setCurrentMarker] = useState<maplibregl.Marker | null>(null);
  
  // Gestion de la timeline
  const [showTimeline, setShowTimeline] = useState(false);
  const [filterDate, setFilterDate] = useState<Date | null>(null);

  // Calcul de l'ID actif (soit celui sélectionné dans la liste, soit celui passé en props)
  const activeEventId = selectedEvent?.id ?? selectedEventId;

  // --- APPEL DES HOOKS ---
  // Toute la logique des points est ici
  const {
    points,
    selectedPoint,
    setSelectedPoint,
    addingPointCoords,
    setAddingPointCoords,
    awaitingMapClick,
    handleAddPointClick,
    refreshPoints,
    openPopupForPoint,
    updateMapSource,
  } = useMapPoints(map, activeEventId);

  // Toute la logique des géométries est ici
  const {
    drawingMode,
    selectedGeometry,
    setSelectedGeometry,
    startDrawPolygon,
    startDrawLine,
    cancelDrawing,
    loadGeometries,
  } = useMapGeometries(map, activeEventId);

  // --- FILTRAGE DES POINTS SELON LA DATE DU SLIDER ---
  // Un équipement est "présent" si : pose <= filterDate ET (depose > filterDate OU pas de dépose)
  const filteredPoints = useMemo(() => {
    if (!filterDate) return points; // Pas de filtre actif = tous les points
    
    return points.filter((p) => {
      // Si pas de date de pose, on ne peut pas déterminer si l'équipement est présent
      if (!p.pose) return false;
      
      const poseDate = new Date(p.pose);
      
      // L'équipement doit être posé avant ou à la date du slider
      if (poseDate > filterDate) return false;
      
      // Si pas de dépose, l'équipement reste présent indéfiniment après la pose
      if (!p.depose) return true;
      
      // Sinon, vérifier que la dépose n'a pas encore eu lieu
      const deposeDate = new Date(p.depose);
      return deposeDate > filterDate;
    });
  }, [points, filterDate]);

  // Mettre à jour la carte quand les points filtrés changent
  useEffect(() => {
    if (map) {
      updateMapSource(filteredPoints);
    }
  }, [filteredPoints, map, updateMapSource]);

  // --- EFFETS (Synchronisation des sélections) ---
  
  // Quand on sélectionne un point, désélectionner la géométrie
  useEffect(() => {
    if (selectedPoint) {
      setSelectedGeometry(null);
    }
  }, [selectedPoint, setSelectedGeometry]);

  // Quand on sélectionne une géométrie, désélectionner le point
  useEffect(() => {
    if (selectedGeometry) {
      setSelectedPoint(null);
    }
  }, [selectedGeometry, setSelectedPoint]);

  // --- EFFETS (Chargement initial) ---

  // Fonction pour charger les événements
  const loadAllEvents = useCallback(async () => {
    try {
      const allEvents = await invoke<MapEvent[]>("fetch_events");
      setEvents(allEvents);
      console.log("📋 Événements chargés:", allEvents.length);
      return allEvents;
    } catch (err) {
      console.error("Erreur chargement événements:", err);
      return [];
    }
  }, []);

  // 1. Initialisation de la carte MapLibre
  useEffect(() => {
    if (map || !mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: "http://localhost:8082/styles/basic-preview/style.json",
      center: [7.7635, 48.5465],
      zoom: 13,
    });

    // Petit marqueur de bienvenue à Strasbourg
    const initialMarker = new maplibregl.Marker()
      .setLngLat([7.7635, 48.5465])
      .setPopup(new maplibregl.Popup().setText("Bienvenue à Strasbourg !"))
      .addTo(mapInstance);

    setCurrentMarker(initialMarker);
    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Charger la liste des événements pour le menu déroulant
  useEffect(() => {
    const initEvents = async () => {
      const allEvents = await loadAllEvents();
      
      // Si un ID est passé en props, on sélectionne l'événement correspondant
      if (selectedEventId) {
        const ev = allEvents.find(e => e.id === selectedEventId);
        if (ev) setSelectedEvent(ev);
      } else if (allEvents.length > 0 && !selectedEvent) {
        // Sinon, sélectionner automatiquement le premier événement
        setSelectedEvent(allEvents[0]);
      }
    };
    initEvents();
  }, [selectedEventId, loadAllEvents]);

  // 3. Écouter les événements Tauri pour rafraîchir la liste dynamiquement
  useEffect(() => {
    const unlisten = listen("events-updated", async () => {
      console.log("🔄 Événement 'events-updated' reçu, rechargement...");
      const allEvents = await loadAllEvents();
      // Si l'événement sélectionné n'existe plus, désélectionner
      if (selectedEvent && !allEvents.find(e => e.id === selectedEvent.id)) {
        setSelectedEvent(allEvents[0] || null);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [loadAllEvents, selectedEvent]);

  // --- GESTIONNAIRES D'INTERFACE ---

  // Quand on sélectionne une adresse dans la barre de recherche
  const handleAddressSelect = (place: SearchResult) => {
    if (!map) return;
    const { lon, lat, display_name } = place;

    if (currentMarker) currentMarker.remove();

    const marker = new maplibregl.Marker()
      .setLngLat([parseFloat(lon), parseFloat(lat)])
      .setPopup(new maplibregl.Popup().setText(display_name))
      .addTo(map);

    setCurrentMarker(marker);
    map.flyTo({ center: [parseFloat(lon), parseFloat(lat)], zoom: 15 });
  };

  // --- RENDU ---
  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      
      {/* --- HEADER --- */}
      <div className="bg-slate-700 shadow-lg shrink-0">
        <div className="p-4 pb-0">
          <div className="flex items-center gap-3">
            {/* Sélecteur d'événement */}
            <div className="flex items-center gap-2">
              <label className="text-white font-semibold text-base flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <span>Événement</span>
              </label>
              <select
                value={selectedEvent?.id || ""}
                onChange={(e) => {
                  const event = events.find((ev) => ev.id === e.target.value);
                  setSelectedEvent(event ?? null);
                }}
                className="min-w-[200px] px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold cursor-pointer"
              >
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
            </div>

            {/* Barre de recherche (Composant extrait) */}
            <AddressSearch onSelect={handleAddressSelect} />
          </div>
        </div>
      </div>

      {/* --- CONTENU PRINCIPAL --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* PANNEAU LATÉRAL (Gauche) */}
        <div className="w-96 bg-white border-r border-gray-200 shadow-lg flex flex-col z-20">
            {addingPointCoords ? (
              // Mode: Ajout d'un point
              <div className="flex-1 overflow-y-auto">
                <AddPointForm
                  initialCoords={addingPointCoords}
                  onClose={() => setAddingPointCoords(null)}
                  onSaved={() => {
                    setAddingPointCoords(null);
                    refreshPoints();
                  }}
                  eventId={activeEventId}
                />
              </div>
            ) : selectedPoint ? (
              // Mode: Détails d'un point sélectionné
              <div className="flex-1 overflow-y-auto">
                <PointDetails
                  point={{
                    ...selectedPoint,
                    name: selectedPoint.name,
                    obstacles: (selectedPoint.obstacles || []).map(o => ({ ...o, id: o.id ?? 0 })),
                    comments: selectedPoint.comments || [],
                    pictures: selectedPoint.pictures || [],
                  } as Point}
                  onClose={() => setSelectedPoint(null)}
                  onRefresh={refreshPoints}
                />
              </div>
            ) : selectedGeometry ? (
              // Mode: Détails d'une géométrie sélectionnée (zone ou ligne)
              <div className="flex-1 overflow-y-auto">
                <GeometryDetails
                  geometry={selectedGeometry}
                  onClose={() => setSelectedGeometry(null)}
                  onRefresh={loadGeometries}
                />
              </div>
            ) : (
              // Mode: Liste des points
              <>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {points.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p className="text-5xl mb-3">📭</p>
                      <p className="font-semibold text-gray-700">Aucun point</p>
                      <p className="text-sm mt-2">Sélectionnez un événement et ajoutez des points sur la carte.</p>
                    </div>
                  ) : (
                    points.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => openPopupForPoint(p)}
                        className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer group"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-gray-800 text-sm flex gap-2">
                            <span>📍</span> {p.name || `Point #${p.id}`}
                          </span>
                          <button className="text-blue-600 text-xs font-semibold px-2 py-1 rounded hover:bg-blue-50">
                            Voir →
                          </button>
                        </div>
                        <div className="flex gap-2 text-xs">
                           {/* Badge pour commentaires */}
                           <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                             💬 {p.comments?.length || 0}
                           </span>
                        </div>
                        {(p.pose || p.depose) && (
                          <div className="text-xs text-gray-500 mt-2">
                             {p.pose ? formatDateShort(p.pose) : '...'} → {p.depose ? formatDateShort(p.depose) : '...'}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                
                {/* Bouton Timeline en bas du panneau */}
                {selectedEvent && (selectedEvent.start_date || selectedEvent.end_date) && (
                  <div className="p-3 border-t border-gray-200 bg-gray-50">
                    <button
                      onClick={() => setShowTimeline(!showTimeline)}
                      className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                        showTimeline
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-blue-400"
                      }`}
                    >
                      <span>📅</span>
                      <span>{showTimeline ? "Masquer la timeline" : "Afficher la timeline"}</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>


        {/* CARTE (Reste de l'espace) */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div ref={mapContainer} className="flex-1 h-full" />
          
          {/* Timeline en bas de la carte */}
          {showTimeline && selectedEvent && (
            <TimelineBar
              event={selectedEvent}
              points={points}
              onPointClick={openPopupForPoint}
              onClose={() => {
                setShowTimeline(false);
                setFilterDate(null); // Réinitialiser le filtre quand on ferme
              }}
              onDateChange={setFilterDate}
            />
          )}

          {/* OUTILS FLOTTANTS (Sur la carte) */}
          {activeEventId && (
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
              
              {/* Message d'aide */}
              {(drawingMode !== "none" || awaitingMapClick) && (
                <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
                  {awaitingMapClick ? "📍 Cliquez sur la carte pour placer le point" : "Double-cliquez pour terminer le dessin"}
                </div>
              )}

              {/* Barre d'outils */}
              <div className="flex gap-2">
                <button
                  onClick={handleAddPointClick}
                  className={`px-4 py-3 rounded-lg shadow-lg flex items-center justify-center transition-all ${
                    awaitingMapClick ? "bg-amber-500 text-white animate-pulse" : "bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                  title="Ajouter un point"
                >
                  <span className="text-xl">📍</span>
                </button>

                <button
                  onClick={startDrawPolygon}
                  className={`px-4 py-3 rounded-lg shadow-lg flex items-center justify-center transition-all ${
                    drawingMode === "polygon" ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                  title="Zone (Polygone)"
                >
                  <span className="text-xl">⬡</span>
                </button>

                <button
                  onClick={startDrawLine}
                  className={`px-4 py-3 rounded-lg shadow-lg flex items-center justify-center transition-all ${
                    drawingMode === "line" ? "bg-green-600 text-white" : "bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                  title="Parcours"
                >
                  <span className="text-xl">╱</span>
                </button>

                {(drawingMode !== "none" || awaitingMapClick) && (
                  <button
                    onClick={() => {
                        if (drawingMode !== "none") cancelDrawing();
                        if (awaitingMapClick) setAddingPointCoords(null); // Reset via hook logic handled implicitly
                        // Note: Le hook useMapPoints gère le setAwaitingMapClick(false) mais ici on force l'annulation UI
                        window.dispatchEvent(new Event('cancel-map-action')); // Simple trick ou appel direct si on expose setAwaiting
                    }}
                    className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg font-semibold flex items-center gap-2"
                  >
                    <span>✕ Annuler</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OfflineMapLibre;