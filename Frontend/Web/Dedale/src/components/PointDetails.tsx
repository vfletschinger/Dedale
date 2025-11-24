import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export type Obstacle = {
    id: number;
    name?: string | null;
    number?: number | null;
    description?: string | null;
    width?: number | null;
    length?: number | null;
};

export type Picture = {
    id: number;
    image: string;
};

export type CommentItem = {
    id: number;
    value: string;
};

export type Point = {
    id: number;
    x: number;
    y: number;
    obstacles: Obstacle[];
    comments: CommentItem[];
    pictures: Picture[];
};

export type ObstacleType = {
    id: number;
    name: string;
    description: string;
    width: number;
    length: number;
};

export default function PointDetails({ point, onClose, onRefresh }: { point: Point | null, onClose?: () => void, onRefresh?: () => void }) {
    const [showObstaclesPopup, setShowObstaclesPopup] = useState(false);
    const [_, setObstacleTypes] = useState<ObstacleType[]>([]);
    const [mergedObstacles, setMergedObstacles] = useState<any[]>([]);

    useEffect(() => {
        if (showObstaclesPopup && point) {
            get_types();
        }
    }, [showObstaclesPopup, point]);

    async function get_types() {
        try {
            const types: ObstacleType[] = await invoke("fetch_obstacle_types");
            setObstacleTypes(types);

            // Fusionner les types avec les obstacles du point
            const merged = types.map(type => {
                const existing = point?.obstacles.find(o => o.name === type.name);
                return {
                    typeId: type.id,
                    name: type.name,
                    description: type.description,
                    width: type.width,
                    length: type.length,
                    number: existing?.number ?? 0,
                    obstacleId: existing?.id ?? null,
                };
            });
            setMergedObstacles(merged);
        } catch (error) {
            console.error("Failed to fetch obstacle types:", error);
        }
    }

    function incrementObstacle(typeId: number) {
        setMergedObstacles(prev =>
            prev.map(o =>
                o.typeId === typeId ? { ...o, number: o.number + 1 } : o
            )
        );
    }

    function decrementObstacle(typeId: number) {
        setMergedObstacles(prev =>
            prev.map(o =>
                o.typeId === typeId ? { ...o, number: Math.max(0, o.number - 1) } : o
            )
        );
    }

    async function saveObstacles() {
        try {
            if (point) {
                await invoke('insert_obstacles', {
                    pointId: point.id,
                    obstacles: mergedObstacles,
                });
                setShowObstaclesPopup(false);
                if (onRefresh) {
                    onRefresh();
                }
            }
        } catch (error) {
            console.error("Failed to save obstacles:", error);
        }
    }

    if (!point) {
        return (
            <div className="point-popup" style={{ minWidth: 260 }}>
                <div className="pp-card">Aucune donnée pour ce point.</div>
                <div style={{ marginTop: 8 }}>
                    <button onClick={onClose} className="button">Fermer</button>
                </div>
            </div>
        );
    }

    const resolveImageSrc = (path: string) => {
        if (!path) return "";
        if (path.startsWith("data:")) return path;
        // path like "/images/point1_photo1.jpg" -> serve by dev server / production frontend
        if (path.startsWith("/")) return `${window.location.origin}${path}`;
        return `${window.location.origin}/${path}`;
    };

    return (
        <div className="point-popup" style={{ minWidth: 300 }}>
            <div className="pp-header">
                <div className="pp-title">Point #{point.id}</div>
                <button onClick={onClose} className="pp-close" aria-label="Fermer">✕</button>
            </div>

            <div className="pp-section">
                <div className="pp-section-title">Coordonnées</div>
                <div className="pp-coords">{point.x.toFixed(3)}, {point.y.toFixed(3)}</div>
            </div>

            <div className="pp-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="pp-section-title">Obstacles ({point.obstacles.length})</div>
                    <button onClick={() => setShowObstaclesPopup(true)} className="action-primary">modifier</button>
                </div>

                {showObstaclesPopup && (
                    <div className="pp-card" style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        zIndex: 1000,
                        minWidth: 280,
                        maxHeight: 400,
                        overflowY: "auto"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <strong>Modification des obstacles</strong>
                            <button onClick={() => setShowObstaclesPopup(false)} className="pp-close">✕</button>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {mergedObstacles.map(o => (
                                <li key={o.typeId} style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{o.name ?? "Type inconnu"}</div>
                                            <div className="muted">{o.description}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <button onClick={() => decrementObstacle(o.typeId)} className="action-ghost">−</button>
                                            <div style={{ minWidth: 28, textAlign: 'center' }}>{o.number}</div>
                                            <button onClick={() => incrementObstacle(o.typeId)} className="action-primary">+</button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button onClick={() => setShowObstaclesPopup(false)} className="action-ghost">Annuler</button>
                            <button onClick={() => saveObstacles()} className="action-primary">Enregistrer</button>
                        </div>
                    </div>
                )}

                <ul className="pp-list">
                    {point.obstacles.map(o => (
                        <li key={o.id}>
                            <div><em>{o.name ?? "Type inconnu"}</em> x {o.number ?? "-"}</div>
                            {o.description ? <div className="muted">{o.description}</div> : null}
                            <div className="muted">L×l: {o.length ?? "-"} × {o.width ?? "-"}</div>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="pp-section">
                <div className="pp-section-title">Commentaires ({point.comments.length})</div>
                <ul className="pp-list">
                    {point.comments.map(c => <li key={c.id}>{c.value}</li>)}
                </ul>
            </div>

            <div className="pp-section">
                <div className="pp-section-title">Photos ({point.pictures.length})</div>
                <div className="pp-photo-grid">
                    {point.pictures.map(p => (
                        <img
                            key={p.id}
                            alt={`pic-${p.id}`}
                            src={resolveImageSrc(p.image)}
                            className="pp-photo"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}