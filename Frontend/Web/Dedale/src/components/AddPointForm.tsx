import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";



export default function AddPointForm({
  initialCoords,
  onClose,
  onSaved,
  eventId,
}: {
  initialCoords: { lng: number; lat: number };
  onClose?: () => void;
  onSaved?: () => void;
  eventId?: number | null;
}) {
  const [x, setX] = useState<number>(initialCoords.lng);
  const [y, setY] = useState<number>(initialCoords.lat);
  const [comment, setComment] = useState<string>("");
  const [type, setType] = useState<string>("info");
  const [status, setStatus] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  // Pas d'appels asynchrones initiaux car le schéma est simple

  async function handleSave() {
    if (!eventId) {
      alert("Erreur : Impossible d'enregistrer. Aucun événement n'est sélectionné.");
      console.error("Tentative d'enregistrement sans eventId");
      return;
    }
    
    setSaving(true);
    try {
      // Structure simple correspondant au schéma : id, event_id, x, y, comment, type, status
      const point = {
          id: "",
          event_id: eventId,
          x: Number(x),
          y: Number(y),
          comment: comment || null,
          type: type || null,
          status: status,
       
      };

      console.log("📍 Envoi du point:", JSON.stringify(point, null, 2));
      console.log("🎯 Event ID:", eventId);
      const insertedIds = await invoke<string[]>("insert_point", { 
        point 
      });
      console.log("✅ Point inséré avec succès, IDs:", insertedIds);

      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      console.error("Failed to insert point:", err);
      alert("Erreur lors de l'enregistrement du point.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-linear-to-b from-white to-gray-50">
      {/* Header */}
      <div className="p-4 bg-linear-to-r from-emerald-500 to-teal-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">➕ Nouveau Point</h2>
            <div className="text-white/80 text-sm mt-1">
              Ajoutez un point d'intérêt sur la carte
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Coordonnées Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-linear-to-r from-indigo-50 to-blue-50 border-b border-indigo-100 flex items-center gap-2">
            <span className="text-xl">📍</span>
            <span className="font-semibold text-gray-800">Coordonnées</span>
          </div>
          <div className="p-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={x}
                  onChange={(e) => setX(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={y}
                  onChange={(e) => setY(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dates Pose/Dépose Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-linear-to-r from-purple-50 to-pink-50 border-b border-purple-100 flex items-center gap-2">
            <span className="text-xl">🏷️</span>
            <span className="font-semibold text-gray-800">Type et Statut</span>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 transition-all"
              >
                <option value="info">ℹ️ Information</option>
                <option value="danger">⚠️ Danger</option>
                <option value="obstacle">🚧 Obstacle</option>
                <option value="point">📍 Point</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={status}
                  onChange={(e) => setStatus(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Marquer comme traité</span>
              </label>
            </div>
          </div>
        </div>

        {/* Commentaire Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-linear-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center gap-2">
            <span className="text-xl">💬</span>
            <span className="font-semibold text-gray-800">Commentaire</span>
          </div>
          <div className="p-4">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ajouter un commentaire (optionnel)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 resize-none transition-all"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-white flex gap-3">
        <button
          onClick={onClose}
          disabled={saving}
          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-3 bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50"
        >
          {saving ? "⏳ Enregistrement..." : "✓ Ajouter le point"}
        </button>
        </div>
      </div>
    </div>
  );
}
