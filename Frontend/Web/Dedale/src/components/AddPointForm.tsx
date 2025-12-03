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
  eventId?: number | null;
}) {
  const [x, setX] = useState<number>(initialCoords.lng);
  const [y, setY] = useState<number>(initialCoords.lat);
  const [comment, setComment] = useState<string>("");
  const [mergedObstacles, setMergedObstacles] = useState<any[]>([]);
  const [pictures, setPictures] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pose, setPose] = useState<string>("");
  const [depose, setDepose] = useState<string>("");

  useEffect(() => {
    // initially fetch obstacle types to let user add obstacles
    fetchTypes();
  }, []);

  async function fetchTypes() {
    try {
      const types: any[] = await invoke("fetch_obstacle_types");

      const merged = types.map((type) => ({
        typeId: type.id,
        name: type.name,
        description: type.description,
        width: type.width,
        length: type.length,
        number: 0,
        obstacleId: null,
      }));

      setMergedObstacles(merged);
    } catch (err) {
      console.error("fetchTypes error", err);
    }
  }

  function incrementObstacle(typeId: number) {
    setMergedObstacles((prev) =>
      prev.map((o) => (o.typeId === typeId ? { ...o, number: o.number + 1 } : o))
    );
  }

  function decrementObstacle(typeId: number) {
    setMergedObstacles((prev) =>
      prev.map((o) => (o.typeId === typeId ? { ...o, number: Math.max(0, o.number - 1) } : o))
    );
  }

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
    // Validation : dépose ne peut pas être antérieure à pose
    if (pose && depose) {
      const poseDate = new Date(pose);
      const deposeDate = new Date(depose);
      if (deposeDate < poseDate) {
        alert("⚠️ La date de dépose ne peut pas être antérieure à la date de pose.");
        return;
      }
    }
    
    setSaving(true);
    try {
      // Prepare obstacles in backend-friendly shape (snake_case -> full Obstacle shape expected by insert_point_details)
      const obstaclesSnake = mergedObstacles
        .filter((o) => o.number && o.number > 0)
        .map((o) => ({
          id: 0,
          point_id: 0,
          type_id: Number(o.typeId),
          number: Number(o.number),
          name: o.name ?? null,
          description: o.description ?? null,
          width: o.width ?? null,
          length: o.length ?? null,
        }));

      const comments = comment
        ? [{ id: 0, point_id: 0, value: comment }]
        : [];

      const picturesPayload = pictures.map((p) => ({ id: 0, point_id: 0, image: p.startsWith("data:") ? p : `data:image/png;base64,${p}` }));

      // Build PointDetail shape expected by Rust `insert_point_details`
      const detail = {
        point: {
          id: 0,
          x: Number(x),
          y: Number(y),
          pose: pose || null,
          depose: depose || null,
        },
        comments: comments,
        pictures: picturesPayload,
        obstacles: obstaclesSnake,
      };

      console.log("📍 Envoi du point:", JSON.stringify(detail, null, 2));
      console.log("🎯 Event ID:", eventId);
      const insertedIds = await invoke<number[]>("insert_point", { 
        details: [detail], 
        eventId: eventId || null 
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
    <div className="h-full flex flex-col bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
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
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100 flex items-center gap-2">
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
          <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 flex items-center gap-2">
            <span className="text-xl">🕐</span>
            <span className="font-semibold text-gray-800">Dates Pose / Dépose</span>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date et heure de pose</label>
              <input
                type="datetime-local"
                value={pose}
                onChange={(e) => setPose(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date et heure de dépose</label>
              <input
                type="datetime-local"
                value={depose}
                onChange={(e) => setDepose(e.target.value)}
                min={pose || undefined}
                className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 transition-all ${
                  pose && depose && new Date(depose) < new Date(pose)
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-200'
                }`}
              />
              {pose && depose && new Date(depose) < new Date(pose) && (
                <p className="text-red-500 text-xs mt-1">⚠️ La dépose doit être après la pose</p>
              )}
            </div>
          </div>
        </div>

        {/* Commentaire Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center gap-2">
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

        {/* Obstacles Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 flex items-center gap-2">
            <span className="text-xl">🚧</span>
            <span className="font-semibold text-gray-800">Obstacles</span>
            <span className="px-2 py-0.5 bg-orange-200 text-orange-800 text-xs font-medium rounded-full">
              {mergedObstacles.filter(o => o.number > 0).length} sélectionné(s)
            </span>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {mergedObstacles.map((o) => (
              <div 
                key={o.typeId} 
                className={`p-3 transition-colors ${o.number > 0 ? 'bg-orange-50/50' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{o.name}</div>
                    <div className="text-xs text-gray-500 truncate">{o.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => decrementObstacle(o.typeId)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-colors"
                    >
                      −
                    </button>
                    <div className={`w-8 text-center font-bold text-lg ${o.number > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                      {o.number}
                    </div>
                    <button
                      onClick={() => incrementObstacle(o.typeId)}
                      className="w-8 h-8 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Photos Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 flex items-center gap-2">
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
          className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50"
        >
          {saving ? "⏳ Enregistrement..." : "✓ Ajouter le point"}
        </button>
      </div>
    </div>
  );
}
