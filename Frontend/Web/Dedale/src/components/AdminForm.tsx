import { useState } from "react";

interface Props {
  onSubmit: (username: string, password: string) => Promise<void> | void;
}

export default function AdminForm({ onSubmit }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Veuillez fournir un nom d'utilisateur et un mot de passe.");
      return;
    }
    setLoading(true);
    try {
      // Delegate the creation to parent (avoid double-invoke)
      await onSubmit(username, password);
    } catch (err: unknown) {
      console.error('create admin failed', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-6 rounded shadow">
      {error && <div className="text-red-600">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700">Nom d'utilisateur</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 block w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <button
          type="submit"
          className="w-full bg-[#2ad783] text-white py-2 rounded font-medium disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Création...' : "Créer l'administrateur"}
        </button>
      </div>
    </form>
  );
}
