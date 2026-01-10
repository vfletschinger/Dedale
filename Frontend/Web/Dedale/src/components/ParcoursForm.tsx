import { useState } from "react";

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
  const [color, setColor] = useState("#ef4444");
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
        alert("La date de début ne peut pas être dans le passé !");
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
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">📍</span>
          Nouveau Parcours
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du parcours
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Couleur
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 rounded cursor-pointer border border-gray-300"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
              />
            </div>
          </div>

          {/* Date et heure de début */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date et heure de début
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                min={new Date().toISOString().split('T')[0]} // Empêche la sélection de dates passées
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Vitesse la plus basse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vitesse la plus basse (km/h)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={speedLow}
              onChange={(e) => setSpeedLow(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Vitesse la plus haute */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vitesse la plus haute (km/h)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={speedHigh}
              onChange={(e) => setSpeedHigh(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors"
            >
              Créer
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg font-medium transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
