import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { invoke } from "@tauri-apps/api/core";
import { EquipementType } from "../types/map";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTools, faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";

interface EquipementFormProps {
  lineLength: number;
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
  const [lengthPerUnit, setLengthPerUnit] = useState<number>(2);
  const [quantity, setQuantity] = useState<number>(1);
  const [description, setDescription] = useState<string>("");

  const getCurrentDateTimeISO = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [datePose, setDatePose] = useState<string>(getCurrentDateTimeISO());
  const [dateDepose, setDateDepose] = useState<string>(getCurrentDateTimeISO());

  const suggestedQuantity =
    lengthPerUnit > 0 ? Math.ceil(lineLength / lengthPerUnit) : 1;

  useEffect(() => {
    setQuantity(suggestedQuantity);
  }, [suggestedQuantity]);

  useEffect(() => {
    const loadTypes = async () => {
      try {
        await invoke("seed_default_equipment_types");
        const fetchedTypes = await invoke<EquipementType[]>("fetch_equipment_types");
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
      toast.error("Veuillez sélectionner un type d'équipement");
      return;
    }

    const poseDate = new Date(datePose);
    const deposeDate = new Date(dateDepose);

    if (poseDate >= deposeDate) {
      toast.error("La date de dépose doit être postérieure à la date de pose !");
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <FontAwesomeIcon icon={faTools} className="text-xl" />
            </div>
            Nouvel Équipement
          </h3>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Type d'équipement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type d'équipement
            </label>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
              required
            >
              <option value="" disabled>Sélectionner un type</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          {/* Info boxes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
              <div className="text-xs font-medium text-orange-600 mb-1">Longueur tracée</div>
              <div className="text-lg font-bold text-gray-800">{lineLength.toFixed(1)} m</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="text-xs font-medium text-gray-500 mb-1">Qté suggérée</div>
              <div className="text-lg font-bold text-gray-600">{suggestedQuantity} unité(s)</div>
            </div>
          </div>

          {/* Longueur unitaire et Quantité */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longueur unitaire (m)
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={lengthPerUnit}
                onChange={(e) => setLengthPerUnit(parseFloat(e.target.value) || 1)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre à installer
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 border border-orange-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-orange-50 font-semibold"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ajoutez une description..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none bg-gray-50"
              rows={2}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date/heure de pose
              </label>
              <input
                type="datetime-local"
                value={datePose}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setDatePose(e.target.value)}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date/heure de dépose
              </label>
              <input
                type="datetime-local"
                value={dateDepose}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setDateDepose(e.target.value)}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50 text-sm"
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
              className="flex-1 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon icon={faCheck} />
              Créer l'équipement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
