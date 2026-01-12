import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EquipementType } from "../types/map";

interface EquipementFormProps {
  lineLength: number; // Longueur totale de la ligne tracée en mètres
  onSubmit: (data: {
    type_id: string;
    length_per_unit: number;
    quantity: number;
    description: string;
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
  const [description, setDescription] = useState<string>(""); // Description de l'équipement
  
  // Utiliser la date actuelle formatée en ISO comme date par défaut
  const getCurrentDateTimeISO = () => {
    const now = new Date();
    // Formater en ISO avec timezone locale (YYYY-MM-DDTHH:mm)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  const [datePose, setDatePose] = useState<string>(getCurrentDateTimeISO());
  const [dateDepose, setDateDepose] = useState<string>(getCurrentDateTimeISO());

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

    // Vérifier que les dates ne sont pas dans le passé
    const now = new Date();
    const poseDate = new Date(datePose);
    const deposeDate = new Date(dateDepose);
    
    if (poseDate < now) {
      alert("La date de pose ne peut pas être dans le passé !");
      return;
    }
    
    if (deposeDate < now) {
      alert("La date de dépose ne peut pas être dans le passé !");
      return;
    }
    
    if (poseDate >= deposeDate) {
      alert("La date de dépose doit être postérieure à la date de pose !");
      return;
    }

    onSubmit({
      type_id: selectedTypeId,
      length_per_unit: lengthPerUnit,
      quantity: quantity,
      description: description,
      date_pose: datePose,
      date_depose: dateDepose,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span className="text-xl">🚧</span>
          Nouvel Équipement
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Type d'équipement */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Type d'équipement
            </label>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
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

          {/* Longueur et quantité sur une ligne */}
          <div className="grid grid-cols-2 gap-3">
            {/* Longueur totale tracée */}
            <div className="bg-gray-50 p-2 rounded-lg">
              <label className="block text-xs font-medium text-gray-500">
                Longueur tracée
              </label>
              <p className="text-sm font-semibold text-gray-800">
                {lineLength.toFixed(1)} m
              </p>
            </div>

            {/* Quantité suggérée */}
            <div className="bg-gray-50 p-2 rounded-lg">
              <label className="block text-xs font-medium text-gray-500">
                Qté suggérée
              </label>
              <p className="text-sm font-semibold text-gray-600">
                {suggestedQuantity} unité(s)
              </p>
            </div>
          </div>

          {/* Longueur unitaire et Quantité sur une ligne */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Longueur unitaire (m)
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={lengthPerUnit}
                onChange={(e) =>
                  setLengthPerUnit(parseFloat(e.target.value) || 1)
                }
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nombre à installer
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-2 py-1.5 text-sm border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ajoutez une description..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              rows={2}
            />
          </div>

          {/* Dates sur une ligne */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date/heure de pose
              </label>
              <input
                type="datetime-local"
                value={datePose}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setDatePose(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date/heure de dépose
              </label>
              <input
                type="datetime-local"
                value={dateDepose}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setDateDepose(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium transition-colors text-sm"
            >
              Créer l'équipement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
