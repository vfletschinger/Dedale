import { invoke } from '@tauri-apps/api/core';
import { path } from '@tauri-apps/api';

async function generate_excel() {

  const appDataPath = await path.appDataDir();

  if (!appDataPath) throw new Error("Impossible de récupérer AppData");

  const db_url = `${appDataPath}\\mydatabase.db`;

  const excel_path_str = `${appDataPath}\\points.xlsx`;

  await invoke(
    'export_points_excel', {
    dbUrl: db_url,
    excelPathStr: excel_path_str
  });

}
async function createPdf() {
  await invoke("create_pdf");
}
function Accueil() {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Accueil</h2>
      <p className="text-gray-600 mb-6">
        Bienvenue sur l'application Dedale ! Utilisez la navigation pour explorer les différentes sections.
      </p>
      <button
        className="inline-flex items-center justify-center px-4 py-2 bg-[#1f9d55] text-white font-medium rounded-md hover:bg-[#2ad783] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2ad783]"
        onClick={generate_excel}
      >
        Exporter Excel
      </button>
      <button
        type="button"
        className="px-3 py-2 rounded-md text-[#ffffff] bg-[#20272f] hover:bg-[#2ad783] transition font-medium"
        onClick={() => createPdf()}
      >
        Creer un pdf
      </button>
    </div>
  );
}

export default Accueil;