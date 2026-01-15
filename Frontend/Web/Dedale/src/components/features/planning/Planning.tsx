import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TeamWithActions, Planning as Plan } from "../../../types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilePdf,
  faMobileAlt,
  faClipboardList,
  faCheck,
  faTimes,
  faSpinner,
  faTasks,
  faClock
} from "@fortawesome/free-solid-svg-icons";
import toast from 'react-hot-toast';

// État pour gérer le processus de sync
type SyncStep = "idle" | "generating_qr" | "waiting_for_scan" | "sending" | "success" | "error";

export default function Planning({
  activeEventId,
}: {
  activeEventId: string | null;
}) {
  const [teams, setTeams] = useState<TeamWithActions[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // État unifié pour la synchronisation
  const [syncState, setSyncState] = useState<{
    step: SyncStep;
    teamId: string | null;
    teamName: string | null;
    qrCodeBase64: string | null;
    errorMessage: string | null;
  }>({
    step: "idle",
    teamId: null,
    teamName: null,
    qrCodeBase64: null,
    errorMessage: null
  });

  const [generatingPdfForTeam, setGeneratingPdfForTeam] = useState<string | null>(null);

  // 4. Fonction d'envoi réelle
  const sendPlanningToTeam = useCallback(async (teamId: string, teamName: string) => {
    setSyncState(prev => ({ ...prev, step: "sending" }));

    try {
      console.log("📤 Appel send_planning avec teamId:", teamId);
      const planning = await invoke<Plan>("send_planning", { teamId });

      if (!planning.actions || planning.actions.length === 0) {
        setSyncState(prev => ({
          ...prev,
          step: "error",
          errorMessage: `Aucune action trouvée pour l'équipe ${teamName}.`
        }));
        toast.error(`Aucune action à envoyer pour ${teamName}.`);
        return;
      }

      setSyncState(prev => ({ ...prev, step: "success" }));
      toast.success(`Planning envoyé à ${teamName} (${planning.actions.length} actions)`);

      setTimeout(() => {
        closeSyncModal();
      }, 1500);

    } catch (error) {
      console.error("Erreur envoi:", error);
      setSyncState(prev => ({
        ...prev,
        step: "error",
        errorMessage: `Erreur envoi: ${String(error)}`
      }));
      toast.error(`Erreur lors de l'envoi : ${error}`);
    }
  }, []);

  // Note: Les listeners pour 'mobile-connected' et 'mobile-disconnected' sont gérés de manière centralisée
  // dans Data.tsx pour éviter les doublons et les toasts multiples
  // Planning écoute les événements custom émis par Data.tsx
  useEffect(() => {
    const handleMobileConnected = () => {
      // Déclencher l'envoi si on est en attente
      if (syncState.step === "waiting_for_scan" && syncState.teamId) {
        console.log("🚀 Connexion détectée, lancement de l'envoi...");
        sendPlanningToTeam(syncState.teamId, syncState.teamName!);
      }
    };

    window.addEventListener("app-mobile-connected", handleMobileConnected);

    return () => {
      window.removeEventListener("app-mobile-connected", handleMobileConnected);
    };
  }, [syncState.step, syncState.teamId, syncState.teamName, sendPlanningToTeam]);

  // Charger les données - Appel unique optimisé
  const loadTeamsWithActions = useCallback(async () => {
    if (!activeEventId) {
      setTeams([]);
      return;
    }
    setIsLoading(true);
    try {
      // Un seul appel au backend pour tout récupérer
      const teamsWithActions = await invoke<TeamWithActions[]>("fetch_teams_with_actions_for_event", {
        eventId: activeEventId,
      });

      setTeams(teamsWithActions);
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error("Erreur lors du chargement des plannings.");
    } finally {
      setIsLoading(false);
    }
  }, [activeEventId]);

  useEffect(() => {
    loadTeamsWithActions();
    const interval = setInterval(loadTeamsWithActions, 30000); // Auto-refresh 30s
    return () => clearInterval(interval);
  }, [activeEventId, loadTeamsWithActions]);


  // 3. Démarrer la sync : Générer le QR Code serveur
  const startSyncProcess = useCallback(async (teamId: string, teamName: string) => {
    setSyncState({
      step: "generating_qr",
      teamId,
      teamName,
      qrCodeBase64: null,
      errorMessage: null
    });

    try {
      console.log("📱 Démarrage serveur de partage pour l'équipe:", teamName);
      const qrCodeBase64 = await invoke<string>("start_server_planning", {
        teamId,
      });

      setSyncState(prev => ({
        ...prev,
        step: "waiting_for_scan",
        qrCodeBase64
      }));

    } catch (err) {
      console.error("❌ Erreur démarrage serveur partage:", err);
      setSyncState(prev => ({
        ...prev,
        step: "error",
        errorMessage: `Erreur génération QR: ${err}`
      }));
      toast.error(`Erreur: ${err}`);
    }
  }, []);

  const closeSyncModal = () => {
    setSyncState({ step: "idle", teamId: null, teamName: null, qrCodeBase64: null, errorMessage: null });
  };

  const generateTeamPDF = useCallback(async (teamId: string, teamName: string) => {
    setGeneratingPdfForTeam(teamId);
    try {
      await invoke("create_team_mission_pdf", { teamId, eventId: activeEventId });
      toast.success(`PDF généré avec succès pour ${teamName}`);
    } catch (_e) {
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setGeneratingPdfForTeam(null);
    }
  }, [activeEventId]);

  const toggleActionStatus = async (actionId: string) => {
    try {
      await invoke("update_action_status", { actionId });
      loadTeamsWithActions();
    } catch (_e) {
      toast.error("Erreur lors de la mise à jour du statut");
    }
  };

  const formatDateTime = (s: string) => {
    return new Date(s).toLocaleString('fr-FR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  // RENDER
  if (!activeEventId) return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <FontAwesomeIcon icon={faClipboardList} className="text-4xl mb-3 opacity-20" />
      <p>Sélectionnez un événement pour voir le planning</p>
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-lg shadow-indigo-500/30">
              <FontAwesomeIcon icon={faTasks} />
            </span>
            Planning
          </h2>
          <p className="text-gray-500 mt-1 ml-1">Gérez et synchronisez les actions des équipes.</p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && teams.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center gap-3">
            <FontAwesomeIcon icon={faSpinner} spin className="text-primary h-8 w-8" />
            <span className="text-gray-500 font-medium">Chargement des plannings...</span>
          </div>
        </div>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50/50 rounded-3xl border border-dashed border-gray-300">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <FontAwesomeIcon icon={faClipboardList} className="text-4xl text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-600 mb-2">Aucune équipe</h3>
          <p className="text-gray-500">
            Il n'y a pas encore d'équipe configurée pour cet événement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20 overflow-y-auto custom-scrollbar pr-2">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
            >
              {/* Team Header */}
              <div className="px-6 py-5 bg-linear-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 text-transform: capitalize">
                    {team.name}
                    <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full border border-primary/20">
                      {team.actions.length}
                    </span>
                  </h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => generateTeamPDF(team.id, team.name)}
                    disabled={generatingPdfForTeam === team.id}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm"
                    title="Générer PDF"
                  >
                    {generatingPdfForTeam === team.id ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                      <FontAwesomeIcon icon={faFilePdf} />
                    )}
                  </button>
                  <button
                    onClick={() => startSyncProcess(team.id, team.name)}
                    disabled={syncState.step !== "idle" && syncState.teamId === team.id}
                    className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2"
                  >
                    <FontAwesomeIcon icon={faMobileAlt} />
                    <span className="hidden sm:inline">Envoyer</span>
                  </button>
                </div>
              </div>

              {/* Actions List */}
              <div className="flex-1 p-0 overflow-y-auto max-h-[300px] custom-scrollbar">
                {team.actions.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-400 opacity-60">
                    <FontAwesomeIcon icon={faClipboardList} className="text-3xl mb-2" />
                    <p className="text-sm">Aucune action planifiée</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 sticky top-0">
                      <tr>
                        <th className="px-6 py-2 font-medium w-12">État</th>
                        <th className="px-4 py-2 font-medium">Action</th>
                        <th className="px-4 py-2 font-medium text-right">Horaire</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {team.actions.map(action => (
                        <tr key={action.id} className="hover:bg-blue-50/30 transition-colors group">
                          <td className="px-6 py-3">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleActionStatus(action.id);
                              }}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <div className={`relative w-11 h-6 transition-colors duration-200 ease-in-out rounded-full ${action.is_done ? 'bg-green-500' : 'bg-gray-200 group-hover:bg-gray-300'}`}>
                                <div className={`absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-200 ${action.is_done ? 'translate-x-[20px]' : 'translate-x-0'}`}></div>
                              </div>
                              <span className={`text-sm font-medium transition-colors ${action.is_done ? 'text-green-700' : 'text-gray-500 group-hover:text-gray-700'}`}>
                                {action.is_done ? "Terminé" : "En attente"}
                              </span>
                            </div>
                          </td>
                          <td className={`px-4 py-3 ${action.is_done ? 'opacity-50 line-through decoration-gray-400' : ''}`}>
                            <p className="font-semibold text-gray-800 text-transform: capitalize">{action.action_type}</p>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${action.is_done ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-700'}`}>
                              <FontAwesomeIcon icon={faClock} className="text-[10px]" />
                              {formatDateTime(action.scheduled_time)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL QR CODE - Premium Style */}
      {syncState.step !== "idle" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-1/3 bg-linear-to-b from-blue-50 to-transparent -z-10"></div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border border-blue-50 flex items-center justify-center mx-auto mb-4 text-blue-600 text-2xl">
                {syncState.step === "success" ? <FontAwesomeIcon icon={faCheck} className="text-green-500" /> :
                  syncState.step === "error" ? <FontAwesomeIcon icon={faTimes} className="text-red-500" /> :
                    <FontAwesomeIcon icon={faMobileAlt} />}
              </div>
              <h3 className="text-xl font-extrabold text-gray-800">
                {syncState.step === "success" ? "Envoyé !" :
                  syncState.step === "error" ? "Erreur" :
                    "Synchronisation"}
              </h3>
              <p className="text-sm text-gray-500 mt-1 font-medium">Équipe {syncState.teamName}</p>
            </div>

            <div className="flex flex-col items-center justify-center text-center">

              {/* Étape 0 : Génération */}
              {syncState.step === "generating_qr" && (
                <div className="py-8">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500 mb-4" />
                  <p className="text-gray-600 font-medium">Génération du QR Code...</p>
                </div>
              )}

              {/* Étape 1 : Scan QR */}
              {syncState.step === "waiting_for_scan" && syncState.qrCodeBase64 && (
                <div className="w-full">
                  <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 mb-6 mx-auto w-fit">
                    <img
                      src={`data:image/png;base64,${syncState.qrCodeBase64}`}
                      alt="QR Code"
                      className="w-48 h-48 mix-blend-multiply"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mb-4 px-4">
                    Scannez avec l'app mobile Dedale pour récupérer le planning.
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 py-2 px-4 rounded-full animate-pulse">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    En attente de connexion...
                  </div>
                </div>
              )}

              {/* Étape 2 : Envoi */}
              {syncState.step === "sending" && (
                <div className="py-8">
                  <div className="mb-4">
                    <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden mx-auto">
                      <div className="h-full bg-blue-500 w-1/2 animate-[loading_1s_ease-in-out_infinite]"></div>
                    </div>
                  </div>
                  <p className="font-bold text-gray-800 text-lg">Transfert en cours...</p>
                  <p className="text-sm text-gray-500 mt-2">Ne fermez pas l'application.</p>
                </div>
              )}

              {/* Étape 3 : Succès */}
              {syncState.step === "success" && (
                <div className="py-4">
                  <p className="text-gray-600 mb-6">Le planning a été transféré avec succès à l'appareil mobile.</p>
                  <button
                    onClick={closeSyncModal}
                    className="w-full px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-bold transition-all shadow-lg shadow-gray-900/10"
                  >
                    Terminer
                  </button>
                </div>
              )}

              {/* Étape 4 : Erreur */}
              {syncState.step === "error" && (
                <div className="py-4 w-full">
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 mb-6">
                    {syncState.errorMessage}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={closeSyncModal}
                      className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-bold"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => startSyncProcess(syncState.teamId!, syncState.teamName!)}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-lg shadow-blue-600/20"
                    >
                      Réessayer
                    </button>
                  </div>
                </div>
              )}

              {(syncState.step === "waiting_for_scan") && (
                <button
                  onClick={closeSyncModal}
                  className="mt-6 text-gray-400 hover:text-gray-600 font-medium text-sm transition-colors"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}