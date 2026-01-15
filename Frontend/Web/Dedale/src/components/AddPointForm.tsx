import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTag } from "@fortawesome/free-solid-svg-icons";

export default function AddPointForm({
  initialCoords,
  onClose,
  onSaved,
  eventId,
}: {
  initialCoords: { lng: number; lat: number };
  onClose?: () => void;
  onSaved?: () => void;
  eventId?: string | null;
}) {
  const [x, _setX] = useState<number>(initialCoords.lng);
  const [y, _setY] = useState<number>(initialCoords.lat);
  const [name, setName] = useState<string>("Point 1");
  const [comment, setComment] = useState<string>("");
  const [type, setType] = useState<string>("info");
  const [status, setStatus] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    async function loadPointCount() {
      if (!eventId) return;

      try {
        const points = await invoke<{ id: string; event_id: string; x: number; y: number; name: string | null; comment: string | null; type: string | null; status: boolean }[]>("fetch_points", { eventId });
        const nextPointNumber = points.length + 1;
        setName(`Point ${nextPointNumber}`);
      } catch (error) {
        console.error("Erreur lors du chargement des points:", error);
      }
    }

    loadPointCount();
  }, [eventId]);

  async function handleSave() {
    if (!eventId) {
      toast.error("Impossible d'enregistrer : aucun événement sélectionné");
      console.error("Tentative d'enregistrement sans eventId");
      return;
    }

    setSaving(true);
    try {
      const point = {
        id: "",
        event_id: eventId,
        x: Number(x),
        y: Number(y),
        name: name.trim() || null,
        comment: comment || null,
        type: type || null,
        status: status,
      };

      console.log("[AddPoint] Envoi du point:", JSON.stringify(point, null, 2));
      console.log("[AddPoint] Event ID:", eventId);
      const insertedIds = await invoke<string[]>("insert_point", {
        point
      });
      console.log("[AddPoint] Point inséré avec succès, IDs:", insertedIds);

      if (onSaved) onSaved();
      if (onClose) onClose();
      toast.success("Point ajouté avec succès");
    } catch (err) {
      console.error("Failed to insert point:", err);
      toast.error("Erreur lors de l'enregistrement du point");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Nouveau point</h2>
            <p className="text-gray-500 text-sm mt-1">
              Créer un nouveau point d'intérêt
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Nom du point */}
        <div>
          <label htmlFor="point-name" className="block text-sm font-semibold text-gray-900 mb-2">
            Nom du point
          </label>
          <input
            id="point-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Entrer le nom du point"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
          />
        </div>

        {/* Type et Statut Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 flex items-center gap-2">
            <span className="text-xl text-purple-600"><FontAwesomeIcon icon={faTag} /></span>
            <span className="font-semibold text-gray-800">Type et Statut</span>
          </div>
          <div className="p-4 space-y-3">
            {/* Type */}
            <div>
              <label htmlFor="point-type" className="block text-sm font-semibold text-gray-900 mb-2">
                Type
              </label>
              <select
                id="point-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
              >
                <option value="info">Information</option>
                <option value="danger">Danger</option>
                <option value="obstacle">Obstacle</option>
                <option value="point">Point</option>
              </select>
            </div>

            {/* Statut */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={status}
                onChange={(e) => setStatus(e.target.checked)}
                className="w-4 h-4 text-secondary border-gray-300 rounded focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-700">Marquer comme traité</span>
            </label>
          </div>
        </div>

        {/* Commentaire */}
        <div>
          <label htmlFor="point-comment" className="block text-sm font-semibold text-gray-900 mb-2">
            Commentaire (optionnel)
          </label>
          <textarea
            id="point-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ajouter un commentaire..."
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white resize-none"
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
        <button
          onClick={onClose}
          disabled={saving}
          className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2.5 bg-secondary hover:bg-secondary/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Enregistrement..." : "Ajouter le point"}
        </button>
      </div>
    </div>
  );
}
