import { useMemo, useState, useEffect, useRef } from "react";
import { MapPoint, MapEvent, Equipement, MapBounds, Team } from "../../../types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarAlt,
  faClock,
  faMap,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";

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
  if (durationMs <= 24 * hour) return 1 * hour; // < 24h : toutes les 1h
  if (durationMs <= 3 * 24 * hour) return 4 * hour; // < 3j : toutes les 4h
  if (durationMs <= 7 * 24 * hour) return 12 * hour; // < 1 sem : toutes les 12h
  return 24 * hour; // > 1 sem : 1 trait par jour
};

function TimelineBar({
  event,
  equipements = [],
  onEquipementClick,
  onClose,
  onDateChange,
  mapBounds,
}: TimelineBarProps) {
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [isSpatialFilterActive, setIsSpatialFilterActive] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedEquipements, setSelectedEquipements] = useState<Equipement[]>(
    []
  );
  const [teams, setTeams] = useState<Team[]>([]);
  const [poseTeamId, setPoseTeamId] = useState<string>("");
  const [deposeTeamId, setDeposeTeamId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [_existingPoseTeamId, setExistingPoseTeamId] = useState<string>("");
  const [_existingDeposeTeamId, setExistingDeposeTeamId] = useState<string>("");
  const [equipmentsActionsMap, setEquipmentsActionsMap] = useState<
    Map<string, { pose: string | null; depose: string | null }>
  >(new Map());

  // Créer une clé stable basée sur les IDs des équipements
  const equipementIdsKey = useMemo(
    () =>
      equipements
        .map((eq) => eq.id)
        .sort()
        .join(","),
    [equipements]
  );

  // Charger les équipes
  useEffect(() => {
    if (event?.id) {
      invoke<Team[]>("fetch_teams_for_event", { eventId: event.id })
        .then(setTeams)
        .catch((err) => console.error("Erreur chargement équipes:", err));
    }
  }, [event?.id]);

  useEffect(() => {
    if (!event?.id) return;

    const unlisten = listen("team-created", () => {
      invoke<Team[]>("fetch_teams_for_event", { eventId: event.id })
        .then(setTeams)
        .catch((err) => console.error("Erreur rechargement équipes:", err));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [event?.id]);

  // Calculer les équipes communes pour les équipements sélectionnés
  useEffect(() => {
    if (selectedEquipements.length === 0) {
      setPoseTeamId("");
      setDeposeTeamId("");
      setExistingPoseTeamId("");
      setExistingDeposeTeamId("");
      return;
    }

    // Récupérer les actions pour tous les équipements sélectionnés
    const poseTeams = new Set<string>();
    const deposeTeams = new Set<string>();
    let allHavePose = true;
    let allHaveDepose = true;

    selectedEquipements.forEach((eq) => {
      const actions = equipmentsActionsMap.get(eq.id);
      if (actions?.pose) {
        poseTeams.add(actions.pose);
      } else {
        allHavePose = false;
      }
      if (actions?.depose) {
        deposeTeams.add(actions.depose);
      } else {
        allHaveDepose = false;
      }
    });

    if (allHavePose && poseTeams.size === 1) {
      const commonPoseTeam = Array.from(poseTeams)[0];
      setExistingPoseTeamId(commonPoseTeam);
      setPoseTeamId(commonPoseTeam);
    } else {
      setExistingPoseTeamId("");
      setPoseTeamId("");
    }

    if (allHaveDepose && deposeTeams.size === 1) {
      const commonDeposeTeam = Array.from(deposeTeams)[0];
      setExistingDeposeTeamId(commonDeposeTeam);
      setDeposeTeamId(commonDeposeTeam);
    } else {
      setExistingDeposeTeamId("");
      setDeposeTeamId("");
    }
  }, [selectedEquipements, equipmentsActionsMap]);

  useEffect(() => {
    if (!event?.id || equipements.length === 0) return;

    console.log(
      "[TimelineBar] Chargement des actions pour",
      equipements.length,
      "équipements"
    );

    Promise.all(
      equipements.map((eq) => {
        return invoke<
          Array<{
            id: string;
            team_id: string;
            equipement_id: string;
            action_type: "pose" | "depose";
            completed: boolean;
          }>
        >("fetch_actions_for_equipement", { equipementId: eq.id })
          .then((actions) => {
            console.log(
              `[TimelineBar] Actions pour équipement ${eq.id}:`,
              actions
            );
            return { equipementId: eq.id, actions };
          })
          .catch((err) => {
            console.error(`Erreur chargement actions pour ${eq.id}:`, err);
            return { equipementId: eq.id, actions: [] };
          });
      })
    ).then((results) => {
      const newMap = new Map<
        string,
        { pose: string | null; depose: string | null }
      >();
      results.forEach(({ equipementId, actions }) => {
        newMap.set(equipementId, { pose: null, depose: null });
        const existing = newMap.get(equipementId)!;
        actions.forEach((action) => {
          if (action.action_type === "pose") {
            existing.pose = action.team_id;
          } else if (action.action_type === "depose") {
            existing.depose = action.team_id;
          }
        });
      });
      console.log("[TimelineBar] Map finale des actions:", newMap);
      setEquipmentsActionsMap(newMap);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, equipementIdsKey]);

  // 1. Calcul des bornes (Start / End) ET de la position initiale du slider
  const { startDate, endDate, totalDuration, initialSliderValue } =
    useMemo(() => {
      const allDates: number[] = [];

      equipements.forEach((eq) => {
        const addDate = (d?: string, h?: string) => {
          if (!d) return;
          if (d.includes("T")) allDates.push(new Date(d).getTime());
          else if (h) allDates.push(new Date(`${d}T${h}`).getTime());
        };
        addDate(eq.date_pose, eq.hour_pose);
        addDate(eq.date_depose, eq.hour_depose);
      });

      if (allDates.length === 0) {
        const now = new Date();
        now.setMinutes(0, 0, 0); // Arrondir
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
      const initialPercent =
        duration > 0
          ? Math.max(
            0,
            Math.min(
              100,
              ((minDate.getTime() - start.getTime()) / duration) * 100
            )
          )
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

    while (current < endDate) {
      const startOfDay = new Date(current);
      const endOfDay = new Date(current);
      endOfDay.setHours(23, 59, 59, 999);

      const effectiveStart = startOfDay < startDate ? startDate : startOfDay;
      const effectiveEnd = endOfDay > endDate ? endDate : endOfDay;

      if (effectiveStart < effectiveEnd) {
        const duration = effectiveEnd.getTime() - effectiveStart.getTime();
        const widthPercent = (duration / totalDuration) * 100;
        const leftPercent =
          ((effectiveStart.getTime() - startDate.getTime()) / totalDuration) *
          100;

        blocks.push({
          label: startOfDay.toLocaleDateString("fr-FR", {
            weekday: "short",
            day: "numeric",
            month: "short",
          }),
          left: leftPercent,
          width: widthPercent,
          isWeekend: startOfDay.getDay() === 0 || startOfDay.getDay() === 6,
        });
      }

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
    const remainder = current.getTime() % interval;
    if (remainder !== 0) {
      current = new Date(current.getTime() + (interval - remainder));
    }

    while (current <= endDate) {
      const offset = current.getTime() - startDate.getTime();
      const percent = (offset / totalDuration) * 100;

      const isMidnight = current.getHours() === 0 && current.getMinutes() === 0;

      ticks.push({
        percent,
        label: current.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isMajor: isMidnight,
        showLabel: totalDuration < 7 * 24 * 3600 * 1000,
      });

      current = new Date(current.getTime() + interval);
    }
    return ticks;
  }, [startDate, endDate, totalDuration]);

  const currentSliderDate = useMemo(() => {
    if (totalDuration === 0) return startDate;
    return new Date(startDate.getTime() + (sliderValue / 100) * totalDuration);
  }, [sliderValue, startDate, totalDuration]);

  const currentSliderTimestamp = currentSliderDate.getTime();

  const lastSentRef = useRef<{ timestamp: number | null; isActive: boolean }>({
    timestamp: null,
    isActive: false,
  });

  useEffect(() => {
    const timestampToSend = isFilterActive ? currentSliderTimestamp : null;

    if (
      lastSentRef.current.timestamp === timestampToSend &&
      lastSentRef.current.isActive === isFilterActive
    ) {
      return;
    }

    lastSentRef.current = {
      timestamp: timestampToSend,
      isActive: isFilterActive,
    };

    const dateToSend = isFilterActive ? new Date(currentSliderTimestamp) : null;
    onDateChange(dateToSend);
  }, [currentSliderTimestamp, isFilterActive, onDateChange]);

  const equipementsWithDates = useMemo(() => {
    return equipements.filter((eq) => {
      const hasDates = eq.date_pose || eq.date_depose;
      if (!hasDates) return false;

      if (!mapBounds || !isSpatialFilterActive) return true;

      if (!eq.coordinates || eq.coordinates.length === 0) return true;

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

  const getPositionPercent = (
    dateStr?: string | null,
    timeStr?: string | null
  ): number => {
    if (!dateStr || totalDuration === 0) return -1;
    let date: Date;
    if (dateStr.includes("T")) date = new Date(dateStr);
    else if (timeStr) date = new Date(`${dateStr}T${timeStr}`);
    else return -1;
    const offset = date.getTime() - startDate.getTime();
    return Math.max(0, Math.min(100, (offset / totalDuration) * 100));
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleEquipementClick = async (eq: Equipement) => {
    setSelectedEquipements((prev) => {
      const isSelected = prev.some((e) => e.id === eq.id);
      if (isSelected) {
        return prev.filter((e) => e.id !== eq.id);
      } else {
        return [...prev, eq];
      }
    });

    onEquipementClick?.(eq);
  };

  const handleAssignTeams = async () => {
    if (selectedEquipements.length === 0) return;

    setIsAssigning(true);
    try {
      for (const eq of selectedEquipements) {
        if (poseTeamId) {
          await invoke("add_action", {
            teamId: poseTeamId,
            equipementId: eq.id,
            actionType: "pose",
          });
        }

        if (deposeTeamId) {
          await invoke("add_action", {
            teamId: deposeTeamId,
            equipementId: eq.id,
            actionType: "depose",
          });
        }
      }

      setEquipmentsActionsMap((prevMap) => {
        const newMap = new Map(prevMap);
        selectedEquipements.forEach((eq) => {
          if (!newMap.has(eq.id)) {
            newMap.set(eq.id, { pose: null, depose: null });
          }
          const existing = newMap.get(eq.id)!;
          if (poseTeamId) {
            existing.pose = poseTeamId;
          }
          if (deposeTeamId) {
            existing.depose = deposeTeamId;
          }
        });
        return newMap;
      });

      if (poseTeamId) {
        setExistingPoseTeamId(poseTeamId);
      }
      if (deposeTeamId) {
        setExistingDeposeTeamId(deposeTeamId);
      }

      alert(
        `Équipes attribuées avec succès à ${selectedEquipements.length} équipement(s) !`
      );
    } catch (error) {
      console.error("Erreur attribution:", error);
      alert("Erreur lors de l'attribution : " + String(error));
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="flex flex-col bg-white border-t border-slate-200 shadow-xl relative z-10 font-sans h-full overflow-hidden">
      {/* Header Controls (Compact) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 text-white shrink-0 h-10">
        <span className="font-semibold text-sm">
          <FontAwesomeIcon icon={faCalendarAlt} className="mr-2" />
          Frise ({equipementsWithDates.length})
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setIsFilterActive(!isFilterActive)}
            className={`px-2 py-0.5 rounded text-xs border ${isFilterActive
              ? "bg-amber-500 border-amber-500"
              : "bg-slate-700 border-slate-600"
              }`}
          >
            {isFilterActive ? (
              formatDate(currentSliderDate)
            ) : (
              <span>
                <FontAwesomeIcon icon={faClock} className="mr-1" /> Temps
              </span>
            )}
          </button>
          <button
            onClick={() => setIsSpatialFilterActive(!isSpatialFilterActive)}
            disabled={!mapBounds}
            className={`px-2 py-0.5 rounded text-xs border ${isSpatialFilterActive
              ? "bg-emerald-500 border-emerald-500"
              : "bg-slate-700 border-slate-600"
              } ${!mapBounds ? "opacity-50 cursor-not-allowed" : ""}`}
            title={
              !mapBounds
                ? "Bougez la carte pour activer"
                : "Filtrer par zone visible sur la carte"
            }
          >
            {isSpatialFilterActive ? (
              <span>
                <FontAwesomeIcon icon={faMap} className="mr-1" /> Zone active
              </span>
            ) : (
              <span>
                <FontAwesomeIcon icon={faMap} className="mr-1" /> Zone
              </span>
            )}
          </button>
          <button onClick={onClose} className="hover:text-red-400">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      </div>

      {/* ZONE PRINCIPALE - Timeline 50% de l'espace */}
      <div className="relative overflow-hidden shrink-0 border-b border-slate-200 flex flex-col h-1/2">
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
            type="range"
            min="0"
            max="100"
            step="0.01"
            value={sliderValue}
            onChange={(e) => setSliderValue(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-[60]"
          />
        )}

        {/* --- CONTENU SCROLLABLE (Gantt) --- */}
        <div
          ref={scrollContainerRef}
          className="overflow-y-auto bg-slate-50 relative h-full"
        >
          {/* --- HEADER DES DATES (Fixe) --- */}
          <div className="shrink-0 bg-slate-50 border-b border-slate-200 select-none">
            {/* Ligne 1 : Les Jours */}
            <div className="relative h-6 w-full border-b border-slate-200 text-xs text-slate-600 overflow-hidden">
              {dayBlocks.map((day, i) => (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 border-l border-slate-300 flex items-center justify-center truncate px-1
                      ${day.isWeekend ? "bg-slate-100" : "bg-white"}`}
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

          {/* Grille de fond (Vertical lines) */}
          <div className="absolute inset-0 pointer-events-none h-full w-full">
            {hourTicks.map((tick, i) => (
              <div
                key={i}
                className={`absolute top-0 bottom-0 border-l ${tick.isMajor ? "border-slate-300" : "border-slate-100"
                  }`}
                style={{ left: `${tick.percent}%`, top: "64px" }}
              />
            ))}
            {/* Séparateurs de jours plus forts */}
            {dayBlocks.map((d, i) => (
              <div
                key={`d-${i}`}
                className="absolute top-0 bottom-0 border-l border-slate-300"
                style={{ left: `${d.left}%` }}
              />
            ))}
          </div>

          {/* Liste des équipements */}
          <div className="p-2 space-y-1 relative z-10">
            {equipementsWithDates.map((eq) => {
              const startP = getPositionPercent(eq.date_pose, eq.hour_pose);
              const endP = getPositionPercent(eq.date_depose, eq.hour_depose);
              const hasStart = startP >= 0;
              const hasEnd = endP >= 0;

              const existingActions = equipmentsActionsMap.get(eq.id) || {
                pose: null,
                depose: null,
              };

              const isSelected = selectedEquipements.some(
                (e) => e.id === eq.id
              );

              return (
                <div
                  key={eq.id}
                  className={`group relative h-7 w-full rounded hover:shadow-sm transition-all flex items-center cursor-pointer ${isSelected
                    ? "bg-blue-50 ring-2 ring-blue-400"
                    : "hover:bg-white"
                    }`}
                  onClick={() => handleEquipementClick(eq)}
                >
                  {/* Label Equipement */}
                  <div className="shrink-0 z-20 w-32 truncate text-[10px] font-medium text-slate-500 group-hover:text-blue-600 bg-slate-50/90 group-hover:bg-white px-2 py-0.5 rounded backdrop-blur-sm border-r border-transparent group-hover:border-slate-100">
                    {eq.type_name || `EQ #${eq.id}`}
                  </div>

                  {/* Barre - commence après le label */}
                  <div className="relative flex-1 h-full">
                    {/* Barre divisée en deux moitiés */}
                    {hasStart && hasEnd && (
                      <>
                        {/* Moitié gauche (pose) - verte si attribuée, bleue sinon */}
                        <div
                          className={`absolute h-1.5 top-1/2 -translate-y-1/2 rounded-l-full group-hover:brightness-110 ${existingActions.pose
                            ? "bg-green-500"
                            : "bg-blue-300/60"
                            }`}
                          style={{
                            left: `${startP}%`,
                            width: `${Math.max(0.5, (endP - startP) / 2)}%`,
                          }}
                        />
                        {/* Moitié droite (dépose) - rouge si attribuée, bleue sinon */}
                        <div
                          className={`absolute h-1.5 top-1/2 -translate-y-1/2 rounded-r-full group-hover:brightness-110 ${existingActions.depose
                            ? "bg-red-500"
                            : "bg-blue-300/60"
                            }`}
                          style={{
                            left: `${startP + (endP - startP) / 2}%`,
                            width: `${Math.max(0.5, (endP - startP) / 2)}%`,
                          }}
                        />
                      </>
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

      {/* Panneau d'attribution - 50% de l'espace restant */}
      <div
        className={`flex-1 flex flex-col border-t border-slate-300 overflow-y-auto ${selectedEquipements.length > 0 ? "bg-white" : "bg-slate-50"
          }`}
      >
        {selectedEquipements.length > 0 && (
          <div className="p-4 flex-1 flex flex-col">
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              Attribution des équipes
              {selectedEquipements.length === 1
                ? ` pour : ${selectedEquipements[0].type_name || "équipement"}`
                : ` pour ${selectedEquipements.length} équipements`}
            </h3>

            <div className="grid grid-cols-2 gap-4 flex-1">
              {/* Pose */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Équipe pour la pose
                </label>
                <select
                  value={poseTeamId}
                  onChange={(e) => setPoseTeamId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Sélectionner une équipe --</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dépose */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Équipe pour la dépose
                </label>
                <select
                  value={deposeTeamId}
                  onChange={(e) => setDeposeTeamId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Sélectionner une équipe --</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Boutons d'action - Positionnés en bas */}
            <div className="flex gap-3 mt-4 justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedEquipements([])}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAssignTeams}
                disabled={isAssigning || (!poseTeamId && !deposeTeamId)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isAssigning ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Attribution...
                  </>
                ) : (
                  "Attribuer les équipes"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TimelineBar;
