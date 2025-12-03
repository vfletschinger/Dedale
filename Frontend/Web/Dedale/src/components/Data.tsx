import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as path from '@tauri-apps/api/path';
import QrCode from './QrCode';

type Event = {
    id: number;
    name: string;
    description: string;
    dateDebut: string;
    dateFin: string;
    statut: string;
};

function Data() {
    const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    // État pour les messages de statut (Export, PDF)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
    // États pour la sélection d'événements
    const [showEventSelector, setShowEventSelector] = useState(false);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());
    const [loadingEvents, setLoadingEvents] = useState(false);

    // Charger les événements
    const loadEvents = useCallback(async () => {
        setLoadingEvents(true);
        try {
            const eventsData = await invoke<Event[]>("fetch_events");
            setEvents(eventsData);
            // Sélectionner tous les événements par défaut
            setSelectedEventIds(new Set(eventsData.map(e => e.id)));
        } catch (err) {
            console.error("Erreur lors du chargement des événements:", err);
            setError(String(err));
        } finally {
            setLoadingEvents(false);
        }
    }, []);

    // Ouvrir le sélecteur d'événements
    const openEventSelector = useCallback(async () => {
        await loadEvents();
        setShowEventSelector(true);
    }, [loadEvents]);

    // Toggle la sélection d'un événement
    const toggleEventSelection = (eventId: number) => {
        setSelectedEventIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(eventId)) {
                newSet.delete(eventId);
            } else {
                newSet.add(eventId);
            }
            return newSet;
        });
    };

    // Sélectionner/Désélectionner tous
    const toggleSelectAll = () => {
        if (selectedEventIds.size === events.length) {
            setSelectedEventIds(new Set());
        } else {
            setSelectedEventIds(new Set(events.map(e => e.id)));
        }
    };

    // Fonction pour l'export Excel
    const generate_excel = useCallback(async () => {
        setMessage(null);
        try {
            const appDataPath = await path.appDataDir();
            if (!appDataPath) throw new Error("Impossible de récupérer AppData");

            // Utilisation de mockPath.join
            const db_url = await path.join(appDataPath, 'mydatabase.db');
            const excel_path_str = await path.join(appDataPath, 'points.xlsx');
            
            console.log(`Chemin de la BDD: ${db_url}`);
            console.log(`Chemin Excel: ${excel_path_str}`);

            // Utilisation de mockInvoke
            await invoke('export_points_excel', { dbUrl: db_url, excelPathStr: excel_path_str });

            setMessage({ 
                type: 'success', 
                text: `Exportation Excel réussie. Le fichier est simulé à : ${excel_path_str}` 
            });
        } catch (error) {
            console.error("Erreur lors de l'exportation Excel:", error);
            setMessage({ 
                type: 'error', 
                text: `Erreur d'exportation: ${String(error)}. Vérifiez la console.` 
            });
        }
    }, []);

    // Fonction pour la création de PDF
    const createPdf = useCallback(async () => {
        setMessage(null);
        try {
            // Utilisation de mockInvoke
            await invoke("create_pdf");
            setMessage({ 
                type: 'success', 
                text: "Génération PDF lancée avec succès (simulée). Vérifiez votre dossier de données." 
            });
        } catch (error) {
            console.error("Erreur lors de la création du PDF:", error);
            setMessage({ 
                type: 'error', 
                text: `Erreur de création PDF: ${String(error)}. Vérifiez la console.` 
            });
        }
    }, []);


    // Fonction pour le démarrage du serveur et génération du QR code
    const qr_code = useCallback(async () => {
        // D'abord ouvrir le sélecteur d'événements
        await openEventSelector();
    }, [openEventSelector]);

    // Confirmer et démarrer le transfert avec les événements sélectionnés
    const confirmAndStartTransfer = useCallback(async () => {
        if (selectedEventIds.size === 0) {
            setMessage({ type: 'error', text: 'Veuillez sélectionner au moins un événement.' });
            return;
        }

        setShowEventSelector(false);
        setIsLoading(true);
        setError(null);
        setQrCodeBase64(null);
        setMessage(null);

        try {
            // Passer les IDs des événements sélectionnés au serveur
            const eventIdsArray = Array.from(selectedEventIds);
            console.log("📤 Transfert des événements:", eventIdsArray);
            
            const base64String = await invoke<string>('start_server', { 
                eventIds: eventIdsArray 
            });
            
            setQrCodeBase64(base64String);
            setMessage({ 
                type: 'success', 
                text: `Serveur démarré avec ${eventIdsArray.length} événement(s) sélectionné(s).` 
            });
        } catch (err) {
            console.error('Erreur au démarrage du serveur:', err);
            setError(String(err));
        } finally {
            setIsLoading(false);
        }
    }, [selectedEventIds]);

    const getQrCodeUri = (base64: string | null): string => {
        if (!base64) return '';
        return `data:image/png;base64,${base64}`;
    }
    
    // Classes de base pour les boutons
    const baseBtn = "w-full px-6 py-3 font-semibold rounded-xl transition duration-300 shadow-md transform hover:scale-[1.02]";
    
    const exportBtnClass = `${baseBtn} bg-green-500 text-white hover:bg-green-600 focus:ring-4 focus:ring-green-300`;
    const pdfBtnClass = `${baseBtn} bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300`;
    const connectBtnClass = qrCodeBase64 
        ? `${baseBtn} bg-blue-500 text-white hover:bg-blue-600 focus:ring-4 focus:ring-blue-300`
        : `${baseBtn} bg-gray-700 text-white hover:bg-gray-800 focus:ring-4 focus:ring-gray-400`;

    // Composant de feedback pour les messages (success/error)
    const FeedbackMessage = ({ type, text }: { type: 'success' | 'error'; text: string }) => {
        const classes = type === 'success' 
            ? "bg-green-100 border-green-500 text-green-700"
            : "bg-red-100 border-red-500 text-red-700";
        const title = type === 'success' ? "Succès" : "Erreur";

        return (
            <div className={`p-4 border-l-4 ${classes} rounded-lg shadow-inner mt-4 w-full max-w-lg mx-auto`}>
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

                {/* Section des Messages de Statut Global */}
                {message && <FeedbackMessage type={message.type} text={message.text} />}


                <div className="mt-8 grid lg:grid-cols-3 gap-8">

                    {/* COLONNE 1: Gestion des Données (Export/PDF) */}
                    <div className="lg:col-span-1 bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-lg h-full">
                        <h2 className="text-2xl font-bold text-gray-700 mb-6 border-b pb-2">
                            Gestion des Fichiers
                        </h2>
                        <div className="space-y-4">
                            <button
                                className={exportBtnClass}
                                onClick={generate_excel}
                                aria-label="Exporter les données au format Excel"
                            >
                                Exporter les Données (Excel)
                            </button>
                            <button
                                className={pdfBtnClass}
                                onClick={createPdf}
                                aria-label="Créer un rapport PDF"
                            >
                                Créer un Rapport (PDF)
                            </button>
                        </div>
                    </div>


                    {/* COLONNE 2 & 3: Connexion Mobile (QR Code) */}
                    <div className="lg:col-span-2 bg-blue-50 p-6 rounded-2xl border-2 border-dashed border-blue-200 shadow-lg flex flex-col items-center justify-center min-h-[300px]">
                        <h2 className="text-2xl font-bold text-blue-700 mb-6 text-center">
                            Connexion de l'Application Mobile
                        </h2>
                        
                        <div className="w-full max-w-md">
                            <button
                                className={connectBtnClass}
                                onClick={qr_code}
                                disabled={isLoading}
                                aria-label={qrCodeBase64 ? "Serveur déjà démarré" : "Démarrer le serveur et connecter l'application"}
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Démarrage du serveur...
                                    </span>
                                ) : (
                                    qrCodeBase64 ? "Serveur WebSocket Actif" : "Transférer vers l'App Mobile"
                                )}
                            </button>
                        </div>

                        {/* Contenu dynamique : Erreur / QR Code */}
                        <div className="mt-8">
                            {error && (
                                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center shadow-lg">
                                    <h3 className="font-bold mb-1">Erreur Critique</h3>
                                    <p className="text-sm">Impossible de démarrer le serveur. Erreur: <code className="text-xs break-all">{error}</code></p>
                                </div>
                            )}
                            
                            {qrCodeBase64 && !isLoading && (
                                <div className="flex flex-col items-center">
                                    <p className="text-lg text-gray-700 mb-4 font-medium">
                                        Scannez ce code depuis l'application mobile.
                                    </p>
                                    <QrCode 
                                        qrCodeUri={getQrCodeUri(qrCodeBase64)} 
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Modal de sélection des événements */}
            {showEventSelector && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold">📤 Sélection des événements</h3>
                                    <p className="text-white/80 text-sm mt-1">
                                        Choisissez les événements à transférer
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowEventSelector(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Liste des événements */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {loadingEvents ? (
                                <div className="flex items-center justify-center py-8">
                                    <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="ml-3 text-gray-600">Chargement des événements...</span>
                                </div>
                            ) : events.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <div className="text-4xl mb-2">📭</div>
                                    <p>Aucun événement disponible</p>
                                </div>
                            ) : (
                                <>
                                    {/* Sélectionner tout */}
                                    <div className="mb-4 pb-3 border-b border-gray-200">
                                        <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={selectedEventIds.size === events.length}
                                                onChange={toggleSelectAll}
                                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="font-semibold text-gray-700">
                                                {selectedEventIds.size === events.length ? "Tout désélectionner" : "Tout sélectionner"}
                                            </span>
                                            <span className="ml-auto text-sm text-gray-500">
                                                {selectedEventIds.size}/{events.length} sélectionné(s)
                                            </span>
                                        </label>
                                    </div>

                                    {/* Liste */}
                                    <div className="space-y-2">
                                        {events.map((event) => (
                                            <label
                                                key={event.id}
                                                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                    selectedEventIds.has(event.id)
                                                        ? 'bg-blue-50 border-blue-300 shadow-sm'
                                                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEventIds.has(event.id)}
                                                    onChange={() => toggleEventSelection(event.id)}
                                                    className="w-5 h-5 mt-0.5 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-gray-800 truncate">
                                                        {event.name}
                                                    </div>
                                                    <div className="text-sm text-gray-500 truncate">
                                                        {event.description}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                            event.statut === 'Actif' 
                                                                ? 'bg-green-100 text-green-700'
                                                                : event.statut === 'Prévu'
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {event.statut}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {event.dateDebut} → {event.dateFin}
                                                        </span>
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
                            <button
                                onClick={() => setShowEventSelector(false)}
                                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmAndStartTransfer}
                                disabled={selectedEventIds.size === 0}
                                className={`flex-1 px-4 py-3 font-semibold rounded-xl transition-all ${
                                    selectedEventIds.size === 0
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg'
                                }`}
                            >
                                Transférer ({selectedEventIds.size})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Data;