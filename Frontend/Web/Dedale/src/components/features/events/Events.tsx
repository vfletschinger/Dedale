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
  faGhost,
  faClock,
  faSearch,
  faFilter,
} from "@fortawesome/free-solid-svg-icons";
import toast from 'react-hot-toast';
import { Event } from "../../../types";

// Re-export Event for backward compatibility with App.tsx
export type { Event } from "../../../types";

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

  // État pour les filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "future" | "in_progress" | "past">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      toast.error("Impossible de charger les événements.");
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
        toast.success("Mobile connecté !");
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
      toast.error("Impossible de démarrer le serveur de réception.");
    }
  };

  const closeReceiveModal = () => {
    setReceiveQrCode(null);
    setReceiveStatus("En attente...");
  };

  const handleCreateEvent = async () => {
    try {
      if (formData.name.trim() === "") {
        toast.error("Le nom de l'événement est requis !");
        return;
      }

      if (formData.dateDebut === "" || formData.dateFin === "") {
        toast.error("Les dates de début et de fin sont requises !");
        return;
      }

      if (new Date(formData.dateDebut) > new Date(formData.dateFin)) {
        toast.error("La date de fin ne peut pas être antérieure à la date de début !");
        return;
      }

      const newEvent = {
        name: formData.name.trim(),
        start_date: formData.dateDebut,
        end_date: formData.dateFin,
      };

      console.log("Création d'un nouvel événement...", newEvent);
      await invoke("insert_event", { event: newEvent });
      console.log("Événement créé avec succès");
      toast.success("Événement créé avec succès !");

      setFormData({
        name: "",
        dateDebut: "",
        dateFin: ""
      });
      setShowCreateForm(false);
      loadEvents();
    } catch (err) {
      console.error("Erreur lors de la création:", err);
      toast.error(`Erreur lors de la création : ${err}`);
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
      toast.success("Événement supprimé.");
      loadEvents();
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
      toast.error("Erreur lors de la suppression de l'événement");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <div className="flex flex-col items-center gap-3">
          <FontAwesomeIcon icon={faSpinner} spin className="text-primary h-8 w-8" />
          <span className="text-gray-500 font-medium">Chargement des événements...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg mt-10 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-xs">
        <h3 className="font-bold flex items-center gap-2 text-lg mb-2">
          <FontAwesomeIcon icon={faExclamationTriangle} /> Erreur
        </h3>
        <p className="mb-4">{error}</p>
        <button
          onClick={loadEvents}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white text-lg shadow-lg shadow-primary/30">
              <FontAwesomeIcon icon={faCalendarAlt} />
            </span>
            Événements
          </h2>
          <p className="text-gray-500 mt-1 ml-1">Gérez vos événements et planifications.</p>
        </div>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={`px-5 py-2.5 rounded-xl font-medium shadow-md transition-all duration-200 flex items-center gap-2 transform active:scale-95 ${showCreateForm
            ? "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            : "bg-primary text-white hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
            }`}
        >
          {showCreateForm ? <><FontAwesomeIcon icon={faTimes} /> Annuler</> : <><FontAwesomeIcon icon={faPlus} /> Nouvel événement</>}
        </button>
      </div>



      {/* Barre de filtres polie */}
      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
        {/* Sidebar Filtres */}
        <div className="w-72 flex-shrink-0 bg-white p-5 rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/40 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FontAwesomeIcon icon={faSearch} className="text-primary" />
              Recherche
            </h3>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
                <FontAwesomeIcon icon={faSearch} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom de l'événement..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-medium text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="h-px bg-gray-100"></div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FontAwesomeIcon icon={faFilter} className="text-primary" />
              Statut
            </h3>
            <div className="flex flex-col gap-2">
              {(["all", "future", "in_progress", "past"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-between group ${statusFilter === status
                    ? "bg-primary/5 text-primary border border-primary/20"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800 border border-transparent"
                    }`}
                >
                  <span className="capitalize">
                    {status === "all" && "Tous"}
                    {status === "future" && "À venir"}
                    {status === "in_progress" && "En cours"}
                    {status === "past" && "Passés"}
                  </span>
                  {statusFilter === status && (
                    <FontAwesomeIcon icon={faCheck} className="text-primary text-xs" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100"></div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FontAwesomeIcon icon={faClock} className="text-primary" />
              Période
            </h3>
            <div className="flex flex-col gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Du</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Au</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="mt-2 w-full py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faTimes} /> Réinitialiser les dates
                </button>
              )}
            </div>
          </div>
        </div>






        {/* Liste des événements (Grid Layout) */}
        <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50/50 rounded-3xl border border-dashed border-gray-300">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <FontAwesomeIcon icon={faGhost} className="text-4xl text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-600 mb-2">Aucun événement</h3>
              <p className="text-gray-500 mb-6">
                Commencez par créer votre premier événement.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-medium"
              >
                Créer maintenant
              </button>
            </div>
          ) : (
            (() => {
              const now = new Date();
              const filteredEvents = events.filter((event) => {
                // Search filter
                if (searchQuery && !event.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                  return false;
                }

                // Status filter
                const startDate = new Date(event.start_date ?? '');
                const endDate = new Date(event.end_date ?? '');
                if (statusFilter === "future" && startDate <= now) return false;
                if (statusFilter === "in_progress" && (startDate > now || endDate < now)) return false;
                if (statusFilter === "past" && endDate >= now) return false;

                // Date range filter
                if (dateFrom && startDate < new Date(dateFrom)) return false;
                if (dateTo && endDate > new Date(dateTo)) return false;

                return true;
              });

              if (filteredEvents.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <FontAwesomeIcon icon={faSearch} className="text-3xl mb-3 text-gray-300" />
                    <p className="text-gray-500 font-medium">Aucun événement ne correspond aux filtres.</p>
                    <button
                      onClick={() => { setSearchQuery(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); }}
                      className="mt-3 text-primary text-sm hover:underline"
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => onEventClick?.(event.id)}
                      className="group bg-white rounded-2xl p-0 border border-gray-100 shadow-xs hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                    >
                      {/* Card Header with Color Strip */}
                      <div className="relative p-5 pb-0 flex items-start gap-4">
                        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary/20 group-hover:bg-primary transition-colors"></div>

                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-800 group-hover:text-primary transition-colors mb-1">
                            {event.name}
                          </h3>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 pt-4 flex-1">
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm border border-gray-100 shrink-0">
                            <FontAwesomeIcon icon={faClock} />
                          </div>
                          <div className="flex flex-col text-sm">
                            <span className="text-gray-500 text-xs">Période</span>
                            <span className="font-medium text-gray-800">
                              {formatDate(event.start_date ?? '')} - {formatDate(event.end_date ?? '')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReceiveFromMobile(event.id);
                          }}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Importer depuis mobile"
                        >
                          <FontAwesomeIcon icon={faFileImport} />
                        </button>
                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(event.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event.id);
                          }}
                          className="ml-2 px-4 py-2 bg-white border border-gray-200 text-sm font-semibold text-gray-700 rounded-lg shadow-sm hover:border-primary hover:text-primary transition-all flex items-center gap-2"
                        >
                          Ouvrir
                          <FontAwesomeIcon icon={faMapMarkedAlt} className="text-xs" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      </div > {/* Fermeture du conteneur flex-1 */}

      {/* Modal QR Code pour réception */}
      {
        receiveQrCode && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-extrabold text-center mb-6 flex items-center justify-center gap-3 text-gray-800">
                <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <FontAwesomeIcon icon={faMobileAlt} />
                </span>
                Réception Mobile
              </h3>

              <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300 mb-6 flex justify-center relative group">
                <img
                  src={`data:image/png;base64,${receiveQrCode}`}
                  alt="QR Code"
                  className="w-48 h-48 mix-blend-multiply"
                />
              </div>

              <p className="text-gray-600 text-center text-sm mb-6 leading-relaxed">
                Scannez ce QR code avec l'application mobile pour transférer les points vers cet événement.
              </p>

              <div className="text-center mb-6">
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${receiveStatus.includes("connecté") ? "bg-green-100 text-green-700" : "bg-blue-50 text-blue-600"
                  }`}>
                  <div className={`w-2 h-2 rounded-full ${receiveStatus.includes("connecté") ? "bg-green-500" : "bg-blue-500 animate-pulse"}`}></div>
                  {receiveStatus}
                </span>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={closeReceiveModal}
                  className="w-full px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-transform active:scale-95 font-bold shadow-lg shadow-gray-900/20"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal Création d'événement */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-extrabold text-gray-900 mb-8 flex items-center gap-3 border-b border-gray-100 pb-4">
              <span className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center text-lg shadow-sm">
                <FontAwesomeIcon icon={faPlus} />
              </span>
              Créer un nouvel événement
            </h3>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                  Nom de l'événement
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full pl-4 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all font-medium"
                    placeholder="Ex: Festival de musique 2024..."
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                    Date de début
                  </label>
                  <div className="relative">
                    <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      name="dateDebut"
                      value={formData.dateDebut}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all font-medium appearance-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                    Date de fin
                  </label>
                  <div className="relative">
                    <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      name="dateFin"
                      value={formData.dateFin}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all font-medium appearance-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-end gap-3 pt-6 border-t border-gray-100">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateEvent}
                className="px-8 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all font-bold shadow-lg shadow-primary/25 flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faCheck} />
                Créer l'événement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Events;
