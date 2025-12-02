import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { Person } from "./CreatePerson";
import { emit } from "@tauri-apps/api/event";

// On a besoin de l'interface Team ici
interface Team {
    id: number;
    name: string;
}

interface PersonDetailsProps {
    person: Person;
    onClose: () => void;
    onDelete: (id: number) => void;
    onUpdate: (updatedPerson: Person) => void;
    onTeamClick: (team: Team) => void;
}

export default function PersonDetails({ person, onClose, onDelete, onUpdate, onTeamClick }: PersonDetailsProps) {
    const [activeTab, setActiveTab] = useState<'infos' | 'teams'>('infos');
    const [showConfirm, setShowConfirm] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Person>({ ...person });
    const [isSaving, setIsSaving] = useState(false);

    const [teams, setTeams] = useState<Team[]>([]);
    const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
    const [isAddingTeam, setIsAddingTeam] = useState(false);
    const [selectedTeamId, setSelectedTeamId] = useState("");

    useEffect(() => {
        invoke<Team[]>("fetch_person_teams", { personId: person.id }).then(setTeams).catch(console.error);
        setEditData({ ...person });
        setIsEditing(false);
    }, [person]);

    const handleDeletePerson = async () => {
        try {
            await invoke("delete_person", { personId: person.id });
            onDelete(person.id);
            await emit("team-update");
            onClose();
        } catch (e) { console.error(e); }
    };

    const handleRemoveFromTeam = async (teamId: number) => {
        try {
            await invoke("remove_member", { teamId, personId: person.id });
            setTeams(teams.filter(t => t.id !== teamId));
            await emit("team-update");
        } catch (e) { console.error(e); }
    };

    const startAddingTeam = async () => {
        setIsAddingTeam(true);
        try {
            const allTeams = await invoke<any[]>("fetch_teams");
            const existingIds = new Set(teams.map(t => t.id));
            setAvailableTeams(allTeams.filter((t: any) => !existingIds.has(t.id)));
        } catch (e) { console.error(e); }
    };

    const confirmAddTeam = async () => {
        if (!selectedTeamId) return;
        const tid = parseInt(selectedTeamId);
        try {
            await invoke("add_member", { teamId: tid, personId: person.id });
            const teamToAdd = availableTeams.find(t => t.id === tid);
            if (teamToAdd) setTeams([...teams, teamToAdd]);
            setIsAddingTeam(false);
            setSelectedTeamId("");
            await emit("team-update");
        } catch (e) { console.error(e); }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await invoke("update_person", {
                id: editData.id || "",
                firstname: editData.firstname || "",
                lastname: editData.lastname || "",
                email: editData.email || "",
                address: editData.address || "",
                phoneNumber: editData.phone_number || ""
            });

            onUpdate(editData);
            setIsEditing(false);
            await emit("team-update");
        } catch (e) {
            console.error(e);
            alert("Erreur lors de la sauvegarde : " + e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white w-full max-w-sm h-[500px] flex flex-col rounded-xl shadow-2xl overflow-hidden relative">

            {/* HEADER AVEC MODE ÉDITION */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 text-center border-b border-blue-100 relative flex-shrink-0">
                <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center text-2xl shadow-sm mb-3 text-blue-600 font-bold border border-blue-100">
                    {person.firstname[0]}{person.lastname[0]}
                </div>

                {isEditing ? (
                    <div className="flex gap-2 justify-center mb-1">
                        <input
                            value={editData.firstname}
                            onChange={e => setEditData({ ...editData, firstname: e.target.value })}
                            className="w-24 text-center border border-blue-300 rounded px-1 py-0.5 text-sm font-bold"
                            placeholder="Prénom"
                        />
                        <input
                            value={editData.lastname}
                            onChange={e => setEditData({ ...editData, lastname: e.target.value })}
                            className="w-24 text-center border border-blue-300 rounded px-1 py-0.5 text-sm font-bold"
                            placeholder="Nom"
                        />
                    </div>
                ) : (
                    <h2 className="text-xl font-bold text-gray-800">{person.firstname} {person.lastname}</h2>
                )}

                <p className="text-sm text-gray-500">Fiche membre</p>

                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Modifier"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                    </button>
                )}
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex border-t border-gray-200 border-b flex-shrink-0">
                <button onClick={() => isEditing ? "" : setActiveTab('infos')} className={`flex-1 py-2 text-xs font-medium ${activeTab === 'infos' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}>Informations</button>
                <button onClick={() => isEditing ? "" : setActiveTab('teams')} className={`flex-1 py-2 text-xs font-medium ${activeTab === 'teams' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}>Équipes ({teams.length})</button>
            </div>

            {/* CONTENU */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'infos' && (
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <p className="text-xs text-gray-400 uppercase mb-1">Email</p>
                            {isEditing ? <input value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} className="w-full text-sm bg-white border border-gray-300 rounded px-2 py-1" /> : <p className="text-sm text-gray-800 font-medium">{person.email || "-"}</p>}
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <p className="text-xs text-gray-400 uppercase mb-1">Téléphone</p>
                            {isEditing ? <input value={editData.phone_number} onChange={e => setEditData({ ...editData, phone_number: e.target.value })} className="w-full text-sm bg-white border border-gray-300 rounded px-2 py-1" /> : <p className="text-sm text-gray-800 font-medium">{person.phone_number || "-"}</p>}
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <p className="text-xs text-gray-400 uppercase mb-1">Adresse</p>
                            {isEditing ? <input value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} className="w-full text-sm bg-white border border-gray-300 rounded px-2 py-1" /> : <p className="text-sm text-gray-800 font-medium">{person.address || "-"}</p>}
                        </div>
                    </div>
                )}

                {activeTab === 'teams' && (
                    <div className="space-y-2">
                        {teams.map(team => (
                            <div
                                key={team.id}
                                onClick={() => isEditing ? "" : onTeamClick(team)}
                                className="flex justify-between items-center p-2 bg-white border border-gray-100 rounded-lg shadow-sm hover:border-blue-300 cursor-pointer group transition-all"
                            >
                                <span className="text-sm font-medium text-gray-700">{team.name}</span>
                                <button onClick={(e) => { isEditing ? "" : e.stopPropagation(); isEditing ? "" : handleRemoveFromTeam(team.id); }} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                        {isEditing ? "" : isAddingTeam ? (
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
                                <div className="flex gap-2">
                                    <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="flex-1 text-sm border border-blue-200 rounded px-2 py-1 outline-none">
                                        <option value="">Choisir...</option>
                                        {availableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    <button onClick={() => { isEditing ? "" : confirmAddTeam() }} disabled={!selectedTeamId} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">OK</button>
                                    <button onClick={() => isEditing ? "" : setIsAddingTeam(false)} className="text-gray-500 px-2">✕</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={startAddingTeam} className="w-full py-2 mt-4 border border-dashed border-gray-300 rounded-lg text-gray-500 text-xs hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-1">
                                <span>+</span> Rejoindre une équipe
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="bg-gray-50 p-4 flex justify-between items-center border-t border-gray-100 mt-auto flex-shrink-0">
                {isEditing ? (
                    <div className="flex gap-2 w-full">
                        <button onClick={() => { setIsEditing(false); setEditData({ ...person }); }} className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700">Annuler</button>
                        <button onClick={handleSave} disabled={isSaving} className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">{isSaving ? "..." : "Enregistrer"}</button>
                    </div>
                ) : (
                    showConfirm ? (
                        <div className="flex gap-2 w-full animate-in fade-in slide-in-from-right-2">
                            <button onClick={() => setShowConfirm(false)} className="flex-1 text-xs px-3 py-2 bg-gray-200 rounded text-gray-700">Annuler</button>
                            <button onClick={handleDeletePerson} className="flex-1 text-xs px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700">Confirmer</button>
                        </div>
                    ) : (
                        <>
                            <button onClick={() => setShowConfirm(true)} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            <button onClick={onClose} className="px-4 py-2 border border-gray-300 bg-white rounded text-xs font-medium text-gray-700 hover:bg-gray-50">Fermer</button>
                        </>
                    )
                )}
            </div>
        </div >
    );
}