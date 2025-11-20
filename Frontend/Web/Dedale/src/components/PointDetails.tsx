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

export default function PointDetails({ point, onClose }: { point: Point | null, onClose?: () => void }) {
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
                <strong>Obstacles ({point.obstacles.length})</strong>
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