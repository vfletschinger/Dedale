import { useMemo, useState, useEffect, useRef } from "react";
import { MapPoint, MapEvent, Equipement } from "../types/map";

// --- Types ---
interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface TimelineBarProps {
  event: MapEvent;
  points: MapPoint[];
  equipements?: Equipement[];
  onPointClick: (point: MapPoint) => void;
  onEquipementClick?: (equipement: Equipement) => void;
  onClose: () => void;
  onDateChange: (date: Date | null) => void;
  mapBounds?: MapBounds | null;
}

// --- Fonctions utilitaires ---

// Détermine l'intervalle d'affichage des heures (en ms) selon la durée totale
const getSmartInterval = (durationMs: number) => {
  const hour = 3600 * 1000;
  if (durationMs <= 24 * hour) return 1 * hour;      // < 24h : toutes les 1h
  if (durationMs <= 3 * 24 * hour) return 4 * hour;  // < 3j : toutes les 4h
  if (durationMs <= 7 * 24 * hour) return 12 * hour; // < 1 sem : toutes les 12h
  return 24 * hour;                                  // > 1 sem : 1 trait par jour
};

function TimelineBar({ 
  equipements = [], 
  onEquipementClick,
  onClose, 
  onDateChange, 
  mapBounds 
}: TimelineBarProps) {
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [isSpatialFilterActive, setIsSpatialFilterActive] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Calcul des bornes (Start / End) ET de la position initiale du slider
  const { startDate, endDate, totalDuration, initialSliderValue } = useMemo(() => {
    const allDates: number[] = [];
    
    equipements.forEach((eq) => {
      const addDate = (d?: string, h?: string) => {
        if (!d) return;
        if (d.includes('T')) allDates.push(new Date(d).getTime());
        else if (h) allDates.push(new Date(`${d}T${h}`).getTime());
      };
      addDate(eq.date_pose, eq.hour_pose);
      addDate(eq.date_depose, eq.hour_depose);
    });

    if (allDates.length === 0) {
      const now = new Date();
      now.setMinutes(0,0,0); // Arrondir
      return {
        startDate: now,
        endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        totalDuration: 24 * 60 * 60 * 1000,
        initialSliderValue: 0,
      };
    }

    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    
    // Padding : on commence au début de l'heure min et finit à la fin de l'heure max + margin
    const start = new Date(minDate);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - 1); // -1h de marge

    const end = new Date(maxDate);
    end.setMinutes(0, 0, 0);
    end.setHours(end.getHours() + 2); // +2h de marge

    const duration = end.getTime() - start.getTime();
    
    // Calculer la position initiale au niveau de la première date de pose
    const initialPercent = duration > 0 
      ? Math.max(0, Math.min(100, ((minDate.getTime() - start.getTime()) / duration) * 100))
      : 0;

    return {
      startDate: start,
      endDate: end,
      totalDuration: duration,
      initialSliderValue: initialPercent,
    };
  }, [equipements]);

  // État du slider initialisé avec la valeur calculée
  const [sliderValue, setSliderValue] = useState<number>(initialSliderValue);
  
  // Mettre à jour le slider quand la valeur initiale change (nouveaux équipements)
  useEffect(() => {
    setSliderValue(initialSliderValue);
  }, [initialSliderValue]);

  // 2. Calcul des blocs "Jours" (Ligne du haut)
  const dayBlocks = useMemo(() => {
    const blocks = [];
    const current = new Date(startDate);
    // On se cale sur minuit pour commencer proprement les jours suivants
    // Mais pour le premier jour, on garde l'heure de start
    
    while (current < endDate) {
      const startOfDay = new Date(current);
      const endOfDay = new Date(current);
      endOfDay.setHours(23, 59, 59, 999);

      // Le bloc commence au max entre (début timeline) et (début journée)
      const effectiveStart = startOfDay < startDate ? startDate : startOfDay;
      // Le bloc finit au min entre (fin timeline) et (fin journée)
      const effectiveEnd = endOfDay > endDate ? endDate : endOfDay;

      if (effectiveStart < effectiveEnd) {
        const duration = effectiveEnd.getTime() - effectiveStart.getTime();
        const widthPercent = (duration / totalDuration) * 100;
        const leftPercent = ((effectiveStart.getTime() - startDate.getTime()) / totalDuration) * 100;

        blocks.push({
          label: startOfDay.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
          left: leftPercent,
          width: widthPercent,
          isWeekend: startOfDay.getDay() === 0 || startOfDay.getDay() === 6 // 0=Dim, 6=Sam
        });
      }

      // Passer au jour suivant (minuit)
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }
    return blocks;
  }, [startDate, endDate, totalDuration]);

  // 3. Calcul des ticks "Heures" (Ligne du bas + Grille)
  const hourTicks = useMemo(() => {
    const ticks = [];
    const interval = getSmartInterval(totalDuration);
    
    let current = new Date(startDate.getTime());
    // Arrondir au prochain intervalle "propre"
    // Ex: si intervalle 4h, on veut 0h, 4h, 8h... pas 1h, 5h
    const remainder = current.getTime() % interval;
    if (remainder !== 0) {
        current = new Date(current.getTime() + (interval - remainder));
    }

    while (current <= endDate) {
      const offset = current.getTime() - startDate.getTime();
      const percent = (offset / totalDuration) * 100;

      // Est-ce une heure pile (00:00) ?
      const isMidnight = current.getHours() === 0 && current.getMinutes() === 0;

      ticks.push({
        percent,
        label: current.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        isMajor: isMidnight, // Marqueur de changement de jour
        showLabel: totalDuration < 7 * 24 * 3600 * 1000 // On cache les heures si > 1 semaine
      });

      current = new Date(current.getTime() + interval);
    }
    return ticks;
  }, [startDate, endDate, totalDuration]);

  // --- Logique Slider & Filtres (identique) ---
  const currentSliderDate = useMemo(() => {
    if (totalDuration === 0) return startDate;
    return new Date(startDate.getTime() + (sliderValue / 100) * totalDuration);
  }, [sliderValue, startDate, totalDuration]);

  // Utiliser un timestamp pour éviter les comparaisons d'objets Date
  const currentSliderTimestamp = currentSliderDate.getTime();
  
  // Ref pour tracker la dernière valeur envoyée et éviter les doublons
  const lastSentRef = useRef<{ timestamp: number | null; isActive: boolean }>({ timestamp: null, isActive: false });

  useEffect(() => {
    const timestampToSend = isFilterActive ? currentSliderTimestamp : null;
    
    // Éviter les appels en double si rien n'a changé
    if (lastSentRef.current.timestamp === timestampToSend && lastSentRef.current.isActive === isFilterActive) {
      return;
    }
    
    lastSentRef.current = { timestamp: timestampToSend, isActive: isFilterActive };
    
    const dateToSend = isFilterActive ? new Date(currentSliderTimestamp) : null;
    onDateChange(dateToSend);
  }, [currentSliderTimestamp, isFilterActive, onDateChange]);

  const equipementsWithDates = useMemo(() => {
    return equipements.filter((eq) => {
      const hasDates = (eq.date_pose || eq.date_depose);
      if (!hasDates) return false;
      
      // Si le filtre spatial n'est pas actif, on garde tout
      if (!mapBounds || !isSpatialFilterActive) return true;
      
      // Vérifier si l'équipement a des coordonnées
      if (!eq.coordinates || eq.coordinates.length === 0) return true;
      
      // Vérifier si au moins un point de l'équipement est dans les limites de la carte
      // Note: x = longitude, y = latitude
      const isInBounds = eq.coordinates.some((coord) => {
        const lng = coord.x;
        const lat = coord.y;
        return (
          lat >= mapBounds.south &&
          lat <= mapBounds.north &&
          lng >= mapBounds.west &&
          lng <= mapBounds.east
        );
      });
      
      return isInBounds;
    });
  }, [equipements, isSpatialFilterActive, mapBounds]);

  const getPositionPercent = (dateStr?: string | null, timeStr?: string | null): number => {
    if (!dateStr || totalDuration === 0) return -1;
    let date: Date;
    if (dateStr.includes('T')) date = new Date(dateStr);
    else if (timeStr) date = new Date(`${dateStr}T${timeStr}`);
    else return -1;
    const offset = date.getTime() - startDate.getTime();
    return Math.max(0, Math.min(100, (offset / totalDuration) * 100));
  };

  const formatDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute:"2-digit" });

  return (
    <div className="flex flex-col h-80 bg-white border-t border-slate-200 shadow-xl relative z-10 font-sans">
      
      {/* Header Controls (Compact) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 text-white shrink-0 h-10">
         <span className="font-semibold text-sm">📅 Frise ({equipementsWithDates.length})</span>
         <div className="flex gap-2">
            <button
                onClick={() => setIsFilterActive(!isFilterActive)}
                className={`px-2 py-0.5 rounded text-xs border ${isFilterActive ? "bg-amber-500 border-amber-500" : "bg-slate-700 border-slate-600"}`}
            >
                {isFilterActive ? formatDate(currentSliderDate) : "⏱️ Temps"}
            </button>
            <button
                onClick={() => setIsSpatialFilterActive(!isSpatialFilterActive)}
                disabled={!mapBounds}
                className={`px-2 py-0.5 rounded text-xs border ${
                  isSpatialFilterActive 
                    ? "bg-emerald-500 border-emerald-500" 
                    : "bg-slate-700 border-slate-600"
                } ${!mapBounds ? "opacity-50 cursor-not-allowed" : ""}`}
                title={!mapBounds ? "Bougez la carte pour activer" : "Filtrer par zone visible sur la carte"}
            >
                {isSpatialFilterActive ? "🗺️ Zone active" : "🗺️ Zone"}
            </button>
            <button onClick={onClose} className="hover:text-red-400">✕</button>
         </div>
      </div>

      {/* ZONE PRINCIPALE */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        
        {/* Ligne rouge (Curseur) - Passe par dessus tout */}
        {isFilterActive && (
          <div 
            className="absolute top-0 bottom-0 z-50 w-px bg-amber-500 pointer-events-none"
            style={{ left: `${sliderValue}%` }}
          >
             <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] px-1 rounded shadow">
                {formatDate(currentSliderDate)}
             </div>
          </div>
        )}

        {/* Input Range Invisible (Contrôle total) */}
        {isFilterActive && (
          <input
            type="range" min="0" max="100" step="0.01"
            value={sliderValue}
            onChange={(e) => setSliderValue(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-[60]"
          />
        )}

        {/* --- HEADER DES DATES (Fixe) --- */}
        <div className="shrink-0 bg-slate-50 border-b border-slate-200 select-none">
          
          {/* Ligne 1 : Les Jours */}
          <div className="relative h-6 w-full border-b border-slate-200 text-xs text-slate-600 overflow-hidden">
             {dayBlocks.map((day, i) => (
                <div 
                   key={i}
                   className={`absolute top-0 bottom-0 border-l border-slate-300 flex items-center justify-center truncate px-1
                      ${day.isWeekend ? 'bg-slate-100' : 'bg-white'}`}
                   style={{ left: `${day.left}%`, width: `${day.width}%` }}
                >
                   <span className="font-bold">{day.label}</span>
                </div>
             ))}
          </div>

          {/* Ligne 2 : Les Heures (ou subdivisions) */}
          <div className="relative h-5 w-full text-[10px] text-slate-400">
             {hourTicks.map((tick, i) => (
                <div
                   key={i}
                   className="absolute top-0 bottom-0 border-l border-slate-200 pl-1 pt-0.5"
                   style={{ left: `${tick.percent}%` }}
                >
                   {tick.showLabel && <span>{tick.label}</span>}
                </div>
             ))}
          </div>
        </div>

        {/* --- CONTENU SCROLLABLE (Gantt) --- */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-slate-50 relative">
          
          {/* Grille de fond (Vertical lines) */}
          <div className="absolute inset-0 pointer-events-none h-full w-full">
             {hourTicks.map((tick, i) => (
                <div 
                  key={i} 
                  className={`absolute top-0 bottom-0 border-l ${tick.isMajor ? 'border-slate-300' : 'border-slate-100'}`}
                  style={{ left: `${tick.percent}%` }} 
                />
             ))}
             {/* Séparateurs de jours plus forts */}
             {dayBlocks.map((d, i) => (
                <div key={`d-${i}`} className="absolute top-0 bottom-0 border-l border-slate-300" style={{ left: `${d.left}%` }} />
             ))}
          </div>

          {/* Liste des équipements */}
          <div className="p-2 space-y-1 relative z-10">
            {equipementsWithDates.map((eq) => {
              const startP = getPositionPercent(eq.date_pose, eq.hour_pose);
              const endP = getPositionPercent(eq.date_depose, eq.hour_depose);
              const hasStart = startP >= 0;
              const hasEnd = endP >= 0;

              return (
                <div 
                  key={eq.id} 
                  className="group relative h-7 w-full hover:bg-white rounded hover:shadow-sm transition-all flex items-center cursor-pointer"
                  onClick={() => onEquipementClick?.(eq)}
                >
                  {/* Label Equipement */}
                  <div className="shrink-0 z-20 w-32 truncate text-[10px] font-medium text-slate-500 group-hover:text-blue-600 bg-slate-50/90 group-hover:bg-white px-2 py-0.5 rounded backdrop-blur-sm border-r border-transparent group-hover:border-slate-100">
                     {eq.type_name || `EQ #${eq.id}`}
                  </div>

                  {/* Barre - commence après le label */}
                  <div className="relative flex-1 h-full">
                    {/* Barre bleue entre pose et dépose */}
                    {hasStart && hasEnd && (
                      <div 
                        className="absolute h-1.5 top-1/2 -translate-y-1/2 bg-blue-300/60 rounded-full group-hover:bg-blue-400" 
                        style={{ left: `${startP}%`, width: `${Math.max(0.5, endP - startP)}%` }} 
                      />
                    )}
                    {/* Point de Pose (vert) */}
                    {hasStart && (
                      <div 
                        className="absolute w-3 h-3 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-green-500 rounded-full z-20 border border-white shadow-sm" 
                        style={{ left: `${startP}%` }} 
                        title="Pose" 
                      />
                    )}
                    {/* Point de Dépose (rouge) */}
                    {hasEnd && (
                      <div 
                        className="absolute w-3 h-3 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-red-500 rounded-full z-20 border border-white shadow-sm" 
                        style={{ left: `${endP}%` }} 
                        title="Dépose" 
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimelineBar;