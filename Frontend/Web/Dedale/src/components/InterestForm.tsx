import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamation, faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";

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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <FontAwesomeIcon icon={faExclamation} className="text-xl" />
            </div>
            Nouveau Point d'Intérêt
          </h3>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

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
