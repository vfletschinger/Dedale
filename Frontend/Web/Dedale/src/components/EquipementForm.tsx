import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EquipementType } from "../types/map";

interface EquipementFormProps {
  lineLength: number; // Longueur totale de la ligne tracée en mètres
  onSubmit: (data: {
    type_id: string;
    length_per_unit: number;
    quantity: number;
    date_pose: string;
    date_depose: string;
  }) => void;
  onCancel: () => void;
}

export default function EquipementForm({
  lineLength,
  onSubmit,
  onCancel,
}: EquipementFormProps) {
  const [types, setTypes] = useState<EquipementType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [lengthPerUnit, setLengthPerUnit] = useState<number>(2); // 2 mètres par défaut
  const [quantity, setQuantity] = useState<number>(1); // Quantité modifiable par l'utilisateur
  const [datePose, setDatePose] = useState<string>("2000-01-01T00:00");
  const [dateDepose, setDateDepose] = useState<string>("2000-01-01T00:00");

  // Calcul automatique de la quantité suggérée (indication uniquement)
  const suggestedQuantity =
    lengthPerUnit > 0 ? Math.ceil(lineLength / lengthPerUnit) : 1;

  // Mettre à jour la quantité suggérée quand la longueur unitaire change
  useEffect(() => {
    setQuantity(suggestedQuantity);
  }, [suggestedQuantity]);

  // Charger les types d'équipement au montage
  useEffect(() => {
    const loadTypes = async () => {
      try {
        // Seed les types par défaut si nécessaire
        await invoke("seed_default_equipment_types");
        // Récupérer les types
        const fetchedTypes = await invoke<EquipementType[]>(
          "fetch_equipment_types"
        );
        setTypes(fetchedTypes);
        if (fetchedTypes.length > 0) {
          setSelectedTypeId(fetchedTypes[0].id);
        }
      } catch (err) {
        console.error("Erreur chargement types:", err);
      }
    };
    loadTypes();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTypeId) {
      alert("Veuillez sélectionner un type d'équipement");
      return;
    }

    onSubmit({
      type_id: selectedTypeId,
      length_per_unit: lengthPerUnit,
      quantity: quantity,
      date_pose: datePose,
      date_depose: dateDepose,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">🚧</span>
          Nouvel Équipement
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type d'équipement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type d'équipement
            </label>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="" disabled>
                Sélectionner un type
              </option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          {/* Longueur totale tracée (lecture seule) */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Longueur totale tracée
            </label>
            <p className="text-lg font-semibold text-gray-800">
              {lineLength.toFixed(2)} mètres
            </p>
          </div>

          {/* Longueur unitaire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longueur unitaire (mètres)
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={lengthPerUnit}
              onChange={(e) =>
                setLengthPerUnit(parseFloat(e.target.value) || 1)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          {/* Indication de quantité suggérée */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Quantité suggérée (indication)
            </label>
            <p className="text-lg font-semibold text-gray-600">
              {suggestedQuantity} unité(s)
            </p>
            <p className="text-xs text-gray-400 mt-1">
              = {lineLength.toFixed(2)}m ÷ {lengthPerUnit}m (arrondi au
              supérieur)
            </p>
          </div>

          {/* Quantité réelle (modifiable) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre d'équipements à installer
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg font-semibold"
              required
            />
          </div>

          {/* Date et heure de pose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date et heure de pose
            </label>
            <input
              type="datetime-local"
              value={datePose}
              onChange={(e) => setDatePose(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Date et heure de dépose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date et heure de dépose
            </label>
            <input
              type="datetime-local"
              value={dateDepose}
              onChange={(e) => setDateDepose(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium transition-colors"
            >
              Créer l'équipement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
