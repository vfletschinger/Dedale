import React, { useEffect } from "react";

interface MapToolbarProps {
  selectedEventId: string | null; // Changed to string
  drawingMode: string;
  awaitingMapClick: boolean;
  onAddPointClick: () => void;
  onStartDrawPolygon: () => void;
  onStartDrawLine: () => void;
  onStartDrawInterest: () => void;
  onStartDrawEquipment: () => void;
  onCancelDrawing: () => void;
  onCancelPointAddition: () => void;
}

const MapToolbar: React.FC<MapToolbarProps> = ({
  selectedEventId,
  drawingMode,
  awaitingMapClick,
  onAddPointClick,
  onStartDrawPolygon,
  onStartDrawLine,
  onStartDrawInterest,
  onStartDrawEquipment,
  onCancelDrawing,
  onCancelPointAddition,
}) => {
  useEffect(() => {
    const handleCancelEvent = () => {
      onCancelPointAddition();
    };

    window.addEventListener("cancel-map-action", handleCancelEvent);
    return () => {
      window.removeEventListener("cancel-map-action", handleCancelEvent);
    };
  }, [onCancelPointAddition]);

  if (!selectedEventId) return null;

  return (
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
          onClick={onAddPointClick}
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
          onClick={onStartDrawPolygon}
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
          onClick={onStartDrawLine}
          className={`px-2 py-2 rounded-lg shadow-lg flex items-center justify-center transition-all ${
            drawingMode === "parcours"
              ? "bg-red-500 text-white"
              : "bg-white hover:bg-gray-50 text-gray-700"
          }`}
          title="Parcours (Ligne)"
        >
          <span className="text-base">╱</span>
        </button>
        <button
          onClick={onStartDrawInterest}
          className={`px-2 py-2 rounded-lg shadow-lg flex items-center justify-center transition-all ${
            drawingMode === "interest"
              ? "bg-purple-600 text-white"
              : "bg-black/30 hover:bg-black/40 backdrop-blur-sm text-white"
          }`}
          title="Point d'intérêt"
        >
          <span className="text-base font-bold">?</span>
        </button>

        <button
          onClick={onStartDrawEquipment}
          className={`px-2 py-2 rounded-lg shadow-lg flex items-center justify-center transition-all ${
            drawingMode === "equipment"
              ? "bg-green-600 text-white"
              : "bg-white hover:bg-gray-50 text-gray-700"
          }`}
          title="Équipement"
        >
          <span className="text-base">🚧</span>
        </button>

        {(drawingMode !== "none" || awaitingMapClick) && (
          <button
            onClick={() => {
              if (drawingMode !== "none") onCancelDrawing();
              if (awaitingMapClick) {
                onCancelPointAddition();
                window.dispatchEvent(new Event("cancel-map-action"));
              }
            }}
            className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg text-sm font-semibold flex items-center gap-1"
          >
            <span>✕ Annuler</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default MapToolbar;
