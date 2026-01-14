import { invoke } from "@tauri-apps/api/core";
import toast from "react-hot-toast";
import { emit } from "@tauri-apps/api/event";
import { useState, useEffect, useMemo, useCallback } from "react";
import TeamDetails, { TeamDetailData, Person, Event, EquipementAction } from "./TeamDetails";
import CreateTeam from "./CreateTeam";
import CreatePerson from "./CreatePerson";
import PersonDetails from "./PersonDetails";
import { listen } from "@tauri-apps/api/event";
import MultiRangeSlider from "./MultiRangeSlider";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faUsers, faUser, faPlus } from "@fortawesome/free-solid-svg-icons";

interface Team {
    id: string;
    name: string;
    number: number;
    eventId: string;
}

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
            const matchMembers = team.number >= filterMinMembers && team.number <= effectiveMax;
            return matchName && matchMembers;
        });
    }, [teams, filterTeamName, filterMinMembers, filterMaxMembers]);

    const fetchDetailsForTeam = async (teamId: string): Promise<TeamDetailData> => {
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
        <div className="flex flex-col gap-6 relative h-full p-6 overflow-y-auto">
            {/* === TEAMS SECTION === */}
            <div className="flex gap-6 relative min-h-0">
                {isCreateTeamModalOpen && (
                    <CreateTeam
                        activeEventId={activeEventId}
                        onClose={() => setIsCreateTeamModalOpen(false)}
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

                {/* TEAMS SIDEBAR */}
                <div className="w-64 p-6 bg-white rounded-lg shadow-lg shrink-0 flex flex-col gap-6">
                    <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                        <FontAwesomeIcon icon={faSearch} /> Filtres Équipes
                    </h2>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
                            Nom
                        </label>
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={filterTeamName}
                            onChange={(e) => setFilterTeamName(e.target.value)}
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

                    <div className="mt-auto pt-4 text-xs text-gray-400 text-center border-t border-gray-100">
                        <p className="mb-2">
                            <b>{filteredTeams.length}</b> / {teams.length} équipes
                        </p>

                        {(filterTeamName || filterMinMembers > 0 || filterMaxMembers < 10) && (
                            <button
                                onClick={() => {
                                    setFilterTeamName("");
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

                {/* TEAMS CONTENT */}
                <div className="flex-1 p-6 bg-white rounded-lg shadow-lg flex flex-col relative overflow-hidden">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <FontAwesomeIcon icon={faUsers} /> Équipes
                        {filteredTeams.length !== teams.length && (
                            <span className="text-sm font-normal text-gray-500 ml-2">
                                (Filtrées)
                            </span>
                        )}
                    </h2>

                    {loadingTeams ? (
                        <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="overflow-y-auto flex-1 pb-4">
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
                        onClick={() => setIsCreateTeamModalOpen(true)}
                        className="absolute bottom-4 right-4 w-10 h-10 bg-primary hover:opacity-90 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 cursor-pointer active:scale-95 transition-all duration-200 flex items-center justify-center z-10 group"
                        title="Créer une nouvelle équipe"
                    >
                        <FontAwesomeIcon icon={faPlus} className="h-6 w-6 transition-transform group-hover:rotate-90" />
                    </button>
                </div>
            </div>

            {/* === PERSONS SECTION === */}
            <div className="flex gap-6 relative min-h-0">
                {isCreatePersonOpen && <CreatePerson onClose={() => setIsCreatePersonOpen(false)} onPersonCreated={handlePersonCreated} />}
                {selectedPerson && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
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
                {viewingTeam && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
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
                            }
                            }
                        />
                        <div className="absolute inset-0 -z-10" onClick={() => setViewingTeam(null)}></div>
                    </div>
                )}

                {/* PERSONS SIDEBAR */}
                <div className="w-64 p-6 bg-white rounded-lg shadow-lg shrink-0 flex flex-col gap-6">
                    <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><FontAwesomeIcon icon={faSearch} /> Filtres Personnes</h2>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Recherche</label>
                        <input
                            type="text"
                            placeholder="Nom, prénom, email..."
                            value={filterPersonName}
                            onChange={(e) => setFilterPersonName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                    <div className="mt-auto text-center text-xs text-gray-400">
                        {filteredPeople.length} personne(s)
                    </div>
                </div>

                {/* PERSONS CONTENT */}
                <div className="flex-1 p-6 bg-white rounded-lg shadow-lg flex flex-col relative overflow-hidden">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><FontAwesomeIcon icon={faUser} /> Personnes</h2>

                    {loadingPersons ? (
                        <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
                    ) : (
                        <div className="overflow-y-auto flex-1 pb-4">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pr-2 p-1">
                                {filteredPeople.length === 0 ? (
                                    <div className="col-span-full text-center text-gray-400 py-10">Aucune personne trouvée.</div>
                                ) : (
                                    filteredPeople.map(person => (
                                        <div
                                            key={person.id}
                                            onClick={() => setSelectedPerson(person)}
                                            className="p-4 bg-white border border-gray-300 rounded-xl hover:shadow-md hover:border-primary/50 transition-all cursor-pointer flex items-center gap-4 group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                {person.firstname[0].toUpperCase()}{person.lastname[0].toUpperCase()}
                                            </div>
                                            <div className="overflow-hidden">
                                                <h3 className="font-semibold text-gray-800 truncate text-transform: capitalize">{person.firstname} {person.lastname}</h3>
                                                <p className="text-xs text-gray-500 truncate">{person.email || "Pas d'email"}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setIsCreatePersonOpen(true)}
                        className="absolute bottom-4 right-4 w-10 h-10 bg-primary hover:opacity-90 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 cursor-pointer active:scale-95 transition-all duration-200 flex items-center justify-center z-10 group"
                    >
                        <FontAwesomeIcon icon={faPlus} className="h-6 w-6 transition-transform group-hover:rotate-90" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TeamsAndPersons;
