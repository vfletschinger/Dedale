import { useState } from "react";
import toast from "react-hot-toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRoute, faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";

interface ParcoursFormProps {
  onSubmit: (data: {
    name: string;
    color: string;
    start_time: string;
    speed_low: number;
    speed_high: number;
  }) => void;
  onCancel: () => void;
}

export default function ParcoursForm({ onSubmit, onCancel }: ParcoursFormProps) {
  const [name, setName] = useState("Nouveau Parcours");
  const [color, setColor] = useState("#16a34a");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [speedLow, setSpeedLow] = useState<number>(0);
  const [speedHigh, setSpeedHigh] = useState<number>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Vérifier que la date n'est pas dans le passé
    if (startDate) {
      const today = new Date().toISOString().split('T')[0];
      if (startDate < today) {
        toast.error("La date de début ne peut pas être dans le passé !");
        return;
      }
    }

    // Combiner date et heure en un seul datetime string
    const datetime = startDate && startTime ? `${startDate}T${startTime}` : "";

    onSubmit({
      name,
      color,
      start_time: datetime,
      speed_low: speedLow,
      speed_high: speedHigh,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <FontAwesomeIcon icon={faRoute} className="text-xl" />
            </div>
            Nouveau Parcours
          </h3>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du parcours
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              required
            />
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Couleur
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-14 h-12 rounded-xl border-2 border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 font-mono text-sm"
              />
            </div>
          </div>

          {/* Date et heure de début */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date et heure de début
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={startDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {/* Vitesses */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vitesse min (km/h)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={speedLow}
                onChange={(e) => setSpeedLow(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vitesse max (km/h)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={speedHigh}
                onChange={(e) => setSpeedHigh(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon icon={faCheck} />
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
