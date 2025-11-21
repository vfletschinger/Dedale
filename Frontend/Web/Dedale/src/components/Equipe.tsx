function Equipes() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Équipes</h2>
      <p className="text-gray-600">La liste des équipes s'affichera ici.</p>
      {/* Exemple de liste */}
      <ul className="mt-4 space-y-2">
        <li className="p-4 bg-gray-50 rounded-lg shadow-sm">Équipe Alpha</li>
        <li className="p-4 bg-gray-50 rounded-lg shadow-sm">Équipe Beta</li>
        <li className="p-4 bg-gray-50 rounded-lg shadow-sm">Équipe Gamma</li>
      </ul>
    </div>
  );
}

export default Equipes;