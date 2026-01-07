import { useMemo, useState, useEffect } from "react";
import { MapPoint, MapEvent } from "../types/map";

interface TimelineBarProps {
  event: MapEvent;
  points: MapPoint[];
  onPointClick: (point: MapPoint) => void;
  onClose: () => void;
  onDateChange: (date: Date | null) => void; // Callback pour notifier la date du slider
}

function TimelineBar({ event, points, onPointClick, onClose, onDateChange }: TimelineBarProps) {
  // État du slider (valeur de 0 à 100)
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [isFilterActive, setIsFilterActive] = useState(false);

  // Calculer les bornes de la timeline
  const { startDate, endDate, totalDuration } = useMemo(() => {
    const start = event.start_date ? new Date(event.start_date) : new Date();
    const end = event.end_date ? new Date(event.end_date) : new Date();
    return {
      startDate: start,
      endDate: end,
      totalDuration: end.getTime() - start.getTime(),
    };
  }, [event.start_date, event.end_date]);

  // Calculer la date correspondant à la position du slider
  const currentSliderDate = useMemo(() => {
    if (totalDuration === 0) return startDate;
    return new Date(startDate.getTime() + (sliderValue / 100) * totalDuration);
  }, [sliderValue, startDate, totalDuration]);

  // Notifier le parent quand la date change
  useEffect(() => {
    if (isFilterActive) {
      onDateChange(currentSliderDate);
    } else {
      onDateChange(null);
    }
  }, [currentSliderDate, isFilterActive, onDateChange]);

  // Filtrer les points qui ont des dates de pose/dépose
  const pointsWithDates = useMemo(() => {
    return points.filter((p) => p.pose || p.depose);
  }, [points]);

  // Calculer la position en % sur la timeline
  const getPositionPercent = (dateStr: string | null | undefined): number => {
    if (!dateStr || totalDuration === 0) return 0;
    const date = new Date(dateStr);
    const offset = date.getTime() - startDate.getTime();
    return Math.max(0, Math.min(100, (offset / totalDuration) * 100));
  };

  // Formater une date pour l'affichage
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Formater une heure courte
  const formatTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Générer les graduations de la timeline
  const graduations = useMemo(() => {
    const grads: { percent: number; label: string }[] = [];
    const steps = 6; // Nombre de graduations
    for (let i = 0; i <= steps; i++) {
      const percent = (i / steps) * 100;
      const time = new Date(startDate.getTime() + (totalDuration * i) / steps);
      grads.push({
        percent,
        label: time.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }
    return grads;
  }, [startDate, totalDuration]);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 shadow-2xl z-30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-700 text-white">
        <div className="flex items-center gap-3">
          <span className="text-lg">📅</span>
          <span className="font-semibold">Timeline de l'événement</span>
          <span className="text-sm text-slate-300">
            {formatDate(startDate)} → {formatDate(endDate)}
          </span>
        </div>
        
        {/* Bouton toggle filtre */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFilterActive(!isFilterActive)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              isFilterActive
                ? "bg-amber-500 text-white"
                : "bg-slate-600 text-slate-300 hover:bg-slate-500"
            }`}
          >
            <span>🔍</span>
            <span>{isFilterActive ? "Filtre actif" : "Activer le filtre"}</span>
          </button>
          
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-600 rounded-lg transition-colors"
            title="Fermer la timeline"
          >
            <span className="text-xl">✕</span>
          </button>
        </div>
      </div>

      {/* Affichage de la date sélectionnée quand le filtre est actif */}
      {isFilterActive && (
        <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-4">
          <span className="text-amber-800 font-semibold text-sm">
            📍 Date sélectionnée :
          </span>
          <span className="text-amber-900 font-bold">
            {currentSliderDate.toLocaleDateString("fr-FR", {
              weekday: "short",
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="text-amber-600 text-sm ml-auto">
            Seuls les équipements présents à cette date sont affichés sur la carte
          </span>
        </div>
      )}

      {/* Timeline */}
      <div className="px-6 py-4">
        {/* Graduations */}
        <div className="relative h-6 mb-2">
          {graduations.map((grad, i) => (
            <div
              key={i}
              className="absolute transform -translate-x-1/2 text-xs text-gray-500"
              style={{ left: `${grad.percent}%` }}
            >
              {grad.label}
            </div>
          ))}
        </div>

        {/* Barre principale */}
        <div className="relative h-16 bg-gray-100 rounded-lg border border-gray-200">
          {/* Graduations verticales */}
          {graduations.map((grad, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-gray-300"
              style={{ left: `${grad.percent}%` }}
            />
          ))}

          {/* Slider (curseur temporel) */}
          {isFilterActive && (
            <>
              {/* Ligne verticale du curseur */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-20 pointer-events-none"
                style={{ left: `${sliderValue}%` }}
              >
                {/* Triangle indicateur en haut */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-amber-500" />
              </div>
              
              {/* Input range invisible pour le drag */}
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={sliderValue}
                onChange={(e) => setSliderValue(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
              />
            </>
          )}

          {/* Points/Équipements */}
          {pointsWithDates.map((point) => {
            const posePercent = getPositionPercent(point.pose);
            const deposePercent = getPositionPercent(point.depose);
            const hasBoth = point.pose && point.depose;

            return (
              <div key={point.id} className="absolute top-2 bottom-2">
                {/* Barre de durée (si pose ET dépose) */}
                {hasBoth && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-3 bg-blue-400 rounded-full opacity-60"
                    style={{
                      left: `${posePercent}%`,
                      width: `${deposePercent - posePercent}%`,
                    }}
                  />
                )}

                {/* Marqueur Pose */}
                {point.pose && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer group"
                    style={{ left: `${posePercent}%` }}
                    onClick={() => onPointClick(point)}
                  >
                    <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md hover:scale-125 transition-transform" />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                      <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                        <div className="font-semibold">{point.name || `Point #${point.id}`}</div>
                        <div className="text-green-400">📥 Pose: {formatTime(point.pose)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Marqueur Dépose */}
                {point.depose && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer group"
                    style={{ left: `${deposePercent}%` }}
                    onClick={() => onPointClick(point)}
                  >
                    <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-md hover:scale-125 transition-transform" />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                      <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                        <div className="font-semibold">{point.name || `Point #${point.id}`}</div>
                        <div className="text-red-400">📤 Dépose: {formatTime(point.depose)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Légende */}
        <div className="flex items-center gap-6 mt-3 text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>Pose</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span>Dépose</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-2 bg-blue-400 rounded-full opacity-60" />
            <span>Durée d'installation</span>
          </div>
          <div className="text-gray-400 ml-auto">
            {pointsWithDates.length} équipement{pointsWithDates.length > 1 ? "s" : ""} avec dates
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimelineBar;
