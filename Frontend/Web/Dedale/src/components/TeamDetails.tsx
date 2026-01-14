import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { emit } from "@tauri-apps/api/event";
import SelectableList from "./SelectableList";
import { Equipement } from "../types/map";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faTools, faPen, faTrash, faTimes } from "@fortawesome/free-solid-svg-icons";

interface AvailableActionOption extends Equipement {
    temp_type: 'pose' | 'retrait';
    label: string;
}

export interface EquipementAction extends Equipement {
    action_id: string;
    action_type: string;
}

export interface TeamDetailData {
    members: Person[];
    events: Event[];
    actions: EquipementAction[];
}

export interface Person {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    phone_number: string;
}

export interface Event {
    id: number;
    name: string;
    statut: string;
}

interface TeamDetailsProps {
    teamId: string;
    teamName: string;
    data?: TeamDetailData;
    activeEventId: string | null;
    onClose: () => void;
    onDelete: (teamId: string) => void;
    onMemberClick: (person: Person) => void;
}

export default function TeamDetails({ teamId, teamName, data, onClose, onDelete, onMemberClick, activeEventId }: TeamDetailsProps) {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'members' | 'equipements'>('members');
    const [showConfirm, setShowConfirm] = useState(false);

    // --- ÉTATS ÉDITION ---
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(teamName);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // --- ÉTATS LOCAUX ---
    const [currentMembers, setCurrentMembers] = useState<Person[]>(data?.members || []);
    const [currentEvents, setCurrentEvents] = useState<Event[]>(data?.events || []);

    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    const [showMultiDeleteConfirm, setShowMultiDeleteConfirm] = useState(false);
    const [currentActions, setCurrentActions] = useState<EquipementAction[]>([]);

    useEffect(() => {
        setEditedName(teamName);
        setIsEditing(false);

        if (data) {
            setCurrentMembers(data.members);
            setCurrentEvents(data.events);
            setCurrentActions(data.actions);
            return;
        }

        const loadData = async () => {
            setLoading(true);
            try {
                const [m, e, eq] = await Promise.all([
                    invoke<Person[]>("fetch_team_members", { teamId }),
                    invoke<Event[]>("fetch_team_events", { teamId }),
                    invoke<EquipementAction[]>("fetch_team_actions", { teamId }),
                ]);
                setCurrentMembers(m);
                setCurrentEvents(e);
                setCurrentActions(eq);
            }
            catch (err) {
                console.error(err);
            }
            finally {
                setLoading(false);
            }
        };
        loadData();
    }, [teamId, data, teamName]);


    // ========================
    // LOGIQUE MEMBRES
    // ========================
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [availablePeople, setAvailablePeople] = useState<Person[]>([]);
    const [selectedPersonId, setSelectedPersonId] = useState<string>("");

    const handleRemoveMember = async (personId: string) => {
        try {
            await invoke("remove_member", { teamId, personId });
            setCurrentMembers(currentMembers.filter(m => m.id !== personId));
            await emit("team-update");
            toast.success("Membre retiré");
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors du retrait du membre");
        }
    };

    const startAddingMember = async () => {
        setIsAddingMember(true);
        try {
            const allPeople = await invoke<Person[]>("fetch_people");
            const existingIds = new Set(currentMembers.map(m => m.id));
            setAvailablePeople(allPeople.filter(p => !existingIds.has(p.id)));
        } catch (e) { console.error(e); }
    };

    const confirmAddMember = async () => {
        if (!selectedPersonId) return;
        try {
            await invoke("add_member", { teamId, personId: selectedPersonId });
            const personToAdd = availablePeople.find(p => p.id === selectedPersonId);
            if (personToAdd) setCurrentMembers([...currentMembers, personToAdd]);
            setIsAddingMember(false);
            setSelectedPersonId("");
            await emit("team-update");
            toast.success("Membre ajouté");
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de l'ajout du membre");
        }
    };

    const handleRemoveSelectedMembers = async () => {
        try {
            setLoading(true);
            await Promise.all(
                selectedItemIds.map(id => invoke("remove_member", { teamId, personId: id }))
            );

            setCurrentMembers(prev => prev.filter(m => !selectedItemIds.includes(m.id)));
            setSelectedItemIds([]);
            setShowMultiDeleteConfirm(false);
            await emit("team-update");
            toast.success(`${selectedItemIds.length} membres retirés`);
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de la suppression des membres");
        } finally {
            setLoading(false);
        }
    };


    // ========================
    // LOGIQUE EQUIPEMENTS
    // ========================
    const [isAddingEquipementAction, setIsAddingEquipementAction] = useState(false);
    const [availableEquipements, setavailableEquipements] = useState<Equipement[]>([]);
    const [selectedEquipementId, setSelectedEquipementId] = useState<string>("");

    const handleRemoveEquipementAction = async (actionId: string) => {
        try {
            await invoke("delete_action", { actionId });
            setCurrentActions(currentActions.filter(e => e.action_id !== actionId));
            await emit("team-update");
            toast.success("Action supprimée");
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de la suppression de l'action");
        }
    };

    const startAddingEquipementAction = async () => {
        setIsAddingEquipementAction(true);
        try {
            const allEquipements = await invoke<Equipement[]>("fetch_equipements_for_event", { eventId: activeEventId });

            const actionsList: AvailableActionOption[] = [];

            // Pour chaque équipement, vérifier quelles actions sont déjà assignées (toutes équipes confondues)
            for (const eq of allEquipements) {
                const format = (d: string | undefined) => {
                    if (!d) return "Non planifié";
                    const date = new Date(d);
                    return date.toLocaleString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                };

                // Récupérer toutes les actions de cet équipement (toutes équipes)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const allEquipementActions = await invoke<any[]>("fetch_actions_for_equipement", { equipementId: eq.id });
                
                const takenTypes = new Set(allEquipementActions.map(a => a.action_type));

                if (!takenTypes.has('pose')) {
                    actionsList.push({
                        ...eq,
                        temp_type: 'pose',
                        label: `${eq.type_name} • Pose • ${format(eq.date_pose)}`
                    });
                }
                if (!takenTypes.has('retrait')) {
                    actionsList.push({
                        ...eq,
                        temp_type: 'retrait',
                        label: `${eq.type_name} • Retrait • ${format(eq.date_depose)}`
                    });
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setavailableEquipements(actionsList as any);
        } catch (e) { console.error(e); }
    };

    const confirmAddEquipementAction = async () => {
        if (!selectedEquipementId) return;
        const [equipId, actionType] = selectedEquipementId.split('|');

        try {
            const newActionId = await invoke<string>("add_action", {
                teamId,
                equipementId: equipId,
                actionType
            });

            const equipmentData = availableEquipements.find(e => e.id === equipId);

            if (equipmentData) {
                setCurrentActions(prev => [
                    ...prev,
                    {
                        ...equipmentData,
                        action_id: newActionId,
                        action_type: actionType
                    } as EquipementAction
                ]);
            }

            setIsAddingEquipementAction(false);
            setSelectedEquipementId("");
            await emit("team-update");
            toast.success("Action ajoutée");
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de l'ajout de l'action");
        }
    };

    const handleRemoveSelectedEquipements = async () => {
        try {
            setLoading(true);
            await Promise.all(
                selectedItemIds.map(id => invoke("delete_action", { actionId: id }))
            );

            setCurrentActions(prev => prev.filter(m => !selectedItemIds.includes(m.action_id)));
            setSelectedItemIds([]);
            setShowMultiDeleteConfirm(false);
            await emit("team-update");
            toast.success(`${selectedItemIds.length} actions supprimées`);
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de la suppression des actions");
        } finally {
            setLoading(false);
        }
    };

    // ========================
    // LOGIQUE SUPPRESSION EQUIPE
    // ========================
    const handleDeleteTeam = async () => {
        setIsDeleting(true);
        try {
            await invoke("delete_team", { teamId });
            onDelete(teamId);
            onClose();
            toast.success("Équipe supprimée");
        } catch (error) {
            console.error("Erreur suppression:", error);
            toast.error("Erreur lors de la suppression de l'équipe");
            setIsDeleting(false);
        }
    };

    const handleSaveName = async () => {
        if (!editedName.trim()) return;
        setIsSaving(true);
        try {
            await invoke("update_team", { id: teamId, name: editedName });
            setIsEditing(false);
            await emit("team-update");
            toast.success("Nom de l'équipe modifié");
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de la modification");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white w-full max-w-md h-[500px] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative">

            {/* OVERLAY CONFIRMATION */}
            {showConfirm && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-red-50 p-4 rounded-full mb-4">
                        <FontAwesomeIcon icon={faTrash} className="h-8 w-8 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Supprimer l'équipe ?</h3>
                    <div className="flex gap-3 w-full mt-4">
                        <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg text-gray-700">Annuler</button>
                        <button onClick={handleDeleteTeam} disabled={isDeleting} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">{isDeleting ? "..." : "Confirmer"}</button>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center shrink-0 relative">
                <div className="flex-1 mr-4">
                    {isEditing ? (
                        <input
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="w-full text-lg font-bold text-gray-800 bg-white border border-primary/50 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 text-transform: capitalize"
                            autoFocus
                        />
                    ) : (
                        <h2 className="text-lg font-bold text-gray-800 truncate text-transform: capitalize">{editedName}</h2>
                    )}
                    <p className="text-xs text-gray-500 text-transform: capitalize">{currentEvents.length === 0 ? "" : currentEvents[0].name}</p>
                </div>

                <div className="flex items-center gap-2">
                    {!isEditing && (
                        <button
                            onClick={() => invoke("create_team_mission_pdf", { teamId: teamId, eventId: activeEventId })}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer"
                            title="Créer pdf avec planning"
                        >
                            Créer pdf
                        </button>
                    )}
                    {/* Bouton Edit (Crayon) */}
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer"
                            title="Modifier le nom"
                        >
                            <FontAwesomeIcon icon={faPen} className="h-4 w-4" />
                        </button>
                    )}
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-400 cursor-pointer">✕</button>
                </div>
            </div>

            {/* ONGLETS */}
            <div className="flex border-b border-gray-100 shrink-0">
                <button onClick={() => { if (!isEditing) setActiveTab('members'); setSelectedItemIds([]); }} className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'members' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-500 hover:text-gray-700'}`}>
                    <FontAwesomeIcon icon={faUsers} /> Membres ({currentMembers.length})
                </button>
                <button onClick={() => { if (!isEditing) setActiveTab('equipements'); setSelectedItemIds([]); }} className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'equipements' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-500 hover:text-gray-700'}`}>
                    <FontAwesomeIcon icon={faTools} /> Equipements ({currentActions.length})
                </button>
            </div>

            {/* CONTENU */}
            < div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="flex items-center justify-center gap-2 bg-primary/10 p-2 rounded-lg border border-primary/20 animate-in slide-in-from-top-2 duration-200"><button
                    onClick={() => activeTab == "equipements" ? setSelectedItemIds(currentActions.map((action) => action.action_id)) : activeTab == "members" ? setSelectedItemIds(currentMembers.map((member) => member.id)) : ""}
                    className="text-[10px] sm:text-xs bg-gray-500 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition-colors font-bold whitespace-nowrap"
                >
                    Tout sélectionner
                </button>

                    {selectedItemIds.length > 0 && (
                        <>
                            <button
                                onClick={() => setSelectedItemIds([])}
                                className="text-[10px] sm:text-xs bg-gray-500 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition-colors font-bold whitespace-nowrap"
                            >
                                Tout déselectionner
                            </button>
                            <button
                                onClick={() => setShowMultiDeleteConfirm(true)}
                                className="text-[10px] sm:text-xs bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 transition-colors font-bold whitespace-nowrap"
                            >
                                Supprimer sélection
                            </button>
                        </>
                    )}
                </div>
                <span className="text-xs font-medium text-primary">
                    {selectedItemIds.length} élément(s) sélectionné(s)
                </span>
                {loading ?
                    <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
                    :
                    activeTab == "members"
                    &&
                    (<div>
                        {!isEditing && (isAddingMember ? (
                            <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                                <p className="text-xs font-bold text-primary mb-2">Ajouter un membre</p>
                                <div className="flex gap-2">
                                    <select value={selectedPersonId} onChange={(e) => setSelectedPersonId(e.target.value)} className="flex-1 text-sm border border-primary/30 rounded px-2 py-1 outline-none cursor-pointer">
                                        <option value="">Choisir...</option>
                                        {availablePeople.map(p => <option key={p.id} value={p.id}>{p.firstname} {p.lastname}</option>)}
                                    </select>
                                    <button onClick={confirmAddMember} disabled={!selectedPersonId} className="bg-secondary text-white px-3 py-1 rounded text-sm hover:bg-secondary/90 cursor-pointer">OK</button>
                                    <button onClick={() => setIsAddingMember(false)} className="text-gray-500 px-2 cursor-pointer">✕</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={startAddingMember} className="w-full py-2 mt-2 border border-dashed border-gray-300 rounded-lg text-gray-500 text-xs hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1 cursor-pointer">
                                <span>+</span> Ajouter un membre
                            </button>
                        ))}
                        <SelectableList
                            items={currentMembers}
                            selectedIds={selectedItemIds}
                            onSelectionChange={setSelectedItemIds}
                            renderItem={(member, isSelected) => (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 shrink-0 flex items-center justify-center text-primary font-bold text-xs">
                                            {member.firstname[0].toUpperCase()}{member.lastname[0].toUpperCase()}
                                        </div>
                                        <input type="checkbox" checked={isSelected} readOnly />
                                        <div className="overflow-hidden">
                                            <button
                                                data-no-select
                                                onClick={(e) => {
                                                    if (!isEditing) {
                                                        e.stopPropagation();
                                                        onMemberClick(member);
                                                    }
                                                }}>
                                                <p className="hover:text-primary transition-colors cursor-pointer text-sm font-medium text-gray-800 truncate text-transform: capitalize">
                                                    {member.firstname} {member.lastname}
                                                </p>
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        data-no-select
                                        onClick={(e) => {
                                            if (!isEditing) {
                                                e.stopPropagation();
                                                handleRemoveMember(member.id);
                                            }
                                        }}
                                        className="text-gray-300 hover:text-red-500 p-1 cursor-pointer"
                                    >
                                        <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        />
                    </div>)
                    ||
                    activeTab == "equipements"
                    &&
                    (<div>
                        {!isEditing && (isAddingEquipementAction ? (
                            <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                                <p className="text-xs font-bold text-primary mb-2">Ajouter un membre</p>
                                <div className="flex gap-2">
                                    <select value={selectedEquipementId} onChange={(e) => setSelectedEquipementId(e.target.value)} className="flex-1 text-sm border border-primary/30 rounded px-2 py-1 outline-none cursor-pointer">
                                        <option value="">Choisir...</option>
                                        {availableEquipements.map((action) => {
                                            const item = action as unknown as AvailableActionOption;
                                            return (
                                                <option key={`${item.id}-${item.temp_type}`} value={`${item.id}|${item.temp_type}`}>
                                                    {item.label}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <button onClick={confirmAddEquipementAction} disabled={!selectedEquipementId} className="bg-secondary text-white px-3 py-1 rounded text-sm hover:bg-secondary/90 cursor-pointer">OK</button>
                                    <button onClick={() => setIsAddingEquipementAction(false)} className="text-gray-500 px-2 cursor-pointer">✕</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={startAddingEquipementAction} className="w-full py-2 mt-2 border border-dashed border-gray-300 rounded-lg text-gray-500 text-xs hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1 cursor-pointer">
                                <span>+</span> Ajouter un Equipement
                            </button>
                        ))}
                        <SelectableList
                            items={currentActions.map(a => ({ ...a, id: a.action_id }))}
                            selectedIds={selectedItemIds}
                            onSelectionChange={setSelectedItemIds}
                            renderItem={(equipement, isSelected) => (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                                        <input type="checkbox" checked={isSelected} readOnly />
                                        <div className="overflow-hidden">
                                            <p className="hover:text-primary transition-colors cursor-pointer text-sm font-medium text-gray-800 truncate text-transform: capitalize">
                                                {equipement.type_name}
                                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                                                    {equipement.action_type}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        data-no-select
                                        onClick={(e) => {
                                            if (!isEditing) {
                                                e.stopPropagation();
                                                handleRemoveEquipementAction(equipement.action_id);
                                            }
                                        }}
                                        className="text-gray-300 hover:text-red-500 p-1 cursor-pointer"
                                    >
                                        <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        />
                    </div>)
                }
            </div>


            {showMultiDeleteConfirm && (
                <div className="absolute inset-0 z-[60] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
                    <div className="bg-red-100 p-4 rounded-full mb-4">
                        <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Supprimer les éléments sélectionnés ?</h3>
                    <p className="text-sm text-gray-500 mt-2">
                        Vous allez retirer {selectedItemIds.length} éléments de l'équipe "{teamName}".
                    </p>
                    <div className="flex gap-3 w-full mt-6">
                        <button
                            onClick={() => setShowMultiDeleteConfirm(false)}
                            className="flex-1 px-4 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={() => {
                                if (activeTab === "members") {
                                    handleRemoveSelectedMembers();
                                } else if (activeTab === "equipements") {
                                    handleRemoveSelectedEquipements();
                                }
                            }} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold"
                        >
                            Confirmer
                        </button>
                    </div>
                </div>
            )}

            {/* FOOTER */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                {isEditing ? (
                    <div className="flex gap-2 w-full">
                        <button onClick={() => { setIsEditing(false); setEditedName(teamName); }} className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">Annuler</button>
                        <button onClick={handleSaveName} disabled={isSaving} className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center justify-center gap-2 cursor-pointer">
                            {isSaving && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                            Enregistrer
                        </button>
                    </div>
                ) : (
                    <>
                        <button onClick={() => setShowConfirm(true)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
                            <FontAwesomeIcon icon={faTrash} className="h-5 w-5" />
                        </button>
                        <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 cursor-pointer">Fermer</button>
                    </>
                )}
            </div>
        </div>
    );
}