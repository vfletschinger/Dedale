import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarPlus,
  faTrash,
  faExternalLinkAlt,
  faSearch,
  faCalendarAlt,
  faFileImport,
  faCheck,
  faTimes,
  faMobileAlt,
  faSpinner,
  faCalendarCheck,
  faExclamationCircle,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import QrCode from './QrCode';
import toast from 'react-hot-toast';

export type Event = {
  id: string;
  name: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
};

type EventProps = {
  onEventClick: (eventId: string) => void;
  onEventsLoaded?: (events: Event[]) => void;
};

function Events({ onEventClick, onEventsLoaded }: EventProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    dateDebut: '',
    dateFin: ''
  });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Écouter les événements de connexion mobile pour l'import
  useEffect(() => {
    let unlistenConnect: () => void;
    let unlistenDisconnect: () => void;

    async function setupListeners() {
      const uConnect = await listen('mobile-connected', () => {
        setIsConnected(true);
        toast.success("Mobile connecté !");
      });
      const uDisconnect = await listen('mobile-disconnected', () => {
        setIsConnected(false);
        toast('Mobile déconnecté', { icon: '👋' });
      });
      unlistenConnect = uConnect;
      unlistenDisconnect = uDisconnect;
    }

    if (importModalOpen) {
      setupListeners();
    }

    return () => {
      if (unlistenConnect) unlistenConnect();
      if (unlistenDisconnect) unlistenDisconnect();
    };
  }, [importModalOpen]);


  async function fetchEvents() {
    setIsLoading(true);
    try {
      const data = await invoke<Event[]>('fetch_events');
      setEvents(data);
      if (onEventsLoaded) {
        onEventsLoaded(data);
      }
    } catch (error) {
      console.error('Erreur chargement événements', error);
      toast.error("Impossible de charger les événements.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newEvent.name || !newEvent.dateDebut || !newEvent.dateFin) {
      toast.error("Veuillez remplir les champs obligatoires.");
      return;
    }

    try {
      await invoke('create_event', { ...newEvent, statut: 'active' });
      toast.success("Événement créé avec succès !");
      setNewEvent({ name: '', description: '', dateDebut: '', dateFin: '' });
      setShowForm(false);
      fetchEvents();
    } catch (error) {
      console.error('Erreur création', error);
      toast.error(`Erreur lors de la création : ${error}`);
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm('Voulez-vous vraiment supprimer cet événement ?')) return;
    try {
      await invoke('delete_event', { id });
      toast.success("Événement supprimé.");
      fetchEvents();
    } catch (error) {
      console.error('Erreur suppression', error);
      toast.error(`Erreur lors de la suppression : ${error}`);
    }
  }

  // --- Gestion de l'import depuis le mobile ---
  async function startImportServer() {
    try {
      setQrCodeBase64(null);
      const qr = await invoke<string>('start_import_server');
      setQrCodeBase64(qr);
    } catch (err) {
      console.error("Erreur start import server", err);
      toast.error("Impossible de démarrer le serveur de réception.");
    }
  }

  async function stopImportServer() {
    try {
      await invoke('stop_import_server');
      setIsConnected(false);
    } catch (err) {
      console.error("Erreur stop import server", err);
    }
  }

  function handleOpenImportModal() {
    setImportModalOpen(true);
    startImportServer();
  }

  function handleCloseImportModal() {
    setImportModalOpen(false);
    stopImportServer();
    fetchEvents(); // Rafraîchir la liste après import potentiel
  }

  return (
    <div className="h-full flex flex-col space-y-6 pb-20">

      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-blue-600 flex items-center justify-center text-white text-lg shadow-lg shadow-blue-500/30">
              <FontAwesomeIcon icon={faCalendarAlt} />
            </span>
            Événements
          </h2>
          <p className="text-gray-500 mt-1 ml-1">Gérez vos missions et interventions.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleOpenImportModal}
            className="px-4 py-2 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faFileImport} />
            <span className="hidden sm:inline">Importer</span>
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-primary/90 hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            <FontAwesomeIcon icon={showForm ? faTimes : faCalendarPlus} />
            <span>{showForm ? 'Fermer' : 'Nouvel événement'}</span>
          </button>
        </div>
      </div>

      {/* Formulaire de création (Animé) */}
      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FontAwesomeIcon icon={faCalendarPlus} />
            </div>
            Créer un nouvel événement
          </h3>
          <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'événement</label>
              <input
                type="text"
                placeholder="Ex: Festival des Vieilles Charrues 2024"
                value={newEvent.name}
                onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-gray-400"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                placeholder="Détails importants, lieu, équipe..."
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-gray-400 resize-none h-24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
              <input
                type="datetime-local"
                value={newEvent.dateDebut}
                onChange={(e) => setNewEvent({ ...newEvent, dateDebut: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-gray-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
              <input
                type="datetime-local"
                value={newEvent.dateFin}
                onChange={(e) => setNewEvent({ ...newEvent, dateFin: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-gray-600"
                required
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
              >
                Créer l'événement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des événements (Grid Layout) */}
      {isLoading && events.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center gap-3">
            <FontAwesomeIcon icon={faSpinner} spin className="text-primary h-8 w-8" />
            <span className="text-gray-500 font-medium">Chargement des événements...</span>
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50/50 rounded-3xl border border-dashed border-gray-300">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <FontAwesomeIcon icon={faCalendarAlt} className="text-4xl text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-600 mb-2">Aucun événement</h3>
          <p className="text-gray-500 mb-6">Commencez par créer votre première mission.</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 shadow-sm transition-all"
          >
            Créer maintenant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="group relative bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
            >
              {/* Bandeau de couleur latérale */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/20 group-hover:bg-primary transition-colors"></div>

              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-blue-50 text-primary text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                    {event.statut}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEvent(event.id);
                    }}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    title="Supprimer"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                  {event.name}
                </h3>

                <p className="text-gray-500 text-sm mb-4 line-clamp-2 min-h-[2.5em]">
                  {event.description || "Aucune description fournie pour cet événement."}
                </p>

                <div className="flex flex-col gap-1.5 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCalendarCheck} className="text-gray-400 w-4" />
                    <span>Du {new Date(event.dateDebut).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCalendarCheck} className="text-gray-400 w-4" />
                    <span>Au {new Date(event.dateFin).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 mt-auto">
                <button
                  onClick={() => onEventClick(event.id)}
                  className="w-full py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <span>Ouvrir</span>
                  <FontAwesomeIcon icon={faExternalLinkAlt} className="text-xs" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Import Mobile (Premium) */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-1/3 bg-linear-to-b from-blue-50 to-transparent -z-10"></div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border border-blue-50 flex items-center justify-center mx-auto mb-4 text-primary text-2xl">
                {isConnected ? <FontAwesomeIcon icon={faCheck} className="text-green-500" /> : <FontAwesomeIcon icon={faMobileAlt} />}
              </div>
              <h3 className="text-xl font-extrabold text-gray-800">Importer un événement</h3>
              <p className="text-sm text-gray-500 mt-1 font-medium">Réception depuis l'application mobile</p>
            </div>

            <div className="flex flex-col items-center justify-center">
              {!qrCodeBase64 ? (
                <div className="py-8 flex flex-col items-center">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-primary mb-3" />
                  <span className="text-gray-500 font-medium text-sm">Génération du QR Code...</span>
                </div>
              ) : isConnected ? (
                <div className="py-8 text-center animate-in slide-in-from-bottom-2">
                  <div className="text-green-500 font-bold text-lg mb-2">Appareil connecté !</div>
                  <p className="text-gray-600 text-sm">En attente des données...</p>
                </div>
              ) : (
                <div className="bg-white p-2 rounded-xl border-2 border-primary/20 shadow-xl mb-6">
                  <QrCode qrCodeUri={`data:image/png;base64,${qrCodeBase64}`} />
                </div>
              )}

              {!isConnected && qrCodeBase64 && (
                <p className="text-xs text-gray-500 mb-6 flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                  Scannez ce code pour vous connecter
                </p>
              )}

              <button
                onClick={handleCloseImportModal}
                className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 hover:text-gray-800 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Events;
