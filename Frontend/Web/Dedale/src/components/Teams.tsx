import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { useState, useEffect, useMemo, useCallback } from "react";
import TeamDetails, { TeamDetailData, Person, Event, EquipementAction } from "./TeamDetails";
import CreateTeam from "./CreateTeam";
import { listen } from "@tauri-apps/api/event";
import MultiRangeSlider from "./MultiRangeSlider";
import PersonDetails from "./PersonDetails";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faUsers, faUser, faPlus } from "@fortawesome/free-solid-svg-icons";

interface Team {
  id: string;
  name: string;
  number: number; //nombre de membres pour cette équipe
  eventId: string;
}

interface SelectedTeamState {
  info: Team;
  data: TeamDetailData | undefined;
}

function Teams({ activeEventId }: { activeEventId: string }) {
  // Etats globaux du composant
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtres (barre de gauche)
  const [filterName, setFilterName] = useState("");
  const [filterMinMembers, setFilterMinMembers] = useState<number>(0);
  const [filterMaxMembers, setFilterMaxMembers] = useState<number>(10);

  const [detailsCache, setDetailsCache] = useState<
    Record<string, TeamDetailData>
  >({});
  const [selectedTeamData, setSelectedTeamData] =
    useState<SelectedTeamState | null>(null);
  const [loadingTeamId, setLoadingTeamId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null);

  const loadData = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) {
        setLoading(true);
      }

      try {
        const teamsData = await invoke<Team[]>("fetch_teams", {
          eventId: activeEventId,
        });
        setTeams(teamsData);
      } catch (e) {
        console.error(e);
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [activeEventId]
  );

  useEffect(() => {
    loadData();
  }, [activeEventId, loadData]);

  useEffect(() => {
    const unlisten = listen("team-update", () => {
      console.log("♻️ Mise à jour silencieuse...");

      loadData(false);

      setDetailsCache({});
    });

    const unlistenNav = listen<{ id: string; name: string; number: number }>(
      "navigate-to-team",
      (event) => {
        const teamToOpen = event.payload;
        const teamObj: Team = {
          id: teamToOpen.id,
          name: teamToOpen.name,
          number: teamToOpen.number,
          eventId: activeEventId,
        };
        handleOpenTeam(teamObj);
      }
    );

    loadData();

    return () => {
      unlisten.then((f) => f());
      unlistenNav.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const matchName = team.name
        .toLowerCase()
        .includes(filterName.toLowerCase());

      const SLIDER_MAX = 10;
      const effectiveMax =
        filterMaxMembers === SLIDER_MAX ? Infinity : filterMaxMembers;
      const matchMembers =
        team.number >= filterMinMembers && team.number <= effectiveMax;

      return matchName && matchMembers;
    });
  }, [teams, filterName, filterMinMembers, filterMaxMembers]);

  const fetchDetailsForTeam = async (
    teamId: string
  ): Promise<TeamDetailData> => {
    if (detailsCache[teamId]) return detailsCache[teamId];

    try {
      const [members, events, rawActions] = await Promise.all([
        invoke<Person[]>("fetch_team_members", { teamId }),
        invoke<Event[]>("fetch_team_events", { teamId }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        invoke<any[]>("fetch_team_actions", { teamId }),
      ]);

      const actions: EquipementAction[] = rawActions.map(item => ({
        ...item.equipement,
        action_id: item.action_id,
        action_type: item.action_type,
        event_id: item.event_id
      }));

      const data: TeamDetailData = {
        members,
        events,
        actions
      };

      setDetailsCache(prev => ({ ...prev, [teamId]: data }));
      return data;
    } catch (error) {
      console.error("Failed to fetch team details:", error);
      throw error;
    }
  };

  const handleMouseEnter = (teamId: string) => {
    fetchDetailsForTeam(teamId).catch(() => {
      /* ignore */
    });
  };

  const handleOpenTeam = async (team: Team) => {
    if (loadingTeamId === team.id) return;
    if (detailsCache[team.id]) {
      setSelectedTeamData({ info: team, data: detailsCache[team.id] });
      return;
    }
    setLoadingTeamId(team.id);
    try {
      const data = await fetchDetailsForTeam(team.id);
      setSelectedTeamData({ info: team, data });
    } finally {
      setLoadingTeamId(null);
    }
  };

  const handleTeamCreated = (newTeam: Team) => {
    setTeams([...teams, { ...newTeam }]);
    // Émettre un événement pour les autres pages
    emit("team-created").catch(() => { });
  };

  const handleTeamDeleted = (deletedId: string) => {
    const updatedTeams = teams.filter((t) => t.id !== deletedId);
    setTeams(updatedTeams);

    const newCache = { ...detailsCache };
    delete newCache[deletedId];
    setDetailsCache(newCache);

    setSelectedTeamData(null);
    // Émettre un événement pour les autres pages
    emit("team-deleted").catch(() => { });
  };

  return (
    <div className="flex gap-6 relative h-full">
      {isCreateModalOpen && (
        <CreateTeam
          activeEventId={activeEventId}
          onClose={() => setIsCreateModalOpen(false)}
          onTeamCreated={handleTeamCreated}
        />
      )}
      {selectedTeamData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
          <TeamDetails
            teamId={selectedTeamData.info.id}
            teamName={selectedTeamData.info.name}
            data={selectedTeamData.data}
            onClose={() => setSelectedTeamData(null)}
            onDelete={handleTeamDeleted}
            onMemberClick={(person) => setViewingPerson(person)}
            activeEventId={activeEventId}
          />
          <div
            className="absolute inset-0 -z-10"
            onClick={() => setSelectedTeamData(null)}
          ></div>
        </div>
      )}
      {/* 2. MODALE PERSONNE (Niveau 2 - Par dessus l'équipe) */}
      {viewingPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
          <PersonDetails
            person={viewingPerson}
            activeEventId={activeEventId}
            onClose={() => setViewingPerson(null)}
            onDelete={() => {
              setViewingPerson(null);
            }}
            onUpdate={(updatedPerson) => {
              setViewingPerson(updatedPerson);

              if (selectedTeamData && selectedTeamData.data) {
                const updatedMembers = selectedTeamData.data.members.map((m) =>
                  m.id === updatedPerson.id ? updatedPerson : m
                );

                setSelectedTeamData({
                  ...selectedTeamData,
                  data: {
                    ...selectedTeamData.data,
                    members: updatedMembers,
                  },
                });
              }
            }}
            onTeamClick={(team) => {
              setViewingPerson(null);
              handleOpenTeam({
                id: team.id,
                name: team.name,
                number: team.number,
                eventId: activeEventId,
              });
            }}
          />
          <div
            className="absolute inset-0 -z-10"
            onClick={() => setViewingPerson(null)}
          ></div>
        </div>
      )}

      {/* --- SIDEBAR FILTRES --- */}
      <div className="w-64 p-6 bg-white rounded-lg shadow-lg shrink-0 flex flex-col gap-6">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
          <FontAwesomeIcon icon={faSearch} /> Filtres
        </h2>

        {/* 1. Recherche Nom */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
            Nom
          </label>
          <input
            type="text"
            placeholder="Rechercher..."
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        <div>
          <div className="flex justify-between items-end mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Membres
            </label>
            <div className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
              {filterMinMembers} -{" "}
              {filterMaxMembers === 10 ? "10+" : filterMaxMembers}
            </div>
          </div>

          <div className="px-1">
            <MultiRangeSlider
              min={0}
              max={10}
              onChange={(min, max) => {
                setFilterMinMembers(min);
                setFilterMaxMembers(max);
              }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-0.5">
            <span>0</span>
            <span>10+</span>
          </div>
        </div>

        {/* Résumé + Reset */}
        <div className="mt-auto pt-4 text-xs text-gray-400 text-center border-t border-gray-100">
          <p className="mb-2">
            <b>{filteredTeams.length}</b> / {teams.length} équipes
          </p>

          {(filterName || filterMinMembers > 0 || filterMaxMembers < 10) && (
            <button
              onClick={() => {
                setFilterName("");
                setFilterMinMembers(0);
                setFilterMaxMembers(10);
              }}
              className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors"
            >
              Réinitialiser tout
            </button>
          )}
        </div>
      </div>

      {/* --- CONTENU PRINCIPAL --- */}
      <div className="flex-1 p-6 bg-white rounded-lg shadow-lg flex flex-col max-h-screen relative overflow-hidden">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <FontAwesomeIcon icon={faUsers} /> Équipes
          {filteredTeams.length !== teams.length && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              (Filtrées)
            </span>
          )}
        </h2>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
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
                    className="relative p-3 bg-linear-to-br from-primary/5 to-primary/20 rounded-lg border border-primary/20 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between"
                  >
                    {loadingTeamId === team.id && (
                      <div className="absolute top-2 right-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-800 text-transform: capitalize">
                        {team.name}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">
                      <FontAwesomeIcon icon={faUser} /> {team.number} membre{team.number > 1 ? "s" : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="absolute bottom-8 right-8 w-10 h-10 bg-primary hover:opacity-90 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 cursor-pointer active:scale-95 transition-all duration-200 flex items-center justify-center z-10 group"
          title="Créer une nouvelle équipe"
        >
          <FontAwesomeIcon icon={faPlus} className="h-6 w-6 transition-transform group-hover:rotate-90" />
        </button>
      </div>
    </div>
  );
}

export default Teams;
