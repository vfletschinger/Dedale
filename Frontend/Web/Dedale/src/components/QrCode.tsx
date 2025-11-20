import React from 'react';

interface Props {
  qrCodeUri: string; 
}

const QRCodeDisplay: React.FC<Props> = ({ qrCodeUri }) => {

  if (!qrCodeUri) {
    return (
      <div className="text-gray-500 my-5 text-center p-4">
        En attente du démarrage du serveur...
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center p-1">
        <img 
          src={qrCodeUri}
          alt="QR Code de Connexion"
          className="w-64 h-64 object-contain" 
        />
    </div>
  );
};

export default QRCodeDisplay;