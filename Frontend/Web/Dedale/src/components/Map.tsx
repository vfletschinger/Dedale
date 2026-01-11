import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { Protocol } from "pmtiles";

// Composants
import PointDetails from "./PointDetails";
import AddPointForm from "./AddPointForm";
import TimelineBar from "./TimelineBar";
import AddressSearch from "./AdressSearch";
import ParcoursForm from "./ParcoursForm";
import InterestForm from "./InterestForm";
import EquipementForm from "./EquipementForm";
import MapToolbar from "./MapToolbar";
import MapGeometryList from "./MapGeometryList";

// Hooks personnalisés
import { useMapPoints } from "../hooks/useMapPoints";
import { useMapGeometries } from "../hooks/useMapGeometries";
import { useEvents } from "../hooks/useEvents";

// Types et Utils
import { SearchResult, MapEvent } from "../types/map";
import { getMapStyle } from "../utils/mapStyles";

function OfflineMapLibre({
  selectedEventId,
}: {
  selectedEventId: string | null;
}) {
  // --- ÉTATS GLOBAUX DU COMPOSANT ---
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  // Gestion de l'affichage (Vue Carte vs Timeline)
  const [viewMode, setViewMode] = useState<"points" | "timeline">("points");

  // État pour le filtre spatial (limites visibles de la carte)
  const [mapBounds, setMapBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  // Gestion du marqueur d'adresse (Recherche)
  const [currentMarker, setCurrentMarker] = useState<maplibregl.Marker | null>(
    null,
  );

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
    refreshInterest,
    openPopupForPoint,
  } = useMapPoints(map, selectedEventId);

  // 2. Logique des GÉOMÉTRIES (Zones & Parcours)
  const {
    zones,
    parcours,
    equipements,
    drawingMode,
    selectedGeometry,
    editingGeometry,
    isGeometryListOpen,
    setIsGeometryListOpen,
    startDrawPolygon,
    startDrawLine,
    startDrawInterest,
    startDrawEquipment,
    cancelDrawing,
    saveEditGeometry,
    handleDeleteGeometry,
    startEditGeometry,
    cancelEditGeometry,
    highlightGeometry,
    pendingParcoursGeometry,
    pendingInterestGeometry,
    saveParcoursWithDetails,
    saveInterestWithDetails,
    cancelParcoursForm,
    cancelInterestForm,
    pendingEquipmentData,
    saveEquipmentWithDetails,
    cancelEquipmentForm,
    handleDeleteEquipement,
  } = useMapGeometries(map, selectedEventId);

  // 3. Logique des ÉVÉNEMENTS
  const { events } = useEvents();
  const currentEvent: MapEvent | undefined = events.find(
    (e) => String(e.id) === String(selectedEventId),
  );

  // --- EFFETS (Chargement initial) ---

  // Initialisation de la carte MapLibre
  useEffect(() => {
    if (map || !mapContainer.current) return;

    // Enregistrer le protocole PMTiles
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    // Utilisation du style externe avec les nouvelles couleurs
    const mapStyle = getMapStyle();

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [7.7635, 48.5465],
      zoom: 17, // Zoom initial plus proche pour voir le détail
      maxZoom: 22, // Permettre le zoom très proche
    });

    const initialMarker = new maplibregl.Marker()
      .setLngLat([7.7635, 48.5465])
      .setPopup(new maplibregl.Popup().setText("Bienvenue à Strasbourg !"))
      .addTo(mapInstance);

    setCurrentMarker(initialMarker);
    setMap(mapInstance);

    return () => {
      maplibregl.removeProtocol("pmtiles");
      mapInstance.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mise à jour des limites visibles de la carte quand elle est déplacée/zoomée
  useEffect(() => {
    if (!map) return;

    const updateBounds = () => {
      const bounds = map.getBounds();
      setMapBounds({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    };

    // Mettre à jour au chargement
    updateBounds();

    // Ajouter les listeners pour les mouvements de la carte
    map.on("moveend", updateBounds);
    map.on("zoomend", updateBounds);
    map.on("resize", updateBounds);

    return () => {
      map.off("moveend", updateBounds);
      map.off("zoomend", updateBounds);
      map.off("resize", updateBounds);
    };
  }, [map]);

  // Forcer le recalcul des bounds quand la vue change (timeline ouverte/fermée)
  useEffect(() => {
    if (!map) return;

    // Attendre que le DOM soit mis à jour puis forcer le resize de la carte
    const timeout = setTimeout(() => {
      map.resize();
    }, 100);

    return () => clearTimeout(timeout);
  }, [map, viewMode]);

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
    map.flyTo({ center: [parseFloat(lon), parseFloat(lat)], zoom: 18 });
  };

  // --- RENDU ---
  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* --- HEADER --- */}
      <div className="bg-slate-700 shadow-lg shrink-0 z-30 relative">
        <div className="p-4 pb-0">
          <div className="flex items-center w-full">
            {/* Barre de recherche style Google Maps */}
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
                  eventId={selectedEventId}
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
          <div className="w-1/2 h-full bg-white border-r border-gray-200 shadow-lg flex flex-col z-20 overflow-hidden">
            {currentEvent ? (
              <TimelineBar
                event={currentEvent}
                points={points}
                equipements={equipements}
                onPointClick={openPopupForPoint}
                onClose={() => setViewMode("points")}
                onDateChange={() => {}}
                mapBounds={mapBounds}
              />
            ) : (
              <div className="p-4 bg-gray-100 text-center flex items-center justify-center h-full">
                <div>
                  <p className="text-5xl mb-3">📅</p>
                  <p className="font-semibold text-gray-700">
                    Aucun événement sélectionné
                  </p>
                  <p className="text-sm mt-2 text-gray-500">
                    Sélectionnez un événement pour voir la frise chronologique
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CARTE */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div ref={mapContainer} className="flex-1 h-full" />

          {/* OUTILS FLOTTANTS (Sur la carte) */}
          {selectedEventId && (
            <>
              <MapToolbar
                selectedEventId={selectedEventId}
                drawingMode={drawingMode}
                awaitingMapClick={awaitingMapClick}
                onAddPointClick={handleAddPointClick}
                onStartDrawPolygon={startDrawPolygon}
                onStartDrawLine={startDrawLine}
                onStartDrawInterest={startDrawInterest}
                onStartDrawEquipment={startDrawEquipment}
                onCancelDrawing={cancelDrawing}
                onCancelPointAddition={() => setAddingPointCoords(null)}
              />

              <div className="absolute top-[70px] left-4 z-10">
                <MapGeometryList
                  zones={zones}
                  parcours={parcours}
                  equipements={equipements}
                  isOpen={isGeometryListOpen}
                  setIsOpen={setIsGeometryListOpen}
                  selectedGeometry={
                    selectedGeometry
                      ? {
                          ...selectedGeometry,
                          type: selectedGeometry.type as "zone" | "parcours",
                        }
                      : null
                  }
                  editingGeometry={
                    editingGeometry
                      ? {
                          ...editingGeometry,
                          type: editingGeometry.type as "zone" | "parcours",
                        }
                      : null
                  }
                  onHighlight={highlightGeometry}
                  onStartEdit={(item) =>
                    startEditGeometry({
                      ...item,
                      type: item.type as "zone" | "parcours",
                    })
                  }
                  onSaveEdit={saveEditGeometry}
                  onCancelEdit={cancelEditGeometry}
                  onDeleteGeometry={handleDeleteGeometry}
                  onDeleteEquipement={handleDeleteEquipement}
                />
              </div>
            </>
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
          onSubmit={async (data) => {
            await saveInterestWithDetails(data);
            refreshInterest();
          }}
          onCancel={cancelInterestForm}
        />
      )}

      {/* Formulaire de création d'équipement */}
      {pendingEquipmentData && (
        <EquipementForm
          lineLength={pendingEquipmentData.lineLength}
          onSubmit={saveEquipmentWithDetails}
          onCancel={cancelEquipmentForm}
        />
      )}
    </div>
  );
}

export default OfflineMapLibre;
