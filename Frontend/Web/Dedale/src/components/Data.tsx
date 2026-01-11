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
    "w-full px-6 py-3 font-semibold rounded-xl transition duration-300 shadow-md transform hover:scale-[1.02]";
  const exportBtnClass = `${baseBtn} bg-green-500 text-white hover:bg-green-600 focus:ring-4 focus:ring-green-300`;
  const pdfBtnClass = `${baseBtn} bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300`;
  const connectBtnClass = qrCodeBase64
    ? `${baseBtn} bg-blue-500 text-white hover:bg-blue-600 focus:ring-4 focus:ring-blue-300`
    : `${baseBtn} bg-gray-700 text-white hover:bg-gray-800 focus:ring-4 focus:ring-gray-400`;

  const FeedbackMessage = ({
    type,
    text,
  }: {
    type: "success" | "error" | "info";
    text: string;
  }) => {
    const classes =
      type === "success"
        ? "bg-green-100 border-green-500 text-green-700"
        : type === "info"
        ? "bg-blue-100 border-blue-500 text-blue-700"
        : "bg-red-100 border-red-500 text-red-700";
    const title =
      type === "success"
        ? "Succès"
        : type === "info"
        ? "Information"
        : "Erreur";
    return (
      <div
        className={`p-4 border-l-4 ${classes} rounded-lg shadow-inner mt-4 w-full max-w-lg mx-auto`}
      >
        <p className="font-bold">{title}</p>
        <p className="text-sm break-all">{text}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl p-6 md:p-12">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">
            Dedale - Console de Gestion
          </h1>
          <p className="text-lg text-gray-500 mt-2">
            Gérez l'export des données et la connexion à l'application mobile.
          </p>
        </header>

        {message && <FeedbackMessage type={message.type} text={message.text} />}

        <div className="mt-8 grid lg:grid-cols-3 gap-8">
          {/* Gestion des Données (Export/PDF) */}
          <div className="lg:col-span-1 bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-lg h-full flex flex-col">
            <h2 className="text-2xl font-bold text-gray-700 mb-6 border-b pb-2">
              Gestion des Fichiers
            </h2>

            {/* --- SÉLECTEUR D'ÉVÉNEMENT --- */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrer par événement
              </label>
              <div className="relative">
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl border shadow-sm bg-white"
                >
                  <option value="">📂 Tous les événements</option>
                  <hr />
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      🔹 {evt.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">
                {selectedEventId
                  ? "L'export ne contiendra que les points de cet événement."
                  : "L'export contiendra la totalité de la base de données."}
              </p>
            </div>

            <div className="space-y-4 mt-auto">
              <button
                className={`${exportBtnClass} ${
                  !selectedEventId ? "opacity-90" : ""
                }`}
                onClick={generate_excel}
              >
                Exporter Excel {selectedEventId ? "(Filtré)" : "(Complet)"}
              </button>
              <button
                className={`${pdfBtnClass} ${
                  !selectedEventId ? "opacity-90" : ""
                }`}
                onClick={createPdf}
              >
                Générer PDF {selectedEventId ? "(Filtré)" : "(Complet)"}
              </button>
            </div>
          </div>

          {/* COLONNE 2 & 3: Connexion Mobile (QR Code) */}
          <div className="lg:col-span-2 bg-blue-50 p-6 rounded-2xl border-2 border-dashed border-blue-200 shadow-lg flex flex-col min-h-[300px]">
            <h2 className="text-2xl font-bold text-blue-700 mb-6 text-center">
              Connexion de l'Application Mobile
            </h2>

            {/* Phase initiale: bouton pour démarrer */}
            {transferPhase === "idle" && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-md">
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
                        Démarrage du serveur...
                      </span>
                    ) : (
                      "Transférer vers l'App Mobile"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Phase QR affiché: uniquement le QR code en attente de connexion */}
            {transferPhase === "qr_displayed" && qrCodeBase64 && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="flex flex-col items-center">
                  <p className="text-lg text-gray-700 mb-4 font-medium">
                    Scannez ce code depuis l'application mobile
                  </p>
                  <QrCode qrCodeUri={getQrCodeUri(qrCodeBase64)} />
                  <p className="text-sm text-gray-500 mt-4 animate-pulse">
                    En attente de connexion...
                  </p>
                </div>

                {/* Bouton Annuler */}
                <div className="mt-6">
                  <button
                    onClick={terminateTransfer}
                    className="px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Phase connecté: liste des events avec boutons Envoyer */}
            {transferPhase === "connected" && (
              <div className="flex-1 flex flex-col">
                {/* Header connexion */}
                <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-green-100 rounded-lg">
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-green-700 font-medium">
                    Mobile connecté
                  </span>
                </div>

                {/* Liste des événements à envoyer */}
                <div className="flex-1 bg-white rounded-xl p-4 border border-gray-200 overflow-y-auto max-h-64">
                  <h3 className="font-semibold text-gray-700 mb-3">
                    Événements à transférer ({selectedEventIds.size})
                  </h3>
                  <div className="space-y-2">
                    {events
                      .filter((e) => selectedEventIds.has(e.id))
                      .map((event) => (
                        <div
                          key={event.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            sentEventIds.has(event.id)
                              ? "bg-green-50 border-green-300"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="font-medium text-gray-800 truncate">
                              {event.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {event.description}
                            </div>
                          </div>
                          <button
                            onClick={() => sendEventToMobile(event.id)}
                            disabled={
                              sendingEventId === event.id ||
                              sentEventIds.has(event.id)
                            }
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                              sentEventIds.has(event.id)
                                ? "bg-green-500 text-white cursor-default"
                                : sendingEventId === event.id
                                ? "bg-blue-300 text-white cursor-wait"
                                : "bg-blue-500 hover:bg-blue-600 text-white"
                            }`}
                          >
                            {sentEventIds.has(event.id)
                              ? "✓ Envoyé"
                              : sendingEventId === event.id
                              ? "Envoi..."
                              : "Envoyer"}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Bouton Terminer */}
                <div className="mt-4">
                  <button
                    onClick={terminateTransfer}
                    className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors shadow-md"
                  >
                    Terminer le transfert
                  </button>
                </div>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center shadow-lg">
                <h3 className="font-bold mb-1">Erreur Critique</h3>
                <p className="text-sm">
                  Impossible de démarrer le serveur. Erreur:{" "}
                  <code className="text-xs break-all">{error}</code>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Data;
