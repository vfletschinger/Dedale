import { useRef, useState, useMemo } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { MapPoint, Obstacle } from "../types/map";

// Date initiale pour le calcul de la timeline (stable pour éviter les re-renders)
const INITIAL_NOW = Date.now();



export default function TimelinePanel({
  points,
  onPointClick,
}: {
  points: MapPoint[];
  onPointClick: (point: MapPoint) => void;
}) {
  const [obstacleFilter, setObstacleFilter] = useState<string>("all");
  const containerRef = useRef<HTMLDivElement>(null);

  const obstacleTypes = useMemo(() => {
    const types = new Set<string>();
    points.forEach((p) => {
      if (p.obstacles && Array.isArray(p.obstacles)) {
        p.obstacles.forEach((obs: Obstacle) => {
          const obsName = obs?.name;
          if (obsName) types.add(obsName);
        });
      }
    });
    return Array.from(types).sort();
  }, [points]);

  const pointHasObstacle = (point: MapPoint, obstacleName: string) => {
    if (!point.obstacles || !Array.isArray(point.obstacles)) return false;
    return point.obstacles.some((obs: Obstacle) => {
      const obsName = obs?.name;
      return obsName === obstacleName;
    });
  };

  const filteredPoints = useMemo(() => {
    let filtered;
    if (obstacleFilter === "all") {
      filtered = points.filter((p) => p.pose && p.depose);
    } else {
      filtered = points.filter(
        (p) => p.pose && p.depose && pointHasObstacle(p, obstacleFilter),
      );
    }
    return filtered.sort(
      (a, b) => new Date(a.pose!).getTime() - new Date(b.pose!).getTime(),
    );
  }, [points, obstacleFilter]);

  const timeRange = useMemo(() => {
    if (filteredPoints.length === 0) {
      return {
        min: INITIAL_NOW - 12 * 60 * 60 * 1000,
        max: INITIAL_NOW + 12 * 60 * 60 * 1000,
      };
    }

    const times = filteredPoints.flatMap((p) => [
      new Date(p.pose!).getTime(),
      new Date(p.depose!).getTime(),
    ]);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const padding = (max - min) * 0.1 || 3600000;

    return { min: min - padding, max: max + padding };
  }, [filteredPoints]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPosition = (timestamp: number) => {
    const range = timeRange.max - timeRange.min;
    if (range === 0) return 50;
    return ((timestamp - timeRange.min) / range) * 100;
  };

  const totalPointsWithDates = points.filter((p) => p.pose && p.depose).length;

  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const range = timeRange.max - timeRange.min;
    const step = range / 6; 
    for (let i = 0; i <= 6; i++) {
      markers.push(timeRange.min + step * i);
    }
    return markers;
  }, [timeRange]);

  if (totalPointsWithDates === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 bg-gray-50">
        <div className="text-center p-8">
          <div className="text-6xl mb-4 animate-bounce">📅</div>
          <p className="text-lg font-semibold text-gray-700 mb-2">
            Aucun point avec dates pose/dépose
          </p>
          <p className="text-sm text-gray-500 mt-2 bg-white/60 px-4 py-2 rounded-xl">
            Ajoutez des dates aux points pour les voir sur la frise
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Barre de filtre */}
      <div className="shrink-0 px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 shadow-sm">
        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span className="text-lg">🏷️</span>
          <span>Type d'obstacle:</span>
        </label>
        <select
          value={obstacleFilter}
          onChange={(e) => setObstacleFilter(e.target.value)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 font-medium text-gray-700"
        >
          <option value="all">Tous les points ({totalPointsWithDates})</option>
          {obstacleTypes.map((type) => {
            const count = points.filter(
              (p) => p.pose && p.depose && pointHasObstacle(p, type),
            ).length;
            return (
              <option key={type} value={type}>
                {type} ({count})
              </option>
            );
          })}
        </select>
        {obstacleFilter !== "all" && (
          <button
            onClick={() => setObstacleFilter("all")}
            className="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow"
          >
            ✕ Réinitialiser
          </button>
        )}
        <span className="text-xs text-gray-600 ml-auto font-semibold bg-white px-3 py-1 rounded-full border border-gray-200">
          {filteredPoints.length} point(s) affiché(s)
        </span>
      </div>

      {/* Timeline */}
      {filteredPoints.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center p-8">
            <div className="text-6xl mb-4 animate-bounce">🔍</div>
            <p className="text-base font-medium text-gray-700 mb-2">
              Aucun point avec l'obstacle "{obstacleFilter}"
            </p>
            <button
              onClick={() => setObstacleFilter("all")}
              className="mt-4 px-5 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
            >
              Voir tous les points
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col overflow-hidden"
          ref={containerRef}
        >
          {/* En-tête avec les marqueurs de temps */}
          <div className="shrink-0 flex border-b border-gray-200 bg-slate-700 shadow-md">
            <div className="w-24 shrink-0 px-2 py-2 text-xs font-bold text-white border-r border-slate-600 flex items-center justify-center">
              <span>📍 Points</span>
            </div>
            <div className="flex-1 relative h-8">
              {timeMarkers.map((time, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center"
                  style={{ left: `${(i / 6) * 100}%` }}
                >
                  <span className="text-[10px] text-white font-semibold whitespace-nowrap transform -translate-x-1/2 bg-slate-800/50 px-1.5 py-0.5 rounded">
                    {formatTime(time)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Corps de la timeline avec scroll */}
          <div className="flex-1 overflow-y-auto">
            {filteredPoints.map((point, index) => {
              const startPos = getPosition(new Date(point.pose!).getTime());
              const endPos = getPosition(new Date(point.depose!).getTime());
              const width = Math.max(endPos - startPos, 2);

              return (
                <div
                  key={point.id}
                  className={`flex border-b border-gray-100 transition-all duration-200 hover:bg-blue-50/50 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  style={{ height: "44px" }}
                >
                  {/* Label du point */}
                  <div className="w-24 shrink-0 px-2 flex items-center text-xs font-semibold text-gray-700 border-r border-gray-200 bg-gray-50">
                    Point #{point.id}
                  </div>

                  {/* Barre de temps */}
                  <div className="flex-1 relative">
                    {/* Grille verticale */}
                    {timeMarkers.map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-gray-200/60"
                        style={{ left: `${(i / 6) * 100}%` }}
                      />
                    ))}

                    {/* Bloc de durée */}
                    <div
                      onClick={() => onPointClick(point)}
                      className="absolute top-1.5 bottom-1.5 rounded-lg cursor-pointer transition-all duration-300 hover:scale-y-125 hover:shadow-lg hover:z-10 shadow-md group"
                      style={{
                        left: `${startPos}%`,
                        width: `${width}%`,
                        background:
                          "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                        minWidth: "24px",
                      }}
                      title={`Point #${point.id}\nPose: ${formatTime(new Date(point.pose!).getTime())}\nDépose: ${formatTime(new Date(point.depose!).getTime())}`}
                    >
                      <div className="h-full flex items-center justify-center px-1.5 overflow-hidden">
                        <span className="text-[10px] text-white font-bold truncate drop-shadow-sm group-hover:scale-110 transition-transform">
                          #{point.id}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
