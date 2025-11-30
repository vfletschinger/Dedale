import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import TeamDetails, { TeamDetailData, Person, Event } from "./TeamDetails";
import CreateTeam from "./CreateTeam";

interface Team {
  id: number;
  name: string;
  number: number;
  event_ids: number[];
}

interface SimpleEvent {
  id: number;
  name: string;
}

interface SelectedTeamState {
  info: Team;
  data: TeamDetailData;
}

function Teams({ onTeamClick }: any) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [availableEvents, setAvailableEvents] = useState<SimpleEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterName, setFilterName] = useState("");
  const [filterMinMembers, setFilterMinMembers] = useState<number>(0);
  const [filterMaxMembers, setFilterMaxMembers] = useState<number>(20);
  const [filterEventId, setFilterEventId] = useState<number | 'all' | 'none'>('all');

  const [detailsCache, setDetailsCache] = useState<Record<number, TeamDetailData>>({});
  const [selectedTeamData, setSelectedTeamData] = useState<SelectedTeamState | null>(null);
  const [loadingTeamId, setLoadingTeamId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEventMenuOpen, setIsEventMenuOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamsData, eventsData] = await Promise.all([
        invoke<Team[]>("fetch_teams"),
        invoke<any[]>("fetch_events")
      ]);
      setTeams(teamsData);
      setAvailableEvents(eventsData.map((e: any) => ({ id: e.id, name: e.name })));
    } catch (e) { console.error(e) } finally { setLoading(false) }
  };

  useEffect(() => { loadData(); }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter(team => {
      const matchName = team.name.toLowerCase().includes(filterName.toLowerCase());

      let matchEvent = true;
      if (filterEventId === 'none') matchEvent = team.event_ids.length === 0;
      else if (filterEventId !== 'all') matchEvent = team.event_ids.includes(filterEventId as number);

      const SLIDER_MAX = 20;
      const effectiveMax = filterMaxMembers === SLIDER_MAX ? Infinity : filterMaxMembers;
      const matchMembers = team.number >= filterMinMembers && team.number <= effectiveMax;

      return matchName && matchMembers && matchEvent;
    });
  }, [teams, filterName, filterMinMembers, filterMaxMembers, filterEventId]);

  const fetchDetailsForTeam = async (teamId: number): Promise<TeamDetailData> => {
    if (detailsCache[teamId]) return detailsCache[teamId];
    const [members, events] = await Promise.all([
      invoke<Person[]>("fetch_team_members", { teamId }),
      invoke<Event[]>("fetch_team_events", { teamId }),
    ]);
    const data = { members, events };
    setDetailsCache(prev => ({ ...prev, [teamId]: data }));
    return data;
  };

  const handleMouseEnter = (teamId: number) => { fetchDetailsForTeam(teamId).catch(err => console.error(err)); };

  const handleOpenTeam = async (team: Team) => {
    if (loadingTeamId === team.id) return;
    if (detailsCache[team.id]) {
      setSelectedTeamData({ info: team, data: detailsCache[team.id] });
      if (onTeamClick) onTeamClick(team.id);
      return;
    }
    setLoadingTeamId(team.id);
    try {
      const data = await fetchDetailsForTeam(team.id);
      setSelectedTeamData({ info: team, data });
      if (onTeamClick) onTeamClick(team.id);
    } finally { setLoadingTeamId(null); }
  };

  const handleTeamCreated = (newTeam: Team) => {
    const teamWithEvents = { ...newTeam, event_ids: [] };
    setTeams([...teams, teamWithEvents]);
  };

  const handleTeamDeleted = (deletedId: number) => {
    const updatedTeams = teams.filter(t => t.id !== deletedId);
    setTeams(updatedTeams);

    const newCache = { ...detailsCache };
    delete newCache[deletedId];
    setDetailsCache(newCache);

    setSelectedTeamData(null);
  };

  return (
    <div className="flex gap-6 relative h-full">
      {isCreateModalOpen && <CreateTeam onClose={() => setIsCreateModalOpen(false)} onTeamCreated={handleTeamCreated} />}
      {selectedTeamData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
          <TeamDetails
            teamId={selectedTeamData.info.id}
            teamName={selectedTeamData.info.name}
            data={selectedTeamData.data}
            onClose={() => setSelectedTeamData(null)}
            onDelete={handleTeamDeleted}
          />
          <div className="absolute inset-0 -z-10" onClick={() => setSelectedTeamData(null)}></div>
        </div>
      )}

      {/* --- SIDEBAR FILTRES --- */}
      <div className="w-64 p-6 bg-white rounded-lg shadow-lg flex-shrink-0 flex flex-col gap-6">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-2">🔍 Filtres</h2>

        {/* 1. Recherche Nom */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Nom</label>
          <input
            type="text"
            placeholder="Rechercher..."
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* 2. Filtre Événement */}
        <div className="relative">
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Événement</label>

          <button
            onClick={() => setIsEventMenuOpen(!isEventMenuOpen)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-left flex justify-between items-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <span className="truncate">
              {filterEventId === 'all' ? "Tous" :
                filterEventId === 'none' ? "⚠️ Sans événement" :
                  availableEvents.find(e => e.id === filterEventId)?.name || "Sélectionner..."}
            </span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isEventMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>

          {isEventMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsEventMenuOpen(false)}></div>
              <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                <div
                  onClick={() => { setFilterEventId('all'); setIsEventMenuOpen(false); }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 ${filterEventId === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                >
                  Tous
                </div>
                <div
                  onClick={() => { setFilterEventId('none'); setIsEventMenuOpen(false); }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 ${filterEventId === 'none' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                >
                  ⚠️ Sans événement
                </div>

                <div className="h-px bg-gray-200 my-1 mx-2"></div>

                {/* Liste des événements */}
                {availableEvents.map(evt => (
                  <div
                    key={evt.id}
                    onClick={() => { setFilterEventId(evt.id); setIsEventMenuOpen(false); }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 ${filterEventId === evt.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                  >
                    {evt.name}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="flex justify-between items-end mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase">Membres</label>
            <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {filterMinMembers} - {filterMaxMembers === 20 ? "20+" : filterMaxMembers}
            </div>
          </div>

          <div className="px-1">
            <MultiRangeSlider
              min={0}
              max={20}
              onChange={(min, max) => {
                setFilterMinMembers(min);
                setFilterMaxMembers(max);
              }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-0.5">
            <span>0</span>
            <span>20+</span>
          </div>
        </div>

        {/* Résumé + Reset */}
        <div className="mt-auto pt-4 text-xs text-gray-400 text-center border-t border-gray-100">
          <p className="mb-2"><b>{filteredTeams.length}</b> / {teams.length} équipes</p>

          {(filterName || filterEventId !== 'all' || filterMinMembers > 0 || filterMaxMembers < 20) && (
            <button
              onClick={() => {
                setFilterName("");
                setFilterEventId('all');
                setFilterMinMembers(0);
                setFilterMaxMembers(20);
              }}
              className="text-blue-500 hover:text-blue-700 hover:underline font-medium transition-colors"
            >
              Réinitialiser tout
            </button>
          )}
        </div>
      </div>

      {/* --- CONTENU PRINCIPAL --- */}
      <div className="flex-1 p-6 bg-white rounded-lg shadow-lg flex flex-col max-h-screen relative overflow-hidden">
        <h2 className="text-xl font-bold text-gray-800 mb-6">
          👥 Équipes
          {filteredTeams.length !== teams.length && <span className="text-sm font-normal text-gray-500 ml-2">(Filtrées)</span>}
        </h2>

        {loading ? (
          <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div></div>
        ) : (
          <div className="overflow-y-auto flex-1 pb-20">
            <div className="grid grid-cols-2 gap-4 pr-2 p-1">
              {filteredTeams.length === 0 ? (
                <div className="col-span-2 flex flex-col items-center justify-center py-12 text-gray-400">
                  <p>Aucune équipe ne correspond aux filtres.</p>
                </div>
              ) : (
                filteredTeams.map((team) => (
                  <div
                    key={team.id}
                    onMouseEnter={() => handleMouseEnter(team.id)}
                    onClick={() => handleOpenTeam(team)}
                    className="relative p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between"
                  >
                    {loadingTeamId === team.id && (
                      <div className="absolute top-2 right-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div></div>
                    )}
                    <div><h3 className="font-semibold text-gray-800">{team.name}</h3></div>
                    <p className="text-xs text-gray-500 mt-4">👤 {team.number} membre{team.number > 1 ? "s" : ""}</p>

                    {team.event_ids.length > 0 && (
                      <div className="absolute bottom-3 right-3 flex gap-1">
                        {team.event_ids.slice(0, 3).map(eid => (
                          <div key={eid} className="w-2 h-2 rounded-full bg-green-400"></div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="absolute bottom-8 right-8 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center z-10 group"
          title="Créer une nouvelle équipe"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

      </div>
    </div>
  );
}

export default Teams;

interface MultiRangeSliderProps {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}

const MultiRangeSlider = ({ min, max, onChange }: MultiRangeSliderProps) => {
  const [minVal, setMinVal] = useState(min);
  const [maxVal, setMaxVal] = useState(max);
  const minValRef = useRef(min);
  const maxValRef = useRef(max);
  const range = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMinVal(min);
    minValRef.current = min;
    setMaxVal(max);
    maxValRef.current = max;
  }, [min, max]);

  const getPercent = useCallback(
    (value: number) => Math.round(((value - 0) / (20 - 0)) * 100),
    []
  );

  useEffect(() => {
    const minPercent = getPercent(minVal);
    const maxPercent = getPercent(maxValRef.current);

    if (range.current) {
      range.current.style.left = `${minPercent}%`;
      range.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [minVal, getPercent]);

  useEffect(() => {
    const minPercent = getPercent(minValRef.current);
    const maxPercent = getPercent(maxVal);

    if (range.current) {
      range.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [maxVal, getPercent]);

  useEffect(() => {
    onChange(minVal, maxVal);
  }, [minVal, maxVal]);

  return (
    <div className="relative w-full h-5">

      {/* --- INPUT MIN --- */}
      <input
        type="range"
        min={0}
        max={20}
        value={minVal}
        onChange={(event) => {
          const value = Math.min(Number(event.target.value), maxVal - 1);
          setMinVal(value);
          minValRef.current = value;
        }}
        className="thumb pointer-events-none absolute h-0 w-full outline-none z-[3] top-1/2 -translate-y-1/2 left-0"
        style={{ zIndex: minVal > 20 - 10 ? "5" : "3" }}
      />

      {/* --- INPUT MAX --- */}
      <input
        type="range"
        min={0}
        max={20}
        value={maxVal}
        onChange={(event) => {
          const value = Math.max(Number(event.target.value), minVal + 1);
          setMaxVal(value);
          maxValRef.current = value;
        }}
        className="thumb pointer-events-none absolute h-0 w-full outline-none z-[4] top-1/2 -translate-y-1/2 left-0"
      />

      {/* --- BARRES VISUELLES --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-18px)] h-1.5 z-[1]">
        <div className="absolute top-0 left-0 h-full w-full rounded bg-gray-200"></div>
        <div ref={range} className="absolute top-0 h-full rounded bg-blue-500 z-[2]"></div>
      </div>
    </div>
  );
};