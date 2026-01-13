import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
// import QRCodeDisplay from "./QrCode"; // Supprimé car on utilise l'image Base64 comme dans Events.tsx
import { TeamWithActions, Team, Action, Planning as Plan } from "../types/equipement";

// État pour gérer le processus de sync
type SyncStep = "idle" | "generating_qr" | "waiting_for_scan" | "sending" | "success" | "error";

export default function Planning({
  activeEventId,
}: {
  activeEventId: string | null;
}) {
  const [teams, setTeams] = useState<TeamWithActions[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  
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
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [isMobileConnected, setIsMobileConnected] = useState(false);

  // 1. Écouter la connexion mobile
  useEffect(() => {
    // Note: Assurez-vous que votre backend émet bien "mobile-connected" 
    // lorsque le téléphone scanne le QR code généré par start_share_server
    const unlistenConnect = listen("mobile-connected", () => {
      console.log("📱 Mobile connecté !");
      setIsMobileConnected(true);
      // On ne met pas forcément de message global ici pour ne pas spammer, 
      // l'état du modal changera automatiquement
    });

    const unlistenDisconnect = listen("mobile-disconnected", () => {
      console.log("👋 Mobile déconnecté !");
      setIsMobileConnected(false);
    });

    return () => {
      unlistenConnect.then((fn) => fn());
      unlistenDisconnect.then((fn) => fn());
    };
  }, []);

  // 2. Réagir automatiquement à la connexion pour envoyer le planning
  useEffect(() => {
    // Si on attendait un scan (le modal est ouvert) et que le mobile vient de se connecter
    if (syncState.step === "waiting_for_scan" && isMobileConnected && syncState.teamId) {
      console.log("🚀 Connexion détectée, lancement de l'envoi...");
      sendPlanningToTeam(syncState.teamId, syncState.teamName!);
    }
  }, [isMobileConnected, syncState.step, syncState.teamId]); 

  // Charger les données
  const loadTeamsWithActions = useCallback(async () => {
    if (!activeEventId) {
      setTeams([]);
      return;
    }
    setIsLoading(true);
    try {
      const fetchedTeams = await invoke<Team[]>("fetch_teams_for_event", {
        eventId: activeEventId,
      });

      const teamsWithActions: TeamWithActions[] = [];
      for (const team of fetchedTeams) {
        const actions = await invoke<Action[]>("fetch_actions_for_team", {
          teamId: team.id,
        });
        teamsWithActions.push({
          ...team,
          actions: actions.sort(
            (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
          ),
        });
      }
      setTeams(teamsWithActions);
    } catch (error) {
      console.error("Erreur chargement:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeEventId]);

  useEffect(() => {
    loadTeamsWithActions();
    const unlistenUpdate = listen("team-update", loadTeamsWithActions);
    return () => { unlistenUpdate.then(f => f()).catch(() => {}); };
  }, [activeEventId, loadTeamsWithActions]);


  // 3. Démarrer la sync : Générer le QR Code serveur (comme dans Events.tsx)
  const startSyncProcess = useCallback(async (teamId: string, teamName: string) => {
    // Reset state
    setSyncState({
      step: "generating_qr",
      teamId,
      teamName,
      qrCodeBase64: null,
      errorMessage: null
    });

    try {
      console.log("📱 Démarrage serveur de partage pour l'équipe:", teamName);
      
      // Appel à start_server_planning pour générer le QR code et préparer l'envoi du planning
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
    }
  }, []);

  // 4. Fonction d'envoi réelle
  const sendPlanningToTeam = async (teamId: string, teamName: string) => {
    setSyncState(prev => ({ ...prev, step: "sending" }));
    
    try {
      // Simulation d'un petit délai pour voir l'état "sending" si c'est trop rapide
      // await new Promise(r => setTimeout(r, 500)); 

      console.log("📤 Appel send_planning avec teamId:", teamId);
      const planning = await invoke<Plan>("send_planning", { teamId });
      
      console.log("📊 Planning reçu du backend:", {
        totalActions: planning.actions?.length || 0,
        totalEquipements: planning.equipements?.length || 0,
        totalCoordonnees: planning.coordonees?.length || 0,
      });
      console.log("   - Actions:", planning.actions);
      console.log("   - Équipements:", planning.equipements);
      console.log("   - Coordonnées:", planning.coordonees);
      
      setSyncState(prev => ({ ...prev, step: "success" }));
      setMessage({
        type: "success",
        text: `Planning envoyé à ${teamName} (${planning.actions?.length || 0} actions)`,
      });

      // Fermer le modal après 2 secondes si succès
      setTimeout(() => {
        closeSyncModal();
      }, 2000);

    } catch (error) {
      console.error("Erreur envoi:", error);
      setSyncState(prev => ({ 
        ...prev, 
        step: "error", 
        errorMessage: `Erreur envoi: ${String(error)}` 
      }));
    }
  };

  const closeSyncModal = () => {
    // Optionnel : Arrêter le serveur si nécessaire via invoke("stop_server")
    setSyncState({ step: "idle", teamId: null, teamName: null, qrCodeBase64: null, errorMessage: null });
  };

  const generateTeamPDF = useCallback(async (teamId: string, teamName: string) => {
      setGeneratingPdfForTeam(teamId);
      try {
        await invoke("create_team_mission_pdf", { teamId, eventId: activeEventId });
        setMessage({ type: "success", text: `PDF généré pour ${teamName}` });
      } catch (e) { setMessage({ type: "error", text: "Erreur PDF" }); } 
      finally { setGeneratingPdfForTeam(null); }
  }, [activeEventId]);

  const toggleActionStatus = async (actionId: string) => {
      await invoke("update_action_status", { actionId });
      loadTeamsWithActions();
  };

  const toggleTeamSelection = (teamId: string) => {
    const newSelected = new Set(selectedTeams);
    if (newSelected.has(teamId)) {
      newSelected.delete(teamId);
    } else {
      newSelected.add(teamId);
    }
    setSelectedTeams(newSelected);
  };

  const sendToSelectedTeams = async () => {
    if (selectedTeams.size === 0) {
      setMessage({ type: "error", text: "Veuillez sélectionner au moins une équipe" });
      return;
    }

    // Envoyer à la première équipe sélectionnée pour commencer
    const firstTeamId = Array.from(selectedTeams)[0];
    const team = teams.find(t => t.id === firstTeamId);
    
    if (team) {
      await startSyncProcess(team.id, team.name);
    }
  };

  const formatDateTime = (s: string) => new Date(s).toLocaleString();

  // RENDER
  if (!activeEventId) return <div className="p-8 text-center text-gray-500">Sélectionnez un événement</div>;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Planning</h1>

        {message && (
          <div className={`p-4 rounded-lg mb-6 border-l-4 ${
            message.type === "success" ? "bg-green-50 border-green-500 text-green-700" : 
            message.type === "error" ? "bg-red-50 border-red-500 text-red-700" : 
            "bg-blue-50 border-blue-500 text-blue-700"
          }`}>
            {message.text}
          </div>
        )}

        {/* GROS BOUTON ENVOYER (au départ) */}
        {!showTeamSelection && syncState.step === "idle" && (
          <div className="flex justify-center mb-8">
            <button
              onClick={() => setShowTeamSelection(true)}
              className="px-8 py-4 text-white font-bold text-lg rounded-lg bg-blue-600 hover:bg-blue-700 shadow-lg transition-colors"
            >
              📲 Envoyer les plannings
            </button>
          </div>
        )}

        {/* MODAL DE SÉLECTION DES ÉQUIPES */}
        {showTeamSelection && syncState.step === "idle" && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Sélectionner les équipes</h2>
                <button
                  onClick={() => {
                    setShowTeamSelection(false);
                    setSelectedTeams(new Set());
                  }}
                  className="text-gray-400 hover:text-gray-600 font-bold text-2xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-80 overflow-y-auto">
                {teams.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Aucune équipe trouvée</p>
                ) : (
                  teams.map((team) => (
                    <label key={team.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-3 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedTeams.has(team.id)}
                        onChange={() => toggleTeamSelection(team.id)}
                        className="w-5 h-5 rounded cursor-pointer text-blue-600"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{team.name}</p>
                        <p className="text-sm text-gray-500">{team.actions.length} action(s)</p>
                      </div>
                    </label>
                  ))
                )}
              </div>

              {/* BOUTON D'ENVOI */}
              <div className="flex justify-center mt-6">
                <button
                  onClick={sendToSelectedTeams}
                  disabled={selectedTeams.size === 0}
                  className={`px-8 py-4 text-white font-bold text-lg rounded-lg transition-colors ${
                    selectedTeams.size === 0
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 shadow-lg"
                  }`}
                >
                  ✓ Envoyer ({selectedTeams.size} équipe{selectedTeams.size > 1 ? "s" : ""})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL QR CODE */}
        {syncState.step !== "idle" && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-center flex-1">
                  📱 Envoyer le planning
                </h3>
                {syncState.step !== "sending" && (
                   <button onClick={closeSyncModal} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
                )}
              </div>
              
              <div className="flex flex-col items-center justify-center text-center">
                
                {/* Étape 0 : Génération */}
                {syncState.step === "generating_qr" && (
                   <div className="py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4 mx-auto"></div>
                      <p>Génération du QR Code...</p>
                   </div>
                )}

                {/* Étape 1 : Scan QR (Affichage image Base64) */}
                {syncState.step === "waiting_for_scan" && syncState.qrCodeBase64 && (
                  <>
                    <p className="text-gray-600 text-center mb-4">
                      Scannez ce QR code avec l'application mobile pour transférer le planning de <strong>{syncState.teamName}</strong>.
                    </p>
                    
                    <div className="flex justify-center mb-4 border p-2 rounded bg-white">
                      <img
                        src={`data:image/png;base64,${syncState.qrCodeBase64}`}
                        alt="QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                    
                    <div className="text-center mb-4 animate-pulse">
                      <p className="text-sm text-blue-600 font-medium">En attente de connexion du mobile...</p>
                    </div>
                  </>
                )}

                {/* Étape 2 : Envoi en cours */}
                {syncState.step === "sending" && (
                  <div className="py-8">
                    <svg className="animate-spin h-16 w-16 text-blue-600 mb-4 mx-auto" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="font-bold text-blue-600 text-lg">Envoi en cours...</p>
                    <p className="text-sm text-gray-500 mt-2">Ne fermez pas l'application mobile.</p>
                  </div>
                )}

                {/* Étape 3 : Succès */}
                {syncState.step === "success" && (
                  <div className="py-8">
                    <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
                    <p className="font-bold text-green-600 text-lg">Envoyé avec succès !</p>
                  </div>
                )}

                 {/* Étape 4 : Erreur */}
                 {syncState.step === "error" && (
                  <div className="py-4">
                    <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">!</div>
                    <p className="text-red-600 font-bold mb-2">Une erreur est survenue</p>
                    <p className="text-sm text-gray-600 mb-6">{syncState.errorMessage}</p>
                    <button 
                      onClick={() => startSyncProcess(syncState.teamId!, syncState.teamName!)} 
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Réessayer
                    </button>
                  </div>
                )}

                {(syncState.step === "waiting_for_scan" || syncState.step === "success") && (
                   <button
                   onClick={closeSyncModal}
                   className="mt-4 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                 >
                   Fermer
                 </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DÉTAIL DES ÉQUIPES */}
        <div className="space-y-6">
          {teams.map((team) => (
            <div key={team.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">{team.name}</h2>
                <p className="text-sm text-gray-500">{team.actions.length} action(s)</p>
              </div>

              {/* Contenu des actions */}
              <div className="divide-y divide-gray-200">
                {team.actions.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">Aucune action</div>
                ) : (
                    team.actions.map(action => (
                        <div key={action.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <input type="checkbox" checked={action.is_done} onChange={() => toggleActionStatus(action.id)} className="w-5 h-5 rounded cursor-pointer text-blue-600"/>
                                <div>
                                    <p className={`font-medium ${action.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{action.type}</p>
                                    <p className="text-sm text-gray-500">{formatDateTime(action.scheduled_time)}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}