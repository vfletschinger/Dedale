import { useState } from "react";
import toast from "react-hot-toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle, faCheck } from "@fortawesome/free-solid-svg-icons";

interface InterestFormProps {
  onSubmit: (data: {
    description: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function InterestForm({ onSubmit, onCancel }: InterestFormProps) {
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        description,
      });
    } catch (err) {
      console.error("Erreur création point d'intérêt:", err);
      toast.error("Erreur lors de la création du point d'intérêt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-2xl"><FontAwesomeIcon icon={faExclamationCircle} /></span>
          Nouveau Point d'Intérêt
        </h3>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description du point d'intérêt
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez ce point d'intérêt..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-gray-50"
              rows={4}
              required
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Ajout...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheck} />
                  Créer
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
