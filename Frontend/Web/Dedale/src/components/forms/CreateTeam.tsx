import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Team } from "../../types";

interface CreateTeamProps {
    activeEventId: string;
    onClose: () => void;
    onTeamCreated: (newTeam: Team) => void;
}

export default function CreateTeam({ activeEventId, onClose, onTeamCreated }: CreateTeamProps) {
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const newTeam = await invoke<Team>("create_team", { name, eventId: activeEventId });
            onTeamCreated(newTeam);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Erreur lors de la création: " + err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Nouvelle équipe</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                {/* Formulaire */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Nom de l'équipe</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Équipe Alpha"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="px-4 py-2 text-sm text-white bg-secondary hover:bg-secondary/90 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                            Créer
                        </button>
                    </div>
                </form>
            </div>
            {/* Overlay click to close */}
            <div className="absolute inset-0 -z-10" onClick={onClose}></div>
        </div>
    );
}