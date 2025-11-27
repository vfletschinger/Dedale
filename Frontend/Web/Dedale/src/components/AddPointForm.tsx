import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function AddPointForm({
  initialCoords,
  onClose,
  onSaved,
}: {
  initialCoords: { lng: number; lat: number };
  onClose?: () => void;
  onSaved?: () => void;
}) {
  const [x, setX] = useState<number>(initialCoords.lng);
  const [y, setY] = useState<number>(initialCoords.lat);
  const [comment, setComment] = useState<string>("");
  const [mergedObstacles, setMergedObstacles] = useState<any[]>([]);
  const [pictures, setPictures] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
        },
        comments: comments,
        pictures: picturesPayload,
        obstacles: obstaclesSnake,
      };

      await invoke("insert_point", { details: [detail] });

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
    <div className="point-popup" style={{ minWidth: 320 }}>

      <div className="pp-section">
        <div className="pp-section-title">Coordonnées</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            step="0.000001"
            value={x}
            onChange={(e) => setX(Number(e.target.value))}
            style={{ flex: 1, padding: 6 }}
          />
          <input
            type="number"
            step="0.000001"
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
            style={{ flex: 1, padding: 6 }}
          />
        </div>
      </div>

      <div className="pp-section">
        <div className="pp-section-title">Commentaire</div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ajouter un commentaire (optionnel)"
          style={{ width: "100%", minHeight: 64, padding: 6 }}
        />
      </div>

      <div className="pp-section">
        <div className="pp-section-title">Obstacles</div>
        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          {mergedObstacles.map((o) => (
            <div key={o.typeId} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{o.name}</div>
                <div className="muted">{o.description}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="action-ghost" onClick={() => decrementObstacle(o.typeId)}>-</button>
                <div style={{ minWidth: 28, textAlign: "center" }}>{o.number}</div>
                <button className="action-primary" onClick={() => incrementObstacle(o.typeId)}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pp-section">
        <div className="pp-section-title">Photos</div>
        <label className="upload-box">
          <input type="file" accept="image/*" multiple onChange={handleFiles} />
          <div>📷 Cliquez ou glissez pour ajouter des photos</div>
        </label>
        <div className="upload-preview">
          {pictures.map((p, i) => (
            <img key={i} src={p} alt={`img-${i}`} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
        <button className="button" onClick={onClose} disabled={saving}>
          Annuler
        </button>
        <button className="button" onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement..." : "Ajouter"}
        </button>
      </div>
    </div>
  );
}
