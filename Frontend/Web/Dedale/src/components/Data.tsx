import { useState, useCallback, useEffect, useRef } from "react";
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
  faServer,
  //faFileImport,
  faDownload
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
type SyncMode = "export" | "import";

interface DataProps {
  selectedEventId?: string | null;
}

function Data({ selectedEventId: activeEventId }: DataProps) {
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [isExcelLoading, setIsExcelLoading] = useState<boolean>(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [transferPhase, setTransferPhase] = useState<TransferPhase>("idle");
  const [sentEventIds, setSentEventIds] = useState<Set<string>>(new Set());
  const [sendingEventId, setSendingEventId] = useState<string | null>(null);

  // États pour l'import depuis mobile
  const [receiveQrCode, setReceiveQrCode] = useState<string | null>(null);
  const [receiveStatus, setReceiveStatus] = useState<string>("En attente...");
  const [pointsReceived, setPointsReceived] = useState<number>(0);

  // Mode actif (export ou import)
  const [syncMode, setSyncMode] = useState<SyncMode>("export");

  // Ref pour cooldown sur les toasts et listeners
  const lastConnectionToastTime = useRef(0);
  const listenersSetup = useRef(false);

  // Écouter l'événement de connexion mobile - une seule fois au montage
  useEffect(() => {
    // Éviter le double setup en React Strict Mode
    if (listenersSetup.current) return;
    listenersSetup.current = true;

    let unlistenConnect: (() => void) | null = null;
    let unlistenDisconnect: (() => void) | null = null;

    const setupListeners = async () => {
      unlistenConnect = await listen("mobile-connected", () => {
        console.log("Connecté !");
        setTransferPhase("connected");

        // Cooldown: afficher le toast une seule fois par 3 secondes
        const now = Date.now();
        if (now - lastConnectionToastTime.current > 3000) {
          toast.success("Mobile connecté avec succès !");
          lastConnectionToastTime.current = now;
        }

        // Émettre un événement custom pour notifier les autres composants
        window.dispatchEvent(new CustomEvent("app-mobile-connected"));
      });

      unlistenDisconnect = await listen("mobile-disconnected", () => {
        console.log("Déconnecté !");
        setTransferPhase("idle");
        toast("Connexion mobile interrompue", { icon: '⚠️' });
        // Émettre un événement custom pour notifier les autres composants
        window.dispatchEvent(new CustomEvent("app-mobile-disconnected"));
      });
    };

    setupListeners();

    return () => {
      if (unlistenConnect) unlistenConnect();
      if (unlistenDisconnect) unlistenDisconnect();
    };
  }, []);

  // Listener séparé pour réception de points
  useEffect(() => {
    let unlistenReceiveConnect: (() => void) | null = null;
    let unlistenPointsUpdated: (() => void) | null = null;

    const setupReceiveListener = async () => {
      unlistenReceiveConnect = await listen("mobile-connected", () => {
        if (receiveQrCode) {
          setReceiveStatus("Mobile connecté ! En attente des données...");
        }
      });

      // Listener pour les points reçus
      unlistenPointsUpdated = await listen<number>("points-updated", (event) => {
        const pointsCount = event.payload;
        setPointsReceived(pointsCount);
        setReceiveStatus(`${pointsCount} point(s) reçu(s) avec succès !`);
        
        // Toast de confirmation
        toast.success(`${pointsCount} point(s) importé(s) !`);
        
        // Fermer la connexion automatiquement après 2 secondes
        setTimeout(() => {
          closeReceiveModal();
        }, 2000);
      });
    };

    if (receiveQrCode) {
      setupReceiveListener();
    }

    return () => {
      if (unlistenReceiveConnect) unlistenReceiveConnect();
      if (unlistenPointsUpdated) unlistenPointsUpdated();
    };
  }, [receiveQrCode]);

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
      setIsExcelLoading(true);
      const appDataPath = await path.appDataDir();
      if (!appDataPath) throw new Error("Impossible de récupérer AppData");

      const db_url = await path.join(appDataPath, "mydatabase.db");
      const filename = activeEventId
        ? `points_event_${activeEventId}.xlsx`
        : "points_all.xlsx";

      const excel_path_str = await path.join(appDataPath, filename);
      const eventIdParam = activeEventId ? activeEventId : null;

      await invoke("export_points_excel", {
        dbUrl: db_url,
        excelPathStr: excel_path_str,
        eventId: eventIdParam,
      });

      toast.success(`Export Excel réussi : ${filename}`);
    } catch (error) {
      console.error("Erreur export Excel:", error);
      toast.error(`Erreur Export: ${String(error)}`);
    } finally {
      setIsExcelLoading(false);
    }
  }, [activeEventId]);

  // Fonction pour la création de PDF
  const createPdf = useCallback(async () => {
    try {
      setIsPdfLoading(true);
      await invoke("create_pdf", { eventId: activeEventId });
      toast.success("Le rapport PDF a été généré avec succès.");
    } catch (error) {
      console.error("Erreur PDF:", error);
      toast.error(`Erreur PDF: ${String(error)}`);
    } finally {
      setIsPdfLoading(false);
    }
  }, [activeEventId]);

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

  // Fonction pour démarrer la réception depuis le mobile
  const handleReceiveFromMobile = useCallback(async () => {
    if (!activeEventId) {
      toast.error("Aucun événement sélectionné");
      return;
    }
    try {
      setReceiveStatus("Génération du QR code...");
      console.log("Démarrage serveur de réception pour event:", activeEventId);
      const qrCodeBase64 = await invoke<string>("start_receive_server", {
        eventId: activeEventId,
      });
      setReceiveQrCode(qrCodeBase64);
      setReceiveStatus("Scannez le QR code avec le mobile");
    } catch (err) {
      console.error("Erreur démarrage serveur réception:", err);
      setReceiveStatus(`Erreur: ${err}`);
      toast.error("Impossible de démarrer le serveur de réception.");
    }
  }, [activeEventId]);

  const closeReceiveModal = useCallback(() => {
    setReceiveQrCode(null);
    setReceiveStatus("En attente...");
    setPointsReceived(0);
  }, []);

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

        {/* Card 1: Synchronisation Mobile (Export + Import fusionnés) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden group lg:col-span-1">
          <div className="px-6 py-5 bg-linear-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FontAwesomeIcon icon={faMobileAlt} className="text-primary" />
              Synchronisation Mobile
            </h3>
            {transferPhase === "connected" && syncMode === "export" && (
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Connecté
              </span>
            )}
          </div>

          {/* Onglets Export / Import */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => {
                setSyncMode("export");
                closeReceiveModal();
              }}
              className={`flex-1 py-3 px-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${syncMode === "export"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
            >
              <FontAwesomeIcon icon={faCloudUploadAlt} />
              Envoyer au mobile
            </button>
            <button
              onClick={() => {
                setSyncMode("import");
                terminateTransfer();
              }}
              className={`flex-1 py-3 px-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${syncMode === "import"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
            >
              <FontAwesomeIcon icon={faDownload} />
              Recevoir du mobile
            </button>
          </div>

          <div className="p-6 flex-1 flex flex-col items-center justify-center min-h-[350px]">
            {/* MODE EXPORT */}
            {syncMode === "export" && (
              <>
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
                    <p className="text-xs text-gray-500 mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                      En attente de connexion...
                    </p>

                    {/* Liste des événements à envoyer */}
                    <div className="w-full mt-4 max-h-[120px] overflow-y-auto custom-scrollbar border border-gray-100 rounded-lg bg-gray-50/50 p-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Événements prêts</p>
                      {events.filter(e => selectedEventIds.has(e.id)).map(event => (
                        <div key={event.id} className="bg-white p-2 rounded-lg border border-gray-100 mb-1 flex items-center justify-between">
                          <span className="font-medium text-gray-700 text-xs">{event.name}</span>
                          <span className="text-xs text-gray-400">Prêt</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={terminateTransfer}
                      className="mt-4 text-gray-400 hover:text-red-500 font-medium text-sm transition-colors"
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
              </>
            )}

            {/* MODE IMPORT */}
            {syncMode === "import" && (
              <>
                {!receiveQrCode ? (
                  <div className="text-center max-w-xs">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-400 group-hover:scale-110 transition-transform duration-300">
                      <FontAwesomeIcon icon={faDownload} className="text-3xl" />
                    </div>

                    {/* Affichage de l'événement sélectionné */}
                    {activeEventId ? (
                      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Événement de destination</p>
                        <p className="text-sm font-bold text-gray-800">
                          {events.find(e => e.id === activeEventId)?.name || "Chargement..."}
                        </p>
                      </div>
                    ) : (
                      <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-semibold text-amber-600">⚠️ Sélectionnez un événement dans le menu de gauche</p>
                      </div>
                    )}

                    <p className="text-gray-500 mb-6 text-sm">
                      Recevez les points collectés sur le terrain depuis l'application mobile.
                    </p>
                    <button
                      onClick={handleReceiveFromMobile}
                      disabled={!activeEventId}
                      className="w-full py-3 px-6 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <FontAwesomeIcon icon={faServer} />
                      Attendre le mobile
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
                    <div className="bg-white p-2 rounded-xl border-2 border-blue-200 shadow-xl mb-6">
                      <img src={`data:image/png;base64,${receiveQrCode}`} alt="QR Code" className="w-48 h-48 mix-blend-multiply" />
                    </div>
                    <p className="text-sm font-bold text-gray-800 mb-2">Scannez avec l'app mobile</p>
                    
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-4 ${
                      receiveStatus.includes("reçu") || pointsReceived > 0 ? "bg-green-100 text-green-700" : "bg-blue-50 text-blue-600"
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${receiveStatus.includes("reçu") || pointsReceived > 0 ? "bg-green-500" : "bg-blue-500 animate-pulse"}`}></div>
                      {receiveStatus}
                    </span>

                    {/* Événement cible */}
                    <div className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Import vers</p>
                      <p className="text-sm font-bold text-gray-800">
                        {events.find(e => e.id === activeEventId)?.name || "Événement"}
                      </p>
                    </div>

                    <button
                      onClick={closeReceiveModal}
                      className="text-gray-400 hover:text-red-500 font-medium text-sm transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </>
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

          <div className="p-6 flex-1 flex flex-col">
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={generate_excel}
                disabled={isExcelLoading}
                className="w-full py-4 px-6 bg-white border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group/btn flex items-center justify-between shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-xl group-hover/btn:scale-110 transition-transform">
                    <FontAwesomeIcon icon={isExcelLoading ? faSpinner : faFileExcel} className={isExcelLoading ? "animate-spin" : ""} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">{isExcelLoading ? "Export en cours..." : "Exporter en Excel"}</p>
                    <p className="text-xs text-gray-500">Format .xlsx compatible</p>
                  </div>
                </div>
                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-gray-300 group-hover/btn:text-green-500" />
              </button>

              <button
                onClick={createPdf}
                disabled={isPdfLoading}
                className="w-full py-4 px-6 bg-white border border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all group/btn flex items-center justify-between shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xl group-hover/btn:scale-110 transition-transform">
                    <FontAwesomeIcon icon={isPdfLoading ? faSpinner : faFilePdf} className={isPdfLoading ? "animate-spin" : ""} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">{isPdfLoading ? "Génération en cours..." : "Générer un rapport PDF"}</p>
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
