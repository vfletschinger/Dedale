import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { Person, Team } from "../../../types";
import toast from "react-hot-toast";
import { emit } from "@tauri-apps/api/event";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTimes, faTrash } from "@fortawesome/free-solid-svg-icons";
import SearchableSelect from "../../common/SearchableSelect";

interface PersonDetailsProps {
  person: Person;
  activeEventId: string | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate: (updatedPerson: Person) => void;
  onTeamClick: (team: Team) => void;
}

export default function PersonDetails({
  person,
  activeEventId,
  onClose,
  onDelete,
  onUpdate,
  onTeamClick,
}: PersonDetailsProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"infos" | "teams">("infos");
  const [showConfirm, setShowConfirm] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Person>({ ...person });
  const [isSaving, setIsSaving] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  useEffect(() => {
    setLoading(true);
    if (activeEventId) {
      invoke<Team[]>("fetch_person_teams", {
        personId: person.id,
        eventId: activeEventId,
      })
        .then(setTeams)
        .catch(console.error);
    } else {
      invoke<Team[]>("fetch_person_teams", { personId: person.id })
        .then(setTeams)
        .catch(console.error);
    }
    setEditData({ ...person });
    setIsEditing(false);
    setLoading(false);
  }, [person, activeEventId]);

  const handleDeletePerson = async () => {
    try {
      await invoke("delete_person", { personId: person.id });
      onDelete(person.id);
      await emit("team-update");
      onClose();
      toast.success("Personne supprimée");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleRemoveFromTeam = async (teamId: string) => {
    try {
      await invoke("remove_member", { teamId, personId: person.id });
      setTeams(teams.filter((t) => t.id !== teamId));
      await emit("team-update");
      toast.success("Retiré de l'équipe");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du retrait de l'équipe");
    }
  };

  const startAddingTeam = async () => {
    setIsAddingTeam(true);
    try {
      let allTeams;
      if (activeEventId) {
        allTeams = await invoke<Team[]>("fetch_teams", {
          eventId: activeEventId,
        });
      } else {
        allTeams = await invoke<Team[]>("fetch_teams");
      }
      const existingIds = new Set(teams.map((t) => t.id));
      setAvailableTeams(allTeams.filter((t) => !existingIds.has(t.id)));
    } catch (e) {
      console.error(e);
    }
  };

  const confirmAddTeam = async () => {
    if (!selectedTeamId) return;
    try {
      await invoke("add_member", {
        teamId: selectedTeamId,
        personId: person.id,
      });
      const teamToAdd = availableTeams.find((t) => t.id === selectedTeamId);
      if (teamToAdd) setTeams([...teams, teamToAdd]);
      setIsAddingTeam(false);
      setSelectedTeamId("");
      await emit("team-update");
      toast.success("Ajouté à l'équipe");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'ajout à l'équipe");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await invoke("update_person", {
        id: editData.id || "",
        firstname: editData.firstname || "",
        lastname: editData.lastname || "",
        email: editData.email || "",
        phoneNumber: editData.phone_number || "",
      });

      onUpdate(editData);
      setIsEditing(false);
      await emit("team-update");
      toast.success("Profil mis à jour");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la sauvegarde : " + e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white w-full max-w-sm h-[500px] flex flex-col rounded-xl shadow-2xl overflow-hidden relative">
      {/* HEADER AVEC MODE ÉDITION */}
      <div className="bg-linear-to-r from-primary/10 to-indigo-50 p-6 text-center border-b border-primary/20 relative shrink-0">
        <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center text-2xl shadow-sm mb-3 text-primary font-bold border border-primary/20">
          {person.firstname[0].toUpperCase()}
          {person.lastname[0].toUpperCase()}
        </div>

        {isEditing ? (
          <div className="flex gap-2 justify-center mb-1">
            <input
              value={editData.firstname}
              onChange={(e) =>
                setEditData({ ...editData, firstname: e.target.value })
              }
              className="w-24 text-center border border-primary/50 rounded px-1 py-0.5 text-sm font-bold text-transform: capitalize"
              placeholder="Prénom"
            />
            <input
              value={editData.lastname}
              onChange={(e) =>
                setEditData({ ...editData, lastname: e.target.value })
              }
              className="w-24 text-center border border-primary/50 rounded px-1 py-0.5 text-sm font-bold text-transform: capitalize"
              placeholder="Nom"
            />
          </div>
        ) : (
          <h2 className="text-xl font-bold text-gray-800 text-transform: capitalize">
            {person.firstname} {person.lastname}
          </h2>
        )}

        <p className="text-sm text-gray-500">Fiche personnelle</p>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="absolute top-4 right-4 text-gray-400 hover:text-primary transition-colors cursor-pointer"
            title="Modifier"
          >
            <FontAwesomeIcon icon={faPen} className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex border-t border-gray-200 border-b shrink-0">
        <button
          onClick={() => (isEditing ? "" : setActiveTab("infos"))}
          className={`flex-1 py-2 text-xs font-medium cursor-pointer ${activeTab === "infos"
            ? "bg-white text-primary border-b-2 border-primary"
            : "text-gray-500 hover:bg-gray-100"
            }`}
        >
          Informations
        </button>
        <button
          onClick={() => (isEditing ? "" : setActiveTab("teams"))}
          className={`flex-1 py-2 text-xs font-medium cursor-pointer ${activeTab === "teams"
            ? "bg-white text-primary border-b-2 border-primary"
            : "text-gray-500 hover:bg-gray-100"
            }`}
        >
          Équipes ({teams.length})
        </button>
      </div>

      {/* CONTENU */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : activeTab === "infos" ? (
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-400 uppercase mb-1">Email</p>
              {isEditing ? (
                <input
                  value={editData.email}
                  onChange={(e) =>
                    setEditData({ ...editData, email: e.target.value })
                  }
                  className="w-full text-sm bg-white border border-gray-300 rounded px-2 py-1"
                />
              ) : (
                <p className="text-sm text-gray-800 font-medium">
                  {person.email || "-"}
                </p>
              )}
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-400 uppercase mb-1">Téléphone</p>
              {isEditing ? (
                <input
                  value={editData.phone_number}
                  onChange={(e) =>
                    setEditData({ ...editData, phone_number: e.target.value })
                  }
                  className="w-full text-sm bg-white border border-gray-300 rounded px-2 py-1"
                />
              ) : (
                <p className="text-sm text-gray-800 font-medium">
                  {person.phone_number || "-"}
                </p>
              )}
            </div>
          </div>
        ) : (
          activeTab === "teams" && (
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => {
                    if (!isEditing) onTeamClick(team);
                  }}
                  className="flex justify-between items-center p-2 bg-white border border-gray-100 rounded-lg shadow-sm hover:border-primary/50 cursor-pointer group transition-all"
                >
                  <span className="text-sm font-medium text-gray-700 text-transform: capitalize">
                    {team.name}
                  </span>
                  <button
                    onClick={(e) => {
                      if (!isEditing) {
                        e.stopPropagation();
                        handleRemoveFromTeam(team.id);
                      }
                    }}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                  >
                    <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {!isEditing &&
                (isAddingTeam ? (
                  <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20 animate-in fade-in slide-in-from-top-2">
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <SearchableSelect
                          options={availableTeams.map(t => ({ value: t.id, label: t.name }))}
                          value={selectedTeamId}
                          onChange={setSelectedTeamId}
                          placeholder="Choisir une équipe..."
                          searchPlaceholder="Rechercher..."
                        />
                      </div>
                      <button
                        onClick={() => confirmAddTeam()}
                        disabled={!selectedTeamId}
                        className="bg-secondary text-white px-3 py-2 rounded-lg text-sm hover:bg-secondary/90 cursor-pointer h-[38px]"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setIsAddingTeam(false)}
                        className="text-gray-500 px-2 cursor-pointer hover:text-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={startAddingTeam}
                    className="w-full py-2 mt-4 border border-dashed border-gray-300 rounded-lg text-gray-500 text-xs hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>+</span> Rejoindre une équipe
                  </button>
                ))}
            </div>
          )
        )}
      </div>

      {/* FOOTER */}
      <div className="bg-gray-50 p-4 flex justify-between items-center border-t border-gray-100 mt-auto shrink-0">
        {isEditing ? (
          <div className="flex gap-2 w-full">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditData({ ...person });
              }}
              className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 cursor-pointer"
            >
              {isSaving ? "..." : "Enregistrer"}
            </button>
          </div>
        ) : showConfirm ? (
          <div className="flex gap-2 w-full animate-in fade-in slide-in-from-right-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 text-xs px-3 py-2 bg-gray-200 rounded text-gray-700"
            >
              Annuler
            </button>
            <button
              onClick={handleDeletePerson}
              className="flex-1 text-xs px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Confirmer
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowConfirm(true)}
              className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors cursor-pointer"
            >
              <FontAwesomeIcon icon={faTrash} className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 bg-white rounded text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Fermer
            </button>
          </>
        )}
      </div>
    </div >
  );
}
