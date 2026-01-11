import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import * as path from "@tauri-apps/api/path";

type Action = {
  id: string;
  team_id: string;
  equipement_id: string;
  type: string;
  scheduled_time: string;
  is_done: boolean;
};

type Team = {
  id: string;
  name: string;
  event_id: string;
};

type TeamWithActions = Team & {
  actions: Action[];
};

export default function Planning({
  activeEventId,
}: {
  activeEventId: string | null;
}) {
  const [teams, setTeams] = useState<TeamWithActions[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Fonction pour charger les équipes et actions
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
            (a, b) =>
              new Date(a.scheduled_time).getTime() -
              new Date(b.scheduled_time).getTime()
          ),
        });
      }

      setTeams(teamsWithActions);
    } catch (error) {
      console.error("Erreur chargement équipes:", error);
      setMessage({
        type: "error",
        text: "Erreur lors du chargement des équipes",
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeEventId]);

  // Charger les équipes et actions
  useEffect(() => {
    loadTeamsWithActions();

    // Écouter les événements de création/suppression de team et mise à jour
    const unlistenTeamCreated = listen("team-created", () => {
      loadTeamsWithActions();
    });

    const unlistenTeamDeleted = listen("team-deleted", () => {
      loadTeamsWithActions();
    });

    const unlistenTeamUpdate = listen("team-update", () => {
      loadTeamsWithActions();
    });

    return () => {
      unlistenTeamCreated.then(f => f()).catch(() => {});
      unlistenTeamDeleted.then(f => f()).catch(() => {});
      unlistenTeamUpdate.then(f => f()).catch(() => {});
    };
  }, [activeEventId, loadTeamsWithActions]);

  // Exporter en Excel
  const exportToExcel = useCallback(async () => {
    setMessage(null);
    try {
      const appDataPath = await path.appDataDir();
      if (!appDataPath) throw new Error("Impossible de récupérer AppData");

      const db_url = await path.join(appDataPath, "mydatabase.db");
      const filename = `planning_${activeEventId || "all"}.xlsx`;
      const excel_path_str = await path.join(appDataPath, filename);

      await invoke("export_planning_excel", {
        dbUrl: db_url,
        excelPathStr: excel_path_str,
        eventId: activeEventId || null,
      });

      setMessage({
        type: "success",
        text: `Planning exporté avec succès : ${filename}`,
      });
    } catch (error) {
      console.error("Erreur export Excel:", error);
      setMessage({
        type: "error",
        text: `Erreur export: ${String(error)}`,
      });
    }
  }, [activeEventId]);

  // Générer PDF
  const generatePDF = useCallback(async () => {
    setMessage(null);
    try {
      await invoke("create_planning_pdf", {
        eventId: activeEventId || null,
      });

      setMessage({
        type: "success",
        text: "PDF de planning généré avec succès",
      });
    } catch (error) {
      console.error("Erreur PDF:", error);
      setMessage({
        type: "error",
        text: `Erreur PDF: ${String(error)}`,
      });
    }
  }, [activeEventId]);

  // Basculer le statut d'une action
  const toggleActionStatus = useCallback(
    async (actionId: string) => {
      try {
        await invoke("update_action_status", { actionId });
        // Rafraîchir les données
        loadTeamsWithActions();
      } catch (error) {
        console.error("Erreur mise à jour action:", error);
        setMessage({
          type: "error",
          text: "Erreur lors de la mise à jour",
        });
      }
    },
    [activeEventId]
  );

  const formatDateTime = (dateTimeString: string) => {
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateTimeString;
    }
  };

  if (!activeEventId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Sélectionnez un événement pour voir le planning</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Planning</h1>
          <p className="text-gray-600 mt-2">
            Gérez les actions planifiées par équipes
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`p-4 rounded-lg mb-6 border-l-4 ${
              message.type === "success"
                ? "bg-green-50 border-green-300 text-green-700"
                : message.type === "info"
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-red-50 border-red-300 text-red-700"
            }`}
          >
            <p className="font-medium text-sm">{message.text}</p>
          </div>
        )}

        {/* Actions Export */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={exportToExcel}
            disabled={isLoading}
            className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Exporter en Excel
          </button>
          <button
            onClick={generatePDF}
            disabled={isLoading}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Générer PDF
          </button>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Chargement...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucune équipe disponible</p>
          </div>
        ) : (
          <div className="space-y-6">
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Team Header */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900">
                    {team.name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {team.actions.length} action(s)
                  </p>
                </div>

                {/* Actions List */}
                {team.actions.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    Aucune action planifiée
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {team.actions.map((action) => (
                      <div
                        key={action.id}
                        className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                          action.is_done ? "bg-green-50" : ""
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={action.is_done}
                              onChange={() => toggleActionStatus(action.id)}
                              className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                            />
                            <div>
                              <p
                                className={`font-medium ${
                                  action.is_done
                                    ? "text-gray-500 line-through"
                                    : "text-gray-900"
                                }`}
                              >
                                {action.type || "Action sans type"}
                              </p>
                              <p className="text-sm text-gray-500">
                                Équipement: {action.equipement_id}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              {formatDateTime(action.scheduled_time)}
                            </p>
                            <p
                              className={`text-sm font-medium ${
                                action.is_done
                                  ? "text-green-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {action.is_done ? "✓ Complétée" : "En attente"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
