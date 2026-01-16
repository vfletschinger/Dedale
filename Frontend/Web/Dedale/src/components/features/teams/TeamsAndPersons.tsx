import { invoke } from "@tauri-apps/api/core";
import toast from "react-hot-toast";
import { emit } from "@tauri-apps/api/event";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Team, Person, TeamEvent, TeamDetailData, EquipementAction } from "../../../types";
import TeamDetails from "./TeamDetails";
import CreateTeam from "../../forms/CreateTeam";
import CreatePerson from "../../forms/CreatePerson";
import PersonDetails from "./PersonDetails";
import { listen } from "@tauri-apps/api/event";
import MultiRangeSlider from "../../common/MultiRangeSlider";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faUsers, faUser, faPlus } from "@fortawesome/free-solid-svg-icons";

interface SelectedTeamState {
    info: Team;
    data: TeamDetailData | undefined;
}

function TeamsAndPersons({ activeEventId }: { activeEventId: string }) {
    // === TEAMS STATE ===
    const [teams, setTeams] = useState<Team[]>([]);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [filterTeamName, setFilterTeamName] = useState("");
    const [filterMinMembers, setFilterMinMembers] = useState<number>(0);
    const [filterMaxMembers, setFilterMaxMembers] = useState<number>(10);
    const [detailsCache, setDetailsCache] = useState<Record<string, TeamDetailData>>({});
    const [selectedTeamData, setSelectedTeamData] = useState<SelectedTeamState | null>(null);
    const [loadingTeamId, setLoadingTeamId] = useState<string | null>(null);
    const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);

    // === PERSONS STATE ===
    const [people, setPeople] = useState<Person[]>([]);
    const [loadingPersons, setLoadingPersons] = useState(false);
    const [filterPersonName, setFilterPersonName] = useState("");
    const [isCreatePersonOpen, setIsCreatePersonOpen] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

    // === MODAL OVERLAP STATE ===
    const [viewingPerson, setViewingPerson] = useState<Person | null>(null);
    const [viewingTeam, setViewingTeam] = useState<{ id: string; name: string } | null>(null);

    // === TEAMS FUNCTIONS ===
    const loadTeamsData = useCallback(
        async (showSpinner = true) => {
            if (showSpinner) {
                setLoadingTeams(true);
            }
            try {
                const teamsData = await invoke<Team[]>("fetch_teams", {
                    eventId: activeEventId,
                });
                setTeams(teamsData);
            } catch (e) {
                console.error(e);
                toast.error("Erreur lors du chargement des équipes");
            } finally {
                if (showSpinner) {
                    setLoadingTeams(false);
                }
            }
        },
        [activeEventId]
    );

    useEffect(() => {
        loadTeamsData();
    }, [activeEventId, loadTeamsData]);

    useEffect(() => {
        const unlisten = listen("team-update", () => {
            console.log("♻️ Mise à jour silencieuse...");
            loadTeamsData(false);
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
                .includes(filterTeamName.toLowerCase());
            const SLIDER_MAX = 10;
            const effectiveMax = filterMaxMembers === SLIDER_MAX ? Infinity : filterMaxMembers;
            const matchMembers = (team.number ?? 0) >= filterMinMembers && (team.number ?? 0) <= effectiveMax;
            return matchName && matchMembers;
        });
    }, [teams, filterTeamName, filterMinMembers, filterMaxMembers]);

    const fetchDetailsForTeam = async (teamId: string): Promise<TeamDetailData> => {
        if (detailsCache[teamId]) return detailsCache[teamId];
        try {
            const [members, events, rawActions] = await Promise.all([
                invoke<Person[]>("fetch_team_members", { teamId }),
                invoke<TeamEvent[]>("fetch_team_events", { teamId }),
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
            toast.error("Erreur lors du chargement des détails de l'équipe");
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
        emit("team-created").catch(() => { });
    };

    const handleTeamDeleted = (deletedId: string) => {
        const updatedTeams = teams.filter((t) => t.id !== deletedId);
        setTeams(updatedTeams);
        const newCache = { ...detailsCache };
        delete newCache[deletedId];
        setDetailsCache(newCache);
        setSelectedTeamData(null);
        emit("team-deleted").catch(() => { });
    };

    // === PERSONS FUNCTIONS ===
    const loadPeopleData = async () => {
        setLoadingPersons(true);
        try {
            const data = await invoke<Person[]>("fetch_people");
            setPeople(data);
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors du chargement des personnes");
        } finally {
            setLoadingPersons(false);
        }
    };

    useEffect(() => {
        loadPeopleData();
    }, []);

    useEffect(() => {
        const unlistenNav = listen<{ id: string }>('navigate-to-person', (event) => {
            const targetId = event.payload.id;
            setPeople(currentPeople => {
                const found = currentPeople.find(p => p.id === targetId);
                if (found) setSelectedPerson(found);
                return currentPeople;
            });
        });

        return () => { unlistenNav.then(f => f()); };
    }, []);

    const filteredPeople = useMemo(() => {
        return people.filter(p =>
            (p.firstname + " " + p.lastname).toLowerCase().includes(filterPersonName.toLowerCase()) ||
            p.email?.toLowerCase().includes(filterPersonName.toLowerCase())
        );
    }, [people, filterPersonName]);

    const handlePersonCreated = (newPerson: Person) => {
        setPeople([...people, newPerson]);
    };

    const handlePersonDeleted = (id: string) => {
        setPeople(people.filter(p => p.id !== id));
        setSelectedPerson(null);
    };

    const handlePersonUpdate = (updatedPerson: Person) => {
        setPeople(people.map(p => p.id === updatedPerson.id ? updatedPerson : p));
        setSelectedPerson(updatedPerson);
    };

    return (
        <div className="flex flex-col h-full w-full bg-gray-50 overflow-hidden">
            {/* === TEAMS SECTION === */}
            <div className="flex-1 flex flex-col min-h-0 border-b border-gray-200">
                {/* TEAMS HEADER & FILTERS */}
                <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <FontAwesomeIcon icon={faUsers} className="text-xl" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 leading-tight">Équipes</h2>
                            <p className="text-xs text-gray-500">{filteredTeams.length} équipe(s)</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-gray-50 p-1.5 rounded-xl border border-gray-200 shadow-sm transition-all focus-within:shadow-md focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10">
                            {/* Filter Name */}
                            <div className="relative group w-48 lg:w-64">
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-xs" />
                                <input
                                    type="text"
                                    placeholder="Rechercher une équipe..."
                                    value={filterTeamName}
                                    onChange={(e) => setFilterTeamName(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-transparent border-none rounded-lg text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-0"
                                />
                            </div>

                            {/* Divider */}
                            <div className="w-px h-6 bg-gray-300 mx-2 hidden md:block"></div>

                            {/* Filter Members */}
                            <div className="hidden md:flex items-center gap-3 px-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Membres</span>
                                <div className="w-32 px-2">
                                    <MultiRangeSlider
                                        min={0}
                                        max={10}
                                        onChange={(min, max) => {
                                            setFilterMinMembers(min);
                                            setFilterMaxMembers(max);
                                        }}
                                    />
                                </div>
                                <div className="text-xs font-bold text-primary bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100 min-w-[36px] text-center">
                                    {filterMinMembers}-{filterMaxMembers === 10 ? "10+" : filterMaxMembers}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsCreateTeamModalOpen(true)}
                            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-95 group"
                        >
                            <FontAwesomeIcon icon={faPlus} className="group-hover:rotate-90 transition-transform" />
                            <span className="hidden xl:inline">Nouvelle équipe</span>
                        </button>
                    </div>
                </div>

                {/* TEAMS GRID */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    {loadingTeams ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : filteredTeams.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-gray-400">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <FontAwesomeIcon icon={faUsers} className="text-2xl opacity-50" />
                            </div>
                            <p>Aucune équipe trouvée.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredTeams.map((team) => (
                                <div
                                    key={team.id}
                                    onMouseEnter={() => handleMouseEnter(team.id)}
                                    onClick={() => handleOpenTeam(team)}
                                    className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-primary/30 transition-all duration-200 cursor-pointer relative overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-gray-800 text-lg truncate pr-2 capitalize group-hover:text-primary transition-colors">
                                            {team.name}
                                        </h3>
                                        {loadingTeamId === team.id && (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary shrink-0"></div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <div className="bg-gray-100 px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5 text-gray-600">
                                            <FontAwesomeIcon icon={faUser} className="text-[10px]" />
                                            {team.number ?? 0} membre{(team.number ?? 0) > 1 ? "s" : ""}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* === PERSONS SECTION === */}
            <div className="flex-1 flex flex-col min-h-0 bg-white">
                {/* PERSONS HEADER & FILTERS */}
                <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0 gap-4 shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                            <FontAwesomeIcon icon={faUser} className="text-xl" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 leading-tight">Personnes</h2>
                            <p className="text-xs text-gray-500">{filteredPeople.length} personne(s)</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-gray-50 p-1.5 rounded-xl border border-gray-200 shadow-sm transition-all focus-within:shadow-md focus-within:border-secondary/30 focus-within:ring-2 focus-within:ring-secondary/10">
                            <div className="relative group w-64">
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-secondary transition-colors text-xs" />
                                <input
                                    type="text"
                                    placeholder="Rechercher une personne..."
                                    value={filterPersonName}
                                    onChange={(e) => setFilterPersonName(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-transparent border-none rounded-lg text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-0"
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => setIsCreatePersonOpen(true)}
                            className="flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/90 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-95 group"
                        >
                            <FontAwesomeIcon icon={faPlus} className="group-hover:rotate-90 transition-transform" />
                            <span className="hidden xl:inline">Nouvelle personne</span>
                        </button>
                    </div>
                </div>

                {/* PERSONS GRID */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loadingPersons ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
                        </div>
                    ) : filteredPeople.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-gray-400">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <FontAwesomeIcon icon={faUser} className="text-2xl opacity-50" />
                            </div>
                            <p>Aucune personne trouvée.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredPeople.map((person) => (
                                <div
                                    key={person.id}
                                    onClick={() => setSelectedPerson(person)}
                                    className="group flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-secondary/50 transition-all cursor-pointer"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm group-hover:bg-secondary/10 group-hover:text-secondary transition-colors shrink-0">
                                        {person.firstname?.[0]?.toUpperCase()}{person.lastname?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-800 truncate capitalize text-sm group-hover:text-secondary transition-colors">
                                            {person.firstname} {person.lastname}
                                        </h3>
                                        <p className="text-xs text-gray-500 truncate">{person.email || "Pas d'email"}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* MODALS SECTION */}
            {isCreateTeamModalOpen && (
                <CreateTeam
                    activeEventId={activeEventId}
                    onClose={() => setIsCreateTeamModalOpen(false)}
                    onTeamCreated={handleTeamCreated}
                />
            )}

            {/* Team Details Modal */}
            {selectedTeamData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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

            {isCreatePersonOpen && <CreatePerson onClose={() => setIsCreatePersonOpen(false)} onPersonCreated={handlePersonCreated} />}

            {selectedPerson && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <PersonDetails
                        person={selectedPerson}
                        activeEventId={activeEventId}
                        onClose={() => setSelectedPerson(null)}
                        onDelete={handlePersonDeleted}
                        onUpdate={handlePersonUpdate}
                        onTeamClick={(team) => setViewingTeam(team)}
                    />
                    <div className="absolute inset-0 -z-10" onClick={() => setSelectedPerson(null)}></div>
                </div>
            )}

            {/* Sub-modals inside modals (e.g. clicking a team from person details) */}
            {viewingPerson && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
                    <PersonDetails
                        person={viewingPerson}
                        activeEventId={activeEventId}
                        onClose={() => setViewingPerson(null)}
                        onDelete={() => {
                            setViewingPerson(null);
                        }}
                        onUpdate={(updatedPerson) => {
                            setViewingPerson(updatedPerson);
                            // Update parent modal data if needed
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

            {viewingTeam && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
                    <TeamDetails
                        teamId={viewingTeam.id}
                        teamName={viewingTeam.name}
                        activeEventId={activeEventId}
                        onClose={() => setViewingTeam(null)}
                        onDelete={() => {
                            setViewingTeam(null);
                        }}
                        onMemberClick={(member) => {
                            setViewingTeam(null);
                            setSelectedPerson(member);
                        }}
                    />
                    <div className="absolute inset-0 -z-10" onClick={() => setViewingTeam(null)}></div>
                </div>
            )}
        </div>
    );
}

export default TeamsAndPersons;
