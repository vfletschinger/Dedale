import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import * as path from "@tauri-apps/api/path";
import QrCode from "./QrCode";

type Event = {
  id: string;
  name: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
};

type TransferPhase = "idle" | "qr_displayed" | "connected";

function Data() {
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // États pour la sélection d'événements pour le transfert
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(
    new Set()
  );

  // Etat pour la sélection d'événement pour l'export/PDF
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // États pour le transfert
  const [transferPhase, setTransferPhase] = useState<TransferPhase>("idle");
  const [sentEventIds, setSentEventIds] = useState<Set<string>>(new Set());
  const [sendingEventId, setSendingEventId] = useState<string | null>(null);

  // Écouter l'événement de connexion mobile
  useEffect(() => {
    const unlistenConnect = listen("mobile-connected", () => {
      console.log("📱 Mobile connecté !");
      setTransferPhase("connected");
      setMessage({ type: "success", text: "Mobile connecté !" });
    });

    const unlistenDisconnect = listen("mobile-disconnected", () => {
      console.log("👋 Mobile déconnecté !");
      setTransferPhase("idle");
      setMessage({ type: "info", text: "Mobile déconnecté" });
    });

    return () => {
      unlistenConnect.then((fn) => fn());
      unlistenDisconnect.then((fn) => fn());
    };
  }, []);

  // --- CHARGEMENT DES ÉVÉNEMENTS ---
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const evts = await invoke<Event[]>("fetch_events");
        setEvents(evts);
      } catch (e) {
        console.error("Erreur chargement événements:", e);
      }
    };
    loadEvents();
  }, []);

  // Fonction pour l'export Excel
  const generate_excel = useCallback(async () => {
    setMessage(null);
    try {
      const appDataPath = await path.appDataDir();
      if (!appDataPath) throw new Error("Impossible de récupérer AppData");

      const db_url = await path.join(appDataPath, "mydatabase.db");
      const filename = selectedEventId
        ? `points_event_${selectedEventId}.xlsx`
        : "points_all.xlsx";

      const excel_path_str = await path.join(appDataPath, filename);

      const eventIdParam = selectedEventId ? selectedEventId : null;

      await invoke("export_points_excel", {
        dbUrl: db_url,
        excelPathStr: excel_path_str,
        eventId: eventIdParam,
      });

      setMessage({
        type: "success",
        text: `Export réussi : ${filename}`,
      });
    } catch (error) {
      console.error("Erreur export Excel:", error);
      setMessage({ type: "error", text: `Erreur: ${String(error)}` });
    }
  }, [selectedEventId]);

  // Fonction pour la création de PDF
  const createPdf = useCallback(async () => {
    setMessage(null);
    try {
      const eventIdParam = selectedEventId ? selectedEventId : null;

      await invoke("create_pdf", { eventId: eventIdParam });

      setMessage({
        type: "success",
        text: "PDF généré avec succès. Vérifiez le dossier temporaire.",
      });
    } catch (error) {
      console.error("Erreur PDF:", error);
      setMessage({ type: "error", text: `Erreur PDF: ${String(error)}` });
    }
  }, [selectedEventId]);

  // Fonction QR Code (Inchangée)
  const qr_code = useCallback(async () => {
    // Charger les events et démarrer directement
    setIsLoading(true);
    setError(null);
    setQrCodeBase64(null);
    setMessage(null);
    try {
      // Charger tous les événements
      const eventsData = await invoke<Event[]>("fetch_events");
      setEvents(eventsData);
      const allEventIds = eventsData.map((e) => e.id);
      setSelectedEventIds(new Set(allEventIds));

      // Démarrer le serveur avec tous les événements
      console.log("📤 Transfert des événements:", allEventIds);

      const base64String = await invoke<string>("start_server", {
        eventIds: allEventIds,
      });

      setQrCodeBase64(base64String);
      setTransferPhase("qr_displayed");
      setSentEventIds(new Set());
      setMessage({
        type: "success",
        text: `Serveur démarré avec ${allEventIds.length} événement(s).`,
      });
    } catch (err) {
      console.error("Erreur:", err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Envoyer un événement spécifique au mobile
  const sendEventToMobile = useCallback(async (eventId: string) => {
    setSendingEventId(eventId);
    try {
      await invoke("send_event_to_mobile", { eventId });
      setSentEventIds((prev) => new Set([...prev, eventId]));
      setMessage({
        type: "success",
        text: `Événement ${eventId} envoyé au mobile !`,
      });
    } catch (err) {
      console.error("Erreur envoi événement:", err);
      setMessage({ type: "error", text: `Erreur: ${String(err)}` });
    } finally {
      setSendingEventId(null);
    }
  }, []);

  const terminateTransfer = useCallback(async () => {
    try {
      // Envoyer le message de fermeture au mobile
      await invoke("terminate_server");
      console.log("✅ Serveur fermé, message envoyé au mobile");
    } catch (err) {
      console.error("Erreur fermeture serveur:", err);
      // Continuer même en cas d'erreur
    }

    setQrCodeBase64(null);
    setTransferPhase("idle");
    setSentEventIds(new Set());
    setMessage({ type: "success", text: "Transfert terminé." });
  }, []);

  const getQrCodeUri = (base64: string | null): string => {
    if (!base64) return "";
    return `data:image/png;base64,${base64}`;
  };

  const baseBtn =
    "w-full px-6 py-3 font-semibold rounded-lg transition-all hover:shadow-md";
  const exportBtnClass = `${baseBtn} bg-green-600 text-white hover:bg-green-700`;
  const pdfBtnClass = `${baseBtn} bg-blue-600 text-white hover:bg-blue-700`;
  const connectBtnClass = `${baseBtn} bg-blue-600 text-white hover:bg-blue-700 hover:scale-105`;

  const FeedbackMessage = ({
    type,
    text,
  }: {
    type: "success" | "error" | "info";
    text: string;
  }) => {
    const classes =
      type === "success"
        ? "bg-green-50 border-green-300 text-green-700"
        : type === "info"
        ? "bg-blue-50 border-blue-300 text-blue-700"
        : "bg-red-50 border-red-300 text-red-700";
    const title =
      type === "success"
        ? "Succès"
        : type === "info"
        ? "Information"
        : "Erreur";
    return (
      <div
        className={`p-4 border-l-4 ${classes} rounded-xl mb-8 w-full shadow-sm`}
      >
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-sm break-all">{text}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900">
            Gestion des Données
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            Connectez l'application mobile
          </p>
          <div className="h-1 w-16 bg-blue-600 rounded-full mt-4"></div>
        </header>

        {message && <FeedbackMessage type={message.type} text={message.text} />}

        {/* Section: Connexion Mobile */}
        <div className="bg-white border border-gray-200 rounded-xl p-10 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Synchronisation Mobile
          </h2>

          {/* Phase initiale: bouton pour démarrer */}
          {transferPhase === "idle" && (
            <div className="flex flex-col items-center justify-center py-12">
              <button
                className={connectBtnClass}
                onClick={qr_code}
                disabled={isLoading}
                aria-label="Démarrer le serveur et connecter l'application"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Démarrage...
                    </span>
                  ) : (
                    "Afficher le QR Code"
                  )}
                </button>
              </div>
            )}

            {/* Phase QR affiché */}
            {transferPhase === "qr_displayed" && qrCodeBase64 && (
              <div className="flex flex-col items-center justify-center min-h-64">
                <p className="text-sm font-medium text-gray-900 mb-6">
                  Scannez ce code depuis l'application mobile
                </p>
                <QrCode qrCodeUri={getQrCodeUri(qrCodeBase64)} />
                <p className="text-sm text-gray-500 mt-6 animate-pulse">
                  En attente de connexion...
                </p>
                <button
                  onClick={terminateTransfer}
                  className="mt-6 px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium rounded-lg transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}

            {/* Phase connecté */}
            {transferPhase === "connected" && (
              <div className="flex flex-col min-h-64">
                {/* Indicateur de connexion */}
                <div className="flex items-center gap-2 mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-green-700 font-medium text-sm">
                    Mobile connecté
                  </span>
                </div>

                {/* Liste des événements */}
                <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-y-auto max-h-64 mb-4">
                  <h3 className="font-medium text-gray-900 mb-4">
                    Événements à transférer ({selectedEventIds.size})
                  </h3>
                  <div className="space-y-2">
                    {events
                      .filter((e) => selectedEventIds.has(e.id))
                      .map((event) => (
                        <div
                          key={event.id}
                          className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
                            sentEventIds.has(event.id)
                              ? "bg-green-50 border-green-300"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="font-medium text-gray-900">
                              {event.name}
                            </div>
                          </div>
                          <button
                            onClick={() => sendEventToMobile(event.id)}
                            disabled={
                              sendingEventId === event.id ||
                              sentEventIds.has(event.id)
                            }
                            className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                              sentEventIds.has(event.id)
                                ? "bg-green-600 text-white cursor-default"
                                : sendingEventId === event.id
                                ? "bg-blue-400 text-white cursor-wait"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                            }`}
                          >
                            {sentEventIds.has(event.id)
                              ? "Envoyé"
                              : sendingEventId === event.id
                              ? "..."
                              : "Envoyer"}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Bouton Terminer */}
                <button
                  onClick={terminateTransfer}
                  className="w-full px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
                >
                  Terminer le transfert
                </button>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                <p className="font-medium mb-1">Erreur</p>
                <p className="text-xs break-all">{error}</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default Data;
