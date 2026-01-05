import React, { useEffect, useState } from "react";
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
  eventId?: string | number | null;
}) {
  const [x, setX] = useState<number>(initialCoords.lng);
  const [y, setY] = useState<number>(initialCoords.lat);
  const [name, setName] = useState<string>("Nouveau point");
  const [comment, setComment] = useState<string>("");
  const [pictures, setPictures] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Component mounted
  }, []);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const results: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64 = await toBase64(file);
      // strip mime prefix if needed, keep data URI
      results.push(base64);
    }
    setPictures((prev) => [...prev, ...results]);
  }

  function toBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSave() {

    if (!eventId) {
      alert("Erreur : Impossible d'enregistrer. Aucun événement n'est sélectionné.");
      console.error("Tentative d'enregistrement sans eventId");
      return;
    }
    
    setSaving(true);
    try {
      const comments = comment
        ? [{ id: "", point_id: "", value: comment }]
        : [];

      const picturesPayload = pictures.map((p) => ({ id: "", point_id: "", image: p.startsWith("data:") ? p : `data:image/png;base64,${p}` }));

      // Build PointDetail shape expected by Rust `insert_point_details`
      const detail = {
        point: {
          id: "",
          event_id: eventId,
          x: Number(x),
          y: Number(y),
          name: name || "Nouveau point",
          pose: null,
          depose: null,
        },
        comments: comments,
        pictures: picturesPayload,
        obstacles: [],
      };

      console.log("📍 Envoi du point:", JSON.stringify(detail, null, 2));
      console.log("🎯 Event ID:", eventId);
      const insertedIds = await invoke<string[]>("insert_point", { 
        details: [detail], 
        event_id: eventId || null 
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
        {/* Nom du point Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-linear-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center gap-2">
            <span className="text-xl">🏷️</span>
            <span className="font-semibold text-gray-800">Nom du point</span>
          </div>
          <div className="p-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nouveau point"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50 transition-all"
            />
          </div>
        </div>

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

        {/* Photos Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-linear-to-r from-green-50 to-emerald-50 border-b border-green-100 flex items-center gap-2">
            <span className="text-xl">📸</span>
            <span className="font-semibold text-gray-800">Photos</span>
            {pictures.length > 0 && (
              <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-medium rounded-full">
                {pictures.length}
              </span>
            )}
          </div>
          <div className="p-4">
            <label className="block cursor-pointer">
              <input type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-emerald-400 hover:bg-emerald-50/50 transition-all">
                <div className="text-3xl mb-2">📷</div>
                <div className="text-sm text-gray-600">Cliquez ou glissez pour ajouter des photos</div>
              </div>
            </label>
            {pictures.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {pictures.map((p, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                    <img src={p} alt={`img-${i}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
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
  );
}
