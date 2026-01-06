import { useState } from "react";

interface InterestFormProps {
  onSubmit: (data: {
    description: string;
  }) => void;
  onCancel: () => void;
}

export default function InterestForm({ onSubmit, onCancel }: InterestFormProps) {
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    
    onSubmit({
      description,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">?</span>
          Nouveau Point d'Intérêt
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                Description du point d'intérêt
                </label>
                <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
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
