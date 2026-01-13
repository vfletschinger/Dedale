import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarAlt,
  faPlus,
  faTrash,
  faMapMarkedAlt,
  faFileImport,
  faMobileAlt,
  faTimes,
  faCheck,
  faSpinner,
  faExclamationTriangle,
  faGhost
} from "@fortawesome/free-solid-svg-icons";

// Types
export interface Event {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  statut: string;
}

interface EventsProps {
  onEventClick?: (eventId: string) => void;
  onEventsLoaded?: (events: Event[]) => void;
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "Non définie";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

function Events({ onEventClick, onEventsLoaded }: EventsProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    dateDebut: "",
    dateFin: "",
  });

  // État pour le QR code de réception
  const [receiveQrCode, setReceiveQrCode] = useState<string | null>(null);
  const [receiveStatus, setReceiveStatus] = useState<string>("En attente...");

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Flux: Chargement des événements...");
      const eventsData = await invoke<Event[]>("fetch_events");
      console.log("Flux: Événements reçus:", eventsData);
      setEvents(eventsData);
      if (onEventsLoaded) onEventsLoaded(eventsData);
    } catch (err: unknown) {
      console.error("Erreur lors du chargement des événements:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Écouter les événements de réception de points
  useEffect(() => {
    let unlistenConnectedFn: (() => void) | null = null;
    let unlistenPointsUpdatedFn: (() => void) | null = null;
    let isMounted = true;

    const setupListeners = async () => {
      unlistenConnectedFn = await listen("mobile-connected", () => {
        if (!isMounted) return;
        console.log("Mobile connecté pour réception !");
        setReceiveStatus("Mobile connecté ! En attente des données...");
      });

      unlistenPointsUpdatedFn = await listen<number>(
        "points-updated",
        (event) => {
          if (!isMounted) return;
          const eventId = event.payload;
          console.log("Points mis à jour pour event_id:", eventId);
          // Si c'est l'événement qu'on est en train de recevoir
        },
      );
    };

    setupListeners();

    return () => {
      isMounted = false;
      if (unlistenConnectedFn) unlistenConnectedFn();
      if (unlistenPointsUpdatedFn) unlistenPointsUpdatedFn();
    };
  }, []);

  // Fonction pour démarrer la réception depuis le mobile
  const handleReceiveFromMobile = async (eventId: string) => {
    try {
      setReceiveStatus("Génération du QR code...");

      console.log("Démarrage serveur de réception pour event:", eventId);
      const qrCodeBase64 = await invoke<string>("start_receive_server", {
        eventId,
      });

      setReceiveQrCode(qrCodeBase64);
      setReceiveStatus("Scannez le QR code avec le mobile");
    } catch (err) {
      console.error("Erreur démarrage serveur réception:", err);
      setReceiveStatus(`Erreur: ${err}`);
    }
  };

  const closeReceiveModal = () => {
    setReceiveQrCode(null);
    setReceiveStatus("En attente...");
  };

  const handleCreateEvent = async () => {
    try {
      if (formData.name.trim() === "") {
        alert("Le nom de l'événement est requis !");
        return;
      }

      if (formData.dateDebut === "" || formData.dateFin === "") {
        alert("Les dates de début et de fin sont requises !");
        return;
      }

      // Vérifier que les dates ne sont pas dans le passé
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD d'aujourd'hui
      if (formData.dateDebut < today) {
        alert("La date de début ne peut pas être dans le passé !");
        return;
      }

      if (formData.dateFin < today) {
        alert("La date de fin ne peut pas être dans le passé !");
        return;
      }

      if (new Date(formData.dateDebut) > new Date(formData.dateFin)) {
        alert("La date de fin ne peut pas être antérieure à la date de début !");
        return;
      }

      const newEvent = {
        name: formData.name.trim(),
        start_date: formData.dateDebut, // <--- Renommé pour matcher Rust
        end_date: formData.dateFin,
      };

      console.log("Création d'un nouvel événement...", newEvent);
      await invoke("insert_event", { event: newEvent });
      console.log("Événement créé avec succès");

      setFormData({
        name: "",
        dateDebut: "",
        dateFin: ""
      });
      setShowCreateForm(false);
      loadEvents();
    } catch (err) {
      console.error("Erreur lors de la création:", err);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet événement ?")) {
      return;
    }
    try {
      console.log("Suppression de l'événement:", eventId);
      await invoke("delete_event", { eventId });
      console.log("Événement supprimé");
      loadEvents();
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
      alert("Erreur lors de la suppression de l'événement");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <FontAwesomeIcon icon={faSpinner} spin className="text-primary h-8 w-8" />
        <span className="ml-2">Chargement des événements...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <h3 className="font-bold flex items-center gap-2">
          <FontAwesomeIcon icon={faExclamationTriangle} /> Erreur
        </h3>
        <p>{error}</p>
        <button
          onClick={loadEvents}
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FontAwesomeIcon icon={faCalendarAlt} className="text-primary" /> Événements
        </h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors flex items-center gap-2"
        >
          {showCreateForm ? <><FontAwesomeIcon icon={faTimes} /> Annuler</> : <><FontAwesomeIcon icon={faPlus} /> Créer un événement</>}
        </button>
      </div>

      {/* Formulaire de création */}
      {showCreateForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Nouvel événement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l'événement *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Nom de l'événement"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de début *
              </label>
              <input
                type="date"
                name="dateDebut"
                value={formData.dateDebut}
                min={new Date().toISOString().split('T')[0]} // Empêche la sélection de dates passées
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de fin *
              </label>
              <input
                type="date"
                name="dateFin"
                value={formData.dateFin}
                min={new Date().toISOString().split('T')[0]} // Empêche la sélection de dates passées
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreateEvent}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faCheck} /> Créer l'événement
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faTimes} /> Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des événements */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-5xl mb-3"><FontAwesomeIcon icon={faGhost} className="text-gray-300" /></p>
            <p>Aucun événement trouvé.</p>
            <p className="text-sm">
              Créez votre premier événement pour commencer !
            </p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onEventClick?.(event.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {event.name}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>
                      <FontAwesomeIcon icon={faCalendarAlt} className="mr-1" /> Du {formatDate(event.start_date)} au {formatDate(event.end_date)}
                    </span>

                  </div>
                </div>
                <div className="ml-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReceiveFromMobile(event.id);
                    }}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors flex items-center gap-1"
                    title="Importer depuis mobile"
                  >
                    <FontAwesomeIcon icon={faFileImport} /> Import
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event.id);
                    }}
                    className="px-3 py-1 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors flex items-center gap-1"
                    title="Voir sur la carte"
                  >
                    <FontAwesomeIcon icon={faMapMarkedAlt} /> Voir
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEvent(event.id);
                    }}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors flex items-center gap-1"
                    title="Supprimer"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal QR Code pour réception */}
      {receiveQrCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-center mb-4 flex items-center justify-center gap-2">
              <FontAwesomeIcon icon={faMobileAlt} /> Recevoir depuis le mobile
            </h3>
            <p className="text-gray-600 text-center mb-4">
              Scannez ce QR code avec l'application mobile pour envoyer les
              points de l'événement.
            </p>

            <div className="flex justify-center mb-4">
              <img
                src={`data:image/png;base64,${receiveQrCode}`}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-gray-500">{receiveStatus}</p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={closeReceiveModal}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
