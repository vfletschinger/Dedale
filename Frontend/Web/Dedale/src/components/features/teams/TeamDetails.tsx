import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { emit } from "@tauri-apps/api/event";
import SelectableList from "../../common/SelectableList";
import SearchableSelect from "../../common/SearchableSelect";
import { Equipement, Person, TeamEvent, TeamDetailData, EquipementAction } from "../../../types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faTools, faPen, faTrash, faTimes, faPlus, faCheck } from "@fortawesome/free-solid-svg-icons";

interface AvailableActionOption extends Equipement {
    temp_type: 'pose' | 'retrait';
    label: string;
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
    const [currentEvents, setCurrentEvents] = useState<TeamEvent[]>(data?.events || []);

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
                    invoke<TeamEvent[]>("fetch_team_events", { teamId }),
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

    // Filtres
    const [filterDate, setFilterDate] = useState("");
    const [filterTime, setFilterTime] = useState("");

    // Helper pour extraire date/heure d'un string ISO ou date
    const matchesFilter = (item: AvailableActionOption) => {
        const dateStr = item.temp_type === 'pose' ? item.date_pose : item.date_depose;
        if (!dateStr) return false;

        // Date match
        if (filterDate) {
            const d = new Date(dateStr);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const itemDate = `${yyyy}-${mm}-${dd}`;
            if (itemDate !== filterDate) return false;
        }

        // Time match (simple "starts with" usually enough for HH:mm)
        if (filterTime) {
            const d = new Date(dateStr);
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            const itemTime = `${hh}:${min}`;
            if (!itemTime.startsWith(filterTime)) return false;
        }

        return true;
    };

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
        <div className="bg-white w-full max-w-xl h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative ring-1 ring-black/5">

