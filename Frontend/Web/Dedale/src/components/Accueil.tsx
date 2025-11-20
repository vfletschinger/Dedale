import React, { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as path from '@tauri-apps/api/path'; 
import QrCode from './QrCode'; 



async function generate_excel() {
    try {
        const appDataPath = await path.appDataDir();

        if (!appDataPath) throw new Error("Impossible de récupérer AppData");

        const db_url = await path.join(appDataPath, 'mydatabase.db');
        const excel_path_str = await path.join(appDataPath, 'points.xlsx');
        
        console.log(`Chemin de la BDD: ${db_url}`);
        console.log(`Chemin Excel: ${excel_path_str}`);

        await invoke(
            'export_points_excel', {
                dbUrl: db_url, 
                excelPathStr: excel_path_str
            }
        );
        alert("Exportation Excel réussie dans " + excel_path_str);

  
    } catch (error) {
        console.error("Erreur lors de l'exportation Excel:", error);
        alert(`Erreur d'exportation: ${error}`);
    }
}


function Accueil() {
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

    const getQrCodeUri = (base64: string | null): string => {
        if (!base64) return '';
        return `data:image/png;base64,${base64}`;
    }
    
    const baseBtn = "px-4 py-2 font-medium rounded-lg transition duration-200 shadow-md flex-1 mx-2";
    const exportBtnClass = `${baseBtn} bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400`;
    const connectBtnClass = qrCodeBase64 
        ? `${baseBtn} bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400`
        : `${baseBtn} bg-gray-700 text-white hover:bg-gray-800 disabled:bg-gray-400`;

    return (
        <div className="flex flex-col items-center p-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-extrabold text-[#2c3e50] mb-2">
                Accueil Dedale
            </h1>
            <p className="text-lg text-gray-600 mb-8 text-center">
                Gérez les données et connectez l'appareil mobile.
            </p>

            <div className="flex flex-row justify-center w-full max-w-lg space-x-4 mb-10">
                <button
                    className={exportBtnClass}
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
                <button
                    className={connectBtnClass}
                    onClick={qr_code}
                    disabled={isLoading}
                >
                    {qrCodeBase64 ? "Serveur Démarré" : "Connecter App Mobile"}
                </button>
            </div>

            <div className="flex flex-col items-center justify-center w-full min-h-[350px]">
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
        </div>
    );
async function createPdf() {
  await invoke("create_pdf");
}
}

export default Accueil;