import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Person } from "../../types";

interface CreatePersonProps {
    onClose: () => void;
    onPersonCreated: (person: Person) => void;
}

export default function CreatePerson({ onClose, onPersonCreated }: CreatePersonProps) {
    const [formData, setFormData] = useState({
        firstname: "",
        lastname: "",
        email: "",
        phoneNumber: null
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.firstname || !formData.lastname) {
            setError("Nom et Prénom sont obligatoires");
            return;
        }

        setLoading(true);
        const newPerson = await invoke<Person>("create_person", { ...formData });
        onPersonCreated(newPerson);
        onClose();
        setLoading(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Ajouter une personne</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Prénom *</label>
                            <input name="firstname" value={formData.firstname} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
                            <input name="lastname" value={formData.lastname} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" required />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
                            <input type="tel" name="phoneNumber" value={formData.phoneNumber || ""} onChange={handleChange} placeholder="06 12 34 56 78" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-secondary hover:bg-secondary/90 rounded-lg transition-colors flex items-center gap-2">
                            {loading && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                            Enregistrer
                        </button>
                    </div>
                </form>
            </div>
            <div className="absolute inset-0 -z-10" onClick={onClose}></div>
        </div>
    );
}