            {/* OVERLAY CONFIRMATION */}
            {showConfirm && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-red-50 p-4 rounded-full mb-4 ring-8 ring-red-50/50">
                        <FontAwesomeIcon icon={faTrash} className="h-8 w-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Supprimer l'équipe ?</h3>
                    <p className="text-gray-500 text-center mb-6 max-w-xs">Cette action est irréversible et supprimera toutes les données associées.</p>
                    <div className="flex gap-3 w-full max-w-xs">
                        <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors">Annuler</button>
                        <button onClick={handleDeleteTeam} disabled={isDeleting} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg shadow-red-600/20">{isDeleting ? "..." : "Confirmer"}</button>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-start shrink-0 bg-gray-50/30">
                <div className="flex-1 mr-4">
                    {isEditing ? (
                        <div className="flex flex-col gap-1">
                            <input
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="w-full text-xl font-bold text-gray-800 bg-white border border-primary/50 rounded-lg px-3 py-1 outline-none focus:ring-4 focus:ring-primary/10 text-transform: capitalize"
                                autoFocus
                            />
                            <div className="flex gap-2 mt-2">
                                <button onClick={handleSaveName} disabled={isSaving} className="text-xs bg-green-600 text-white px-2 py-1 rounded font-bold hover:bg-green-700 transition-colors">Enregistrer</button>
                                <button onClick={() => { setIsEditing(false); setEditedName(teamName); }} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded font-bold hover:bg-gray-300 transition-colors">Annuler</button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center gap-2 group">
                                <h2 className="text-2xl font-bold text-gray-800 truncate text-transform: capitalize">{editedName}</h2>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                    title="Modifier le nom"
                                >
                                    <FontAwesomeIcon icon={faPen} className="h-3 w-3" />
                                </button>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                                    {currentEvents.length > 0 ? currentEvents[0].name : "Aucun événement"}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {!isEditing && (
                        <button
                            onClick={() => invoke("create_team_mission_pdf", { teamId: teamId, eventId: activeEventId })}
                            className="px-3 py-1.5 text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors border border-primary/10"
                        >
                            <span className="mr-2">📄</span>PDF
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                        <FontAwesomeIcon icon={faTimes} className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* ONGLETS */}
            <div className="flex px-6 border-b border-gray-100 gap-6">
                <button
                    onClick={() => { if (!isEditing) setActiveTab('members'); setSelectedItemIds([]); }}
                    className={`pb-3 pt-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'members' ? 'text-primary border-primary' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                >
                    <FontAwesomeIcon icon={faUsers} className="mr-2" />
                    Membres <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md text-[10px] ml-1">{currentMembers.length}</span>
                </button>
                <button
                    onClick={() => { if (!isEditing) setActiveTab('equipements'); setSelectedItemIds([]); }}
                    className={`pb-3 pt-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'equipements' ? 'text-primary border-primary' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                >
                    <FontAwesomeIcon icon={faTools} className="mr-2" />
                    Équipements <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md text-[10px] ml-1">{currentActions.length}</span>
                </button>
            </div>

            {/* TOOLBAR ACTIONS */}
            <div className="px-6 py-3 bg-gray-50/50 flex items-center justify-between min-h-[52px]">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => activeTab == "equipements" ? setSelectedItemIds(currentActions.map((action) => action.action_id)) : activeTab == "members" ? setSelectedItemIds(currentMembers.map((member) => member.id)) : ""}
                        className="text-xs font-medium text-gray-600 hover:text-primary transition-colors hover:underline"
                    >
                        Tout sélectionner
                    </button>
                    {selectedItemIds.length > 0 && (
                        <>
                            <span className="text-gray-300">|</span>
                            <button onClick={() => setSelectedItemIds([])} className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                                Annuler
                            </button>
                        </>
                    )}
                </div>

                {selectedItemIds.length > 0 ? (
                    <div className="flex items-center gap-3 animate-in slide-in-from-right-2 duration-200">
                        <span className="text-xs font-semibold text-primary">{selectedItemIds.length} sélectionné(s)</span>
                        <button
                            onClick={() => setShowMultiDeleteConfirm(true)}
                            className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faTrash} /> Supprimer
                        </button>
                    </div>
                ) : (
                    <div></div>
                )}
            </div>

            {/* CONTENU SCANROLLABLE */}
            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar bg-white">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <p className="text-sm">Chargement...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === "members" && (
                            <div className="flex flex-col gap-4">
                                {!isEditing && (isAddingMember ? (
                                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 animate-in slide-in-from-top-2">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-xs font-bold text-primary uppercase tracking-wider">Ajouter un membre</p>
                                            <button onClick={() => setIsAddingMember(false)} className="text-gray-400 hover:text-gray-600"><FontAwesomeIcon icon={faTimes} /></button>
                                        </div>
                                        <div className="flex gap-2">
                                            <SearchableSelect
                                                options={availablePeople.map(p => ({
                                                    value: p.id,
                                                    label: `${p.firstname} ${p.lastname}`,
                                                    data: p
                                                }))}
                                                value={selectedPersonId}
                                                onChange={setSelectedPersonId}
                                                placeholder="Sélectionner une personne..."
                                                searchPlaceholder="Rechercher par nom..."
                                                className="flex-1"
                                            />
                                            <button onClick={confirmAddMember} disabled={!selectedPersonId} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                                                Ajouter
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={startAddingMember}
                                        className="w-full py-3 border border-dashed border-gray-300 rounded-xl text-gray-500 text-sm font-medium hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 group"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-gray-100 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                                            <FontAwesomeIcon icon={faPlus} className="text-xs" />
                                        </div>
                                        Ajouter un membre
                                    </button>
                                ))}

                                <div className="space-y-1">
                                    <SelectableList
                                        items={currentMembers}
                                        selectedIds={selectedItemIds}
                                        onSelectionChange={setSelectedItemIds}
                                        renderItem={(member, isSelected) => (
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                    <div
                                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${isSelected ? 'bg-primary border-primary text-white' : 'border-gray-300 bg-white'}`}
                                                    >
                                                        {isSelected && <FontAwesomeIcon icon={faCheck} className="text-[10px]" />}
                                                    </div>

                                                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-gray-100 to-gray-200 shrink-0 flex items-center justify-center text-gray-600 font-bold text-sm shadow-inner">
                                                        {member.firstname[0].toUpperCase()}{member.lastname[0].toUpperCase()}
                                                    </div>

                                                    <div className="overflow-hidden">
                                                        <button
                                                            data-no-select
                                                            className="text-left w-full"
                                                            onClick={(e) => {
                                                                if (!isEditing) {
                                                                    e.stopPropagation();
                                                                    onMemberClick(member);
                                                                }
                                                            }}>
                                                            <p className="font-semibold text-gray-800 truncate text-transform: capitalize hover:text-primary transition-colors">
                                                                {member.firstname} {member.lastname}
                                                            </p>
                                                            <p className="text-xs text-gray-400 truncate">{member.email}</p>
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
                                                    className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === "equipements" && (
                            <div className="flex flex-col gap-4">
                                {!isEditing && (isAddingEquipementAction ? (
                                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 animate-in slide-in-from-top-2">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-xs font-bold text-primary uppercase tracking-wider">Ajouter un équipement</p>
                                            <button onClick={() => setIsAddingEquipementAction(false)} className="text-gray-400 hover:text-gray-600"><FontAwesomeIcon icon={faTimes} /></button>
                                        </div>
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                type="date"
                                                value={filterDate}
                                                onChange={(e) => setFilterDate(e.target.value)}
                                                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-primary/20 outline-none"
                                            />
                                            <input
                                                type="time"
                                                value={filterTime}
                                                onChange={(e) => setFilterTime(e.target.value)}
                                                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-primary/20 outline-none"
                                            />
                                            {(filterDate || filterTime) && (
                                                <button
                                                    onClick={() => { setFilterDate(""); setFilterTime(""); }}
                                                    className="text-gray-400 hover:text-gray-600 px-1"
                                                    title="Effacer les filtres"
                                                >
                                                    <FontAwesomeIcon icon={faTimes} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <SearchableSelect
                                                options={availableEquipements
                                                    .filter(action => matchesFilter(action as unknown as AvailableActionOption))
                                                    .map((action) => {
                                                        const item = action as unknown as AvailableActionOption;
                                                        return {
                                                            value: `${item.id}|${item.temp_type}`,
                                                            label: item.label,
                                                            data: item
                                                        };
                                                    })}
                                                value={selectedEquipementId}
                                                onChange={setSelectedEquipementId}
                                                placeholder="Choisir un équipement..."
                                                searchPlaceholder="Rechercher un équipement..."
                                                className="flex-1"
                                                renderOption={(opt) => (
                                                    <div className="flex items-center justify-between w-full">
                                                        <span>{opt.data.label.split('(')[0]}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${opt.data.temp_type === 'pose' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                            {opt.data.temp_type}
                                                        </span>
                                                    </div>
                                                )}
                                            />
                                            <button onClick={confirmAddEquipementAction} disabled={!selectedEquipementId} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">Ajouter</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={startAddingEquipementAction}
                                        className="w-full py-3 border border-dashed border-gray-300 rounded-xl text-gray-500 text-sm font-medium hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 group"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-gray-100 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                                            <FontAwesomeIcon icon={faPlus} className="text-xs" />
                                        </div>
                                        Ajouter un équipement
                                    </button>
                                ))}

                                <div className="space-y-1">
                                    <SelectableList
                                        items={currentActions.map(a => ({ ...a, id: a.action_id }))}
                                        selectedIds={selectedItemIds}
                                        onSelectionChange={setSelectedItemIds}
                                        renderItem={(equipement, isSelected) => (
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                    <div
                                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${isSelected ? 'bg-primary border-primary text-white' : 'border-gray-300 bg-white'}`}
                                                    >
                                                        {isSelected && <FontAwesomeIcon icon={faCheck} className="text-[10px]" />}
                                                    </div>

                                                    <div className="overflow-hidden">
                                                        <p className="font-semibold text-gray-800 text-sm truncate text-transform: capitalize">
                                                            {equipement.type_name}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${equipement.action_type === 'pose' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                {equipement.action_type}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400">
                                                                {/* Optional: Add date here if available in object */}
                                                            </span>
                                                        </div>
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
                                                    className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                                >
                                                    <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    />
                                </div>
                            </div>)
                        }
                    </>
                )}
            </div>

            {
                showMultiDeleteConfirm && (
                    <div className="absolute inset-x-4 bottom-4 z-[60] bg-white rounded-xl shadow-2xl p-4 border border-gray-100 animate-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-red-100 p-2 rounded-full">
                                    <FontAwesomeIcon icon={faTrash} className="text-red-600" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">Supprimer {selectedItemIds.length} élément(s) ?</h4>
                                    <p className="text-xs text-gray-500">Cette action est immédiate.</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowMultiDeleteConfirm(false)}
                                    className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-200"
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
                                    }}
                                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
                                >
                                    Confirmer
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* FOOTER */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                <button onClick={() => setShowConfirm(true)} className="flex items-center gap-2 text-red-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium">
                    <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                    <span>Supprimer l'équipe</span>
                </button>
                <button onClick={onClose} className="px-5 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-100 hover:shadow-sm transition-all shadow-xs">
                    Fermer
                </button>
            </div>
        </div >
    );
}