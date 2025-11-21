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
            <div style={{ padding: 12, minWidth: 260 }}>
                <div>Aucune donnée pour ce point.</div>
                <button onClick={onClose}>Fermer</button>
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
        <div style={{ padding: 12, minWidth: 300, fontFamily: "sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Point #{point.id}</strong>
                <button onClick={onClose}>✕</button>
            </div>

            <div style={{ marginTop: 8 }}>
                <div><strong>Coordonnées :</strong> {point.x.toFixed(3)}, {point.y.toFixed(3)}</div>
            </div>

            <div style={{ marginTop: 10 }}>
                <strong>Obstacles ({point.obstacles.length}) <button onClick={() => setShowObstaclesPopup(true)}>[modifier]</button></strong>
                {showObstaclesPopup && (
                    <div style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        backgroundColor: "white",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        padding: "12px",
                        zIndex: 1000,
                        minWidth: "280px",
                        maxHeight: "400px",
                        overflowY: "auto"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <strong>Modification des obstacles</strong>
                            <button onClick={() => setShowObstaclesPopup(false)}>✕</button>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: "20px" }}>
                            {mergedObstacles.map(o => (
                                <li key={o.id}>
                                    <div><em>{o.name ?? "Type inconnu"}</em> x {o.number ?? "-"} <button onClick={() => decrementObstacle(o.typeId)}>[-]</button> <button onClick={() => incrementObstacle(o.typeId)}>[+]</button></div>
                                </li>
                            ))}
                        </ul>
                        <button onClick={() => saveObstacles()}>[Save]</button>
                    </div>
                )}
                <ul>
                    {point.obstacles.map(o => (
                        <li key={o.id}>
                            <div><em>{o.name ?? "Type inconnu"}</em> x {o.number ?? "-"}</div>
                            {o.description ? <div style={{ fontSize: 12 }}>{o.description}</div> : null}
                            <div style={{ fontSize: 12 }}>L×l: {o.length ?? "-"} × {o.width ?? "-"}</div>
                        </li>
                    ))}
                </ul>
            </div>

            <div style={{ marginTop: 10 }}>
                <strong>Commentaires ({point.comments.length})</strong>
                <ul>
                    {point.comments.map(c => <li key={c.id}>{c.value}</li>)}
                </ul>
            </div>

            <div style={{ marginTop: 10 }}>
                <strong>Photos ({point.pictures.length})</strong>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {point.pictures.map(p => (
                        <div key={p.id} style={{ width: 100, height: 80, overflow: "hidden", border: "1px solid #ddd" }}>
                            <img
                                alt={`pic-${p.id}`}
                                src={resolveImageSrc(p.image)}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}