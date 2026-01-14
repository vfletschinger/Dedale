import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import * as path from "@tauri-apps/api/path";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWifi,
  faFileExcel,
  faFilePdf,
  faDatabase,
  faMobileAlt,
  faCloudUploadAlt,
  faCheck,
  faSpinner,
  faServer
} from "@fortawesome/free-solid-svg-icons";
import toast from 'react-hot-toast';

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
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [transferPhase, setTransferPhase] = useState<TransferPhase>("idle");
  const [sentEventIds, setSentEventIds] = useState<Set<string>>(new Set());
  const [sendingEventId, setSendingEventId] = useState<string | null>(null);

  // Écouter l'événement de connexion mobile
  useEffect(() => {
    const unlistenConnect = listen("mobile-connected", () => {
      console.log("Connecté !");
      setTransferPhase("connected");
      toast.success("Mobile connecté avec succès !");
    });

    const unlistenDisconnect = listen("mobile-disconnected", () => {
      console.log("Déconnecté !");
      setTransferPhase("idle");
      toast("Connexion mobile interrompue", { icon: '⚠️' });
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
        toast.error("Impossible de charger les événements");
      }
    };
    loadEvents();
  }, []);

  // Fonction pour l'export Excel
  const generate_excel = useCallback(async () => {
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

      toast.success(`Export Excel réussi : ${filename}`);
    } catch (error) {
      console.error("Erreur export Excel:", error);
      toast.error(`Erreur Export: ${String(error)}`);
    }
  }, [selectedEventId]);

  // Fonction pour la création de PDF
  const createPdf = useCallback(async () => {
    try {
      const eventIdParam = selectedEventId ? selectedEventId : null;
      await invoke("create_pdf", { eventId: eventIdParam });
      toast.success("Le rapport PDF a été généré avec succès.");
    } catch (error) {
      console.error("Erreur PDF:", error);
      toast.error(`Erreur PDF: ${String(error)}`);
    }
  }, [selectedEventId]);

  // Fonction QR Code
  const qr_code = useCallback(async () => {
    setIsLoading(true);
    setQrCodeBase64(null);
    try {
      const eventsData = await invoke<Event[]>("fetch_events");
      setEvents(eventsData);
      const allEventIds = eventsData.map((e) => e.id);
      setSelectedEventIds(new Set(allEventIds));

      const base64String = await invoke<string>("start_server", {
        eventIds: allEventIds,
      });

      setQrCodeBase64(base64String);
      setTransferPhase("qr_displayed");
      setSentEventIds(new Set());
      toast.success(`Partage activé. ${allEventIds.length} événements prêts`);
    } catch (err) {
      console.error("Erreur:", err);
      toast.error(`Erreur: ${err}`);
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
      toast.success("Données synchronisées avec le mobile.");
    } catch (err) {
      console.error("Erreur envoi événement:", err);
      toast.error(`Erreur: ${String(err)}`);
    } finally {
      setSendingEventId(null);
    }
  }, []);

  const terminateTransfer = useCallback(async () => {
    try {
      await invoke("terminate_server");
    } catch (err) {
      console.error("Erreur fermeture serveur:", err);
    }
    setQrCodeBase64(null);
    setTransferPhase("idle");
    setSentEventIds(new Set());
  }, []);

  const getQrCodeUri = (base64: string | null): string => {
    if (!base64) return "";
    return `data:image/png;base64,${base64}`;
  };

  return (
    <div className="h-full flex flex-col space-y-8 pb-10 overflow-y-auto custom-scrollbar pr-2">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg shadow-lg shadow-emerald-500/30">
            <FontAwesomeIcon icon={faDatabase} />
          </span>
          Données
        </h2>
        <p className="text-gray-500 mt-1 ml-1">Exportations et synchronisation mobile.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Card 1: Synchronisation Mobile */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden group">
          <div className="px-6 py-5 bg-linear-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FontAwesomeIcon icon={faMobileAlt} className="text-primary" />
              Synchronisation Mobile
            </h3>
            {transferPhase === "connected" && (
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Connecté
              </span>
            )}
          </div>

          <div className="p-6 flex-1 flex flex-col items-center justify-center min-h-[300px]">
            {transferPhase === "idle" ? (
              <div className="text-center max-w-xs">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400 group-hover:scale-110 transition-transform duration-300 group-hover:bg-primary/5 group-hover:text-primary">
                  <FontAwesomeIcon icon={faWifi} className="text-3xl" />
                </div>
                <p className="text-gray-500 mb-8">
                  Transférez vos événements et points directement vers l'application mobile via le réseau local.
                </p>
                <button
                  onClick={qr_code}
                  disabled={isLoading}
                  className="w-full py-3 px-6 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faServer} />}
                  Connecter un appareil
                </button>
              </div>
            ) : transferPhase === "qr_displayed" && qrCodeBase64 ? (
              <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
                <div className="bg-white p-2 rounded-xl border-2 border-primary/20 shadow-xl mb-6">
                  <img src={getQrCodeUri(qrCodeBase64)} alt="QR Code" className="w-48 h-48 mix-blend-multiply" />
                </div>
                <p className="text-sm font-bold text-gray-800 mb-2">Scannez avec l'app mobile</p>
                <p className="text-xs text-gray-500 mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                  En attente de connexion...
                </p>
                <button
                  onClick={terminateTransfer}
                  className="text-gray-400 hover:text-gray-600 font-medium text-sm transition-colors border-b border-transparent hover:border-gray-400"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 overflow-y-auto mb-4 border border-gray-100 rounded-lg bg-gray-50/50 p-2 space-y-2 max-h-[250px] custom-scrollbar">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Événements disponibles</p>
                  {events.filter(e => selectedEventIds.has(e.id)).map(event => (
                    <div key={event.id} className="bg-white p-3 rounded-lg border border-gray-100 shadow-xs flex items-center justify-between">
                      <span className="font-semibold text-gray-700 text-sm">{event.name}</span>
                      <button
                        onClick={() => sendEventToMobile(event.id)}
                        disabled={sendingEventId === event.id || sentEventIds.has(event.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all
                                        ${sentEventIds.has(event.id)
                            ? 'bg-green-50 text-green-600 border border-green-200'
                            : 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20'
                          }
                                     `}
                      >
                        {sendingEventId === event.id ? (
                          <FontAwesomeIcon icon={faSpinner} spin />
                        ) : sentEventIds.has(event.id) ? (
                          <>Envoyé <FontAwesomeIcon icon={faCheck} /></>
                        ) : (
                          "Transférer"
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={terminateTransfer}
                  className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-100 border border-transparent transition-all"
                >
                  Arrêter le partage
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Exportations */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col group">
          <div className="px-6 py-5 bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FontAwesomeIcon icon={faCloudUploadAlt} className="text-emerald-500" />
              Exports & Rapports
            </h3>
          </div>

          <div className="p-8 flex-1 flex flex-col gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Choisir un événement cible</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-gray-700"
              >
                <option value="">Tous les événements</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-4">
              <button
                onClick={generate_excel}
                className="w-full py-4 px-6 bg-white border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group/btn flex items-center justify-between shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-xl group-hover/btn:scale-110 transition-transform">
                    <FontAwesomeIcon icon={faFileExcel} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Exporter en Excel</p>
                    <p className="text-xs text-gray-500">Format .xlsx compatible</p>
                  </div>
                </div>
                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-gray-300 group-hover/btn:text-green-500" />
              </button>

              <button
                onClick={createPdf}
                className="w-full py-4 px-6 bg-white border border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all group/btn flex items-center justify-between shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xl group-hover/btn:scale-110 transition-transform">
                    <FontAwesomeIcon icon={faFilePdf} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Générer un rapport PDF</p>
                    <p className="text-xs text-gray-500">Document complet imprimable</p>
                  </div>
                </div>
                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-gray-300 group-hover/btn:text-red-500" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Data;
