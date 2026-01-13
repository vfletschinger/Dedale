import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect, useMemo } from "react";
import CreatePerson, { Person } from "./CreatePerson";
import PersonDetails from "./PersonDetails";
import { listen } from "@tauri-apps/api/event";
import TeamDetails from "./TeamDetails";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faUser, faPlus } from "@fortawesome/free-solid-svg-icons";

interface Team { id: string; name: string; }

export default function Persons({ activeEventId }: { activeEventId: string | null; }) {
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterName, setFilterName] = useState("");

    // Modales
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [viewingTeam, setViewingTeam] = useState<Team | null>(null);

    const loadPeople = async () => {
        setLoading(true);
        try {
            const data = await invoke<Person[]>("fetch_people");
            setPeople(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unlistenNav = listen<{ id: string }>('navigate-to-person', (event) => {
            const targetId = event.payload.id;
            setPeople(currentPeople => {
                const found = currentPeople.find(p => p.id === targetId);
                if (found) setSelectedPerson(found);
                return currentPeople;
            });
        });
        loadPeople();

        return () => { unlistenNav.then(f => f()); };
    }, []);

    // Filtrage
    const filteredPeople = useMemo(() => {
        return people.filter(p =>
            (p.firstname + " " + p.lastname).toLowerCase().includes(filterName.toLowerCase()) ||
            p.email?.toLowerCase().includes(filterName.toLowerCase())
        );
    }, [people, filterName]);

    // Actions
    const handleCreated = (newPerson: Person) => {
        setPeople([...people, newPerson]);
    };

    const handleDeleted = (id: string) => {
        setPeople(people.filter(p => p.id !== id));
        setSelectedPerson(null);
    };

    const handleUpdate = (updatedPerson: Person) => {
        setPeople(people.map(p => p.id === updatedPerson.id ? updatedPerson : p));
        setSelectedPerson(updatedPerson);
    };

    return (
        <div className="flex gap-6 relative h-full">
            {/* --- MODALES --- */}
            {isCreateOpen && <CreatePerson onClose={() => setIsCreateOpen(false)} onPersonCreated={handleCreated} />}
            {selectedPerson && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
                    <PersonDetails
                        person={selectedPerson}
                        activeEventId={activeEventId}
                        onClose={() => setSelectedPerson(null)}
                        onDelete={handleDeleted}
                        onUpdate={handleUpdate}
                        onTeamClick={(team) => setViewingTeam(team)}
                    />
                    <div className="absolute inset-0 -z-10" onClick={() => setSelectedPerson(null)}></div>
                </div>
            )}
            {/* NIVEAU 2 : DÉTAILS ÉQUIPE (Par-dessus la personne) */}
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

            {/* --- SIDEBAR FILTRES --- */}
            <div className="w-64 p-6 bg-white rounded-lg shadow-lg shrink-0 flex flex-col gap-6">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><FontAwesomeIcon icon={faSearch} /> Filtres</h2>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Recherche</label>
                    <input
                        type="text"
                        placeholder="Nom, prénom, email..."
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
                <div className="mt-auto text-center text-xs text-gray-400">
                    {filteredPeople.length} personne(s)
                </div>
            </div>

            {/* --- CONTENU --- */}
            <div className="flex-1 p-6 bg-white rounded-lg shadow-lg flex flex-col max-h-screen relative overflow-hidden">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><FontAwesomeIcon icon={faUser} /> Personnes</h2>

                {loading ? (
                    <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
                ) : (
                    <div className="overflow-y-auto flex-1 pb-20">
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

                {/* FAB AJOUT */}
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="absolute bottom-8 right-8 w-10 h-10 bg-primary hover:opacity-90 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 cursor-pointer active:scale-95 transition-all duration-200 flex items-center justify-center z-10 group"
                >
                    <FontAwesomeIcon icon={faPlus} className="h-6 w-6 transition-transform group-hover:rotate-90" />
                </button>
            </div>
        </div>
    );
}