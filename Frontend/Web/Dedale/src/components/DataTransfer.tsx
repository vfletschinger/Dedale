import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as path from '@tauri-apps/api/path'; 
import QrCode from './QrCode'; 

function DataTransfer() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const qr_code = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setQrCodeBase64(null);

    try {
      const base64String = await invoke<string>('start_server');
      setQrCodeBase64(base64String);
    } catch (err) {
      console.error('Erreur au démarrage du serveur:', err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGenerateData = async () => {
    setIsGenerating(true);
    try {
      const appDataPath = await path.appDataDir();

      if (!appDataPath) throw new Error("Impossible de récupérer AppData");

      const db_url = await path.join(appDataPath, 'mydatabase.db');
      const excel_path_str = await path.join(appDataPath, 'points.xlsx');
      
      console.log(`Chemin de la BDD: ${db_url}`);
      console.log(`Chemin Excel: ${excel_path_str}`);

      await invoke('export_points_excel', {
        dbUrl: db_url, 
        excelPathStr: excel_path_str
      });
      alert("Exportation Excel réussie dans " + excel_path_str);
    } catch (error) {
      console.error("Erreur lors de l'exportation Excel:", error);
      alert(`Erreur d'exportation: ${error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    await invoke("create_pdf");
  };

  const handleMobileConnect = async () => {
    await qr_code();
  };

  const getQrCodeUri = (base64: string | null): string => {
    if (!base64) return '';
    return `data:image/png;base64,${base64}`;
  };

  const connectBtnClass = `w-full px-6 py-4 rounded-lg font-semibold transition-all ${
    isLoading || qrCodeBase64
      ? 'bg-gray-300 cursor-not-allowed'
      : 'bg-blue-500 hover:bg-blue-600 text-white'
  }`;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">Transfert de Données</h1>
      
      <div className="max-w-md mx-auto space-y-4 flex flex-col items-center">
        <button
          onClick={handleGenerateData}
          disabled={isGenerating}
          className={`w-full px-6 py-4 rounded-lg font-semibold transition-all ${
            isGenerating
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isGenerating ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Génération en cours...</span>
            </div>
          ) : (
            "Export Excel"
          )}
        </button>

        <button
          onClick={handleExportPDF}
          className="w-full px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all"
        >
          Exporter en PDF
        </button>

        <button
          className={connectBtnClass}
          onClick={handleMobileConnect}
          disabled={isLoading || !!qrCodeBase64}
        >
          {qrCodeBase64 ? "Serveur Démarré" : "Connecter App Mobile"}
        </button>
      </div>

      {/* Section QR Code */}
      <div className="flex flex-col items-center justify-center w-full min-h-[350px] mt-8">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-5">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-blue-700 text-lg">Démarrage du serveur et génération...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md text-center">
            <h3 className="font-bold mb-1">Erreur Serveur</h3>
            <p>Erreur: {error}</p>
          </div>
        )}
        
        {qrCodeBase64 && !isLoading && (
          <div className="bg-white p-5 rounded-xl shadow-xl flex flex-col items-center">
            <p className="text-xl text-gray-800 mb-4 font-semibold">
              Scannez ce code pour vous connecter.
            </p>
            <QrCode 
              qrCodeUri={getQrCodeUri(qrCodeBase64)} 
            />
            <p className="mt-4 text-sm text-gray-500">
              Serveur WebSocket actif.
            </p>
          </div>
        )}
      </div>

      {/* Message de statut */}
      {message && (
        <div className="mt-6 max-w-md mx-auto">
          <div className={`p-4 rounded-lg ${
            message.includes('✅') 
              ? 'bg-green-100 text-green-800' 
              : message.includes('❌')
              ? 'bg-red-100 text-red-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            <p className="font-medium">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTransfer;