import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { invoke } from "@tauri-apps/api/core";

// Composants
import PointDetails from "./PointDetails";
import AddPointForm from "./AddPointForm";
import TimelinePanel from "./TimelinePanel";
import AddressSearch from "./AdressSearch";
import ParcoursForm from "./ParcoursForm";
import InterestForm from "./InterestForm";

// Hooks personnalisés
import { useMapPoints } from "../hooks/useMapPoints";
import { useMapGeometries } from "../hooks/useMapGeometries";

// Types et Utils
import { MapEvent, SearchResult } from "../types/map";

function OfflineMapLibre({
  selectedEventId,
}: {
  selectedEventId: number | null;
}) {
  // --- ÉTATS GLOBAUX DU COMPOSANT ---
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  // Gestion des événements (Sélecteur en haut à gauche)
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);

  // Gestion de l'affichage (Vue Carte vs Timeline)
  const [viewMode, setViewMode] = useState<"points" | "timeline">("points");

  // Gestion du marqueur d'adresse (Recherche)
  const [currentMarker, setCurrentMarker] = useState<maplibregl.Marker | null>(
    null
  );

  // Calcul de l'ID actif (soit celui sélectionné dans la liste, soit celui passé en props)
  const activeEventId = selectedEvent?.id ?? selectedEventId;

  // --- APPEL DES HOOKS ---

  // 1. Logique des POINTS
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
  } = useMapPoints(map, activeEventId);

  // 2. Logique des GÉOMÉTRIES (Zones & Parcours)
  const {
    zones,
    parcours,
    drawingMode,
    selectedGeometry,
    editingGeometry,
    isGeometryListOpen,
    setIsGeometryListOpen,
    startDrawPolygon,
    startDrawLine,
    cancelDrawing,
    saveEditGeometry,
    handleDeleteGeometry,
    startEditGeometry,
    cancelEditGeometry,
    highlightGeometry,
    pendingParcoursGeometry,
    pendingInterestGeometry,
    saveParcoursWithDetails,
    cancelParcoursForm,
  } = useMapGeometries(map, activeEventId);

  // --- EFFETS (Chargement initial) ---

  // Initialisation de la carte MapLibre
  useEffect(() => {
    if (map || !mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: "http://localhost:8080/styles/basic-preview/style.json",
      center: [7.7635, 48.5465],
      zoom: 13,
    });

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

  // Charger la liste des événements
  useEffect(() => {
    const loadAllEvents = async () => {
      try {
        const allEvents = await invoke<MapEvent[]>("fetch_events");
        setEvents(allEvents);

        if (selectedEventId) {
          const ev = allEvents.find((e) => e.id === selectedEventId);
          if (ev) setSelectedEvent(ev);
        }
      } catch (err) {
        console.error("Erreur chargement événements:", err);
      }
    };
    loadAllEvents();
  }, [selectedEventId]);

  // --- GESTIONNAIRES D'INTERFACE ---

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
            {/* Barre de recherche */}
            <AddressSearch onSelect={handleAddressSelect} />
          </div>
        </div>

        {/* Onglets Navigation */}
        <div className="flex items-center gap-2 px-4 mt-3 border-t border-slate-600">
          <button
            onClick={() => setViewMode("points")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              viewMode === "points"
                ? "text-white border-blue-400"
                : "text-slate-400 border-transparent hover:text-slate-200"
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
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              viewMode === "timeline"
                ? "text-white border-blue-400"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>📅</span>
              <span>Frise chronologique</span>
            </span>
          </button>
        </div>
      </div>

      {/* --- CONTENU PRINCIPAL --- */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANNEAU LATÉRAL (Gauche) */}
        {viewMode === "points" && (
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
                  point={selectedPoint}
                  onClose={() => setSelectedPoint(null)}
                  onRefresh={refreshPoints}
                />
              </div>
            ) : (
              // Mode: Liste des points
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {points.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p className="text-5xl mb-3">📭</p>
                    <p className="font-semibold text-gray-700">Aucun point</p>
                    <p className="text-sm mt-2">
                      Sélectionnez un événement et ajoutez des points sur la
                      carte.
                    </p>
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
                          <span>📍</span> Point #{p.id}
                        </span>
                        <button className="text-blue-600 text-xs font-semibold px-2 py-1 rounded hover:bg-blue-50">
                          Voir →
                        </button>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                          📷 {p.pictures?.length || 0}
                        </span>
                        {p.status && (
                          <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
                            ✓ Traité
                          </span>
                        )}
                      </div>
                      {p.comment && (
                        <div className="text-xs text-gray-500 mt-2 line-clamp-1">
                          💬 {p.comment}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* TIMELINE */}
        {viewMode === "timeline" && (
          <div className="w-1/2 bg-white border-r border-gray-200 shadow-lg flex flex-col z-20">
            <TimelinePanel points={points} onPointClick={openPopupForPoint} />
          </div>
        )}

        {/* CARTE */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div ref={mapContainer} className="flex-1 h-full" />

          {/* OUTILS FLOTTANTS (Sur la carte) */}
          {activeEventId && (
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
              
              {/* Message d'aide */}
              {(drawingMode !== "none" || awaitingMapClick) && (
                <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
                  {awaitingMapClick
                    ? "📍 Cliquez sur la carte pour placer le point"
                    : "Double-cliquez pour terminer le dessin"}
                </div>
              )}

              {/* Barre d'outils */}
              <div className="flex gap-2">
                <button
                  onClick={handleAddPointClick}
                  className={`px-2 py-2 rounded-lg shadow-lg flex items-center justify-center transition-all ${
                    awaitingMapClick
                      ? "bg-amber-500 text-white animate-pulse"
                      : "bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                  title="Ajouter un point"
                >
                  <span className="text-base">📍</span>
                </button>

                <button
                  onClick={startDrawPolygon}
                  className={`px-2 py-2 rounded-lg shadow-lg flex items-center justify-center transition-all ${
                    drawingMode === "zone"
                      ? "bg-blue-600 text-white"
                      : "bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                  title="Zone (Polygone)"
                >
                  <span className="text-base">⬡</span>
                </button>

                <button
                  onClick={startDrawLine}
                  className={`px-2 py-2 rounded-lg shadow-lg flex items-center justify-center transition-all ${
                    drawingMode === "parcours"
                      ? "bg-green-600 text-white"
                      : "bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                  title="Parcours (Ligne)"
                >
                  <span className="text-base">╱</span>
                </button>

                {(drawingMode !== "none" || awaitingMapClick) && (
                  <button
                    onClick={() => {
                      if (drawingMode !== "none") cancelDrawing();
                      if (awaitingMapClick) {
                        setAddingPointCoords(null);
                        // Hack pour forcer l'annulation si le state awaitingMapClick n'est pas exposé directement
                        window.dispatchEvent(new Event("cancel-map-action")); 
                      }
                    }}
                    className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg text-sm font-semibold flex items-center gap-1"
                  >
                    <span>✕ Annuler</span>
                  </button>
                )}
              </div>

              {/* Liste des Zones et Parcours (Dropdown) */}
              {(zones.length > 0 || parcours.length > 0) && (
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden max-w-sm mt-2">
                  <button
                    onClick={() => setIsGeometryListOpen(!isGeometryListOpen)}
                    className="w-full px-4 py-2 flex justify-between items-center text-sm font-semibold hover:bg-gray-50"
                  >
                    <span>
                      📐 {zones.length + parcours.length} élément(s)
                    </span>
                    <span
                      className={`transform transition-transform ${
                        isGeometryListOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▼
                    </span>
                  </button>

                  {isGeometryListOpen && (
                    <div className="max-h-60 overflow-y-auto bg-gray-50 border-t border-gray-200">
                      
                      {/* --- SECTION ZONES --- */}
                      {zones.length > 0 && (
                        <div>
                          <div className="px-3 py-1 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Zones
                          </div>
                          {zones.map((zone) => {
                            const itemData = { ...zone, type: "zone" as const };
                            const isSelected = selectedGeometry?.id === zone.id && selectedGeometry?.type === "zone";
                            const isEditing = editingGeometry?.id === zone.id && editingGeometry?.type === "zone";

                            return (
                              <div
                                key={`zone-${zone.id}`}
                                className={`p-2 border-b border-gray-200 last:border-0 ${
                                  isSelected
                                    ? "bg-blue-50"
                                    : isEditing
                                    ? "bg-amber-50"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <button
                                    // On passe itemData qui contient type: 'zone'
                                    onClick={() =>
                                      highlightGeometry(
                                        isSelected ? null : itemData
                                      )
                                    }
                                    className="text-left flex-1 text-xs font-medium truncate"
                                  >
                                    <span className="mr-2 text-base">🟦</span>{" "}
                                    {zone.name || `Zone #${zone.id}`}
                                  </button>

                                  {!isEditing && (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() =>
                                          startEditGeometry(itemData)
                                        }
                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                        title="Modifier"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        // On passe le type 'zone' explicitement
                                        onClick={() =>
                                          handleDeleteGeometry(zone.id, "zone")
                                        }
                                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                                        title="Supprimer"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {isEditing && (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={saveEditGeometry}
                                      className="flex-1 bg-green-600 text-white text-xs py-1 rounded"
                                    >
                                      Sauver
                                    </button>
                                    <button
                                      onClick={cancelEditGeometry}
                                      className="flex-1 bg-gray-500 text-white text-xs py-1 rounded"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* --- SECTION PARCOURS --- */}
                      {parcours.length > 0 && (
                        <div>
                          <div className="px-3 py-1 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider border-t border-gray-200">
                            Parcours
                          </div>
                          {parcours.map((p) => {
                            const itemData = { ...p, type: "parcours" as const };
                            const isSelected = selectedGeometry?.id === p.id && selectedGeometry?.type === "parcours";
                            const isEditing = editingGeometry?.id === p.id && editingGeometry?.type === "parcours";

                            return (
                              <div
                                key={`parcours-${p.id}`}
                                className={`p-2 border-b border-gray-200 last:border-0 ${
                                  isSelected
                                    ? "bg-blue-50"
                                    : isEditing
                                    ? "bg-amber-50"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <button
                                    onClick={() =>
                                      highlightGeometry(
                                        isSelected ? null : itemData
                                      )
                                    }
                                    className="text-left flex-1"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-base">〰️</span>
                                      <div className="flex-1">
                                        <div className="text-xs font-medium truncate">
                                          {p.name || `Parcours #${p.id}`}
                                        </div>
                                        {(p.start_time || p.speed_low || p.speed_high) && (
                                          <div className="text-[10px] text-gray-500 mt-0.5">
                                            {p.start_time && (
                                              <div>📅 {new Date(p.start_time).toLocaleString('fr-FR', { 
                                                day: '2-digit', 
                                                month: '2-digit', 
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}</div>
                                            )}
                                            {(p.speed_low || p.speed_high) && (
                                              <div>🏃 {p.speed_low || 0} - {p.speed_high || 0} km/h</div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </button>

                                  {!isEditing && (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() =>
                                          startEditGeometry(itemData)
                                        }
                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteGeometry(p.id, "parcours")
                                        }
                                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {isEditing && (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={saveEditGeometry}
                                      className="flex-1 bg-green-600 text-white text-xs py-1 rounded"
                                    >
                                      Sauver
                                    </button>
                                    <button
                                      onClick={cancelEditGeometry}
                                      className="flex-1 bg-gray-500 text-white text-xs py-1 rounded"
                                    >
                                      Annuler
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
          )}
        </div>
      </div>

      {/* Formulaire de création de parcours */}
      {pendingParcoursGeometry && (
        <ParcoursForm
          onSubmit={saveParcoursWithDetails}
          onCancel={cancelParcoursForm}
        />
      )}
      {/* Formulaire de création de point d'intérêt */}
      {pendingInterestGeometry && (
        <InterestForm
          onSubmit={saveInterestWithDetails}
          onCancel={cancelInterestForm}
        />
      )}
    </div>
  );
}

export default OfflineMapLibre;