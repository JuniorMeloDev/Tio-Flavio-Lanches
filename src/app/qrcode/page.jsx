'use client';

import { useEffect, useRef, useState } from 'react';
import { QrCode, Printer, ArrowLeft } from 'lucide-react';

export default function QrCodePage() {
  const qrRef = useRef(null);
  const [cardapioUrl, setCardapioUrl] = useState('');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
    script.onload = () => {
      if (qrRef.current) {
        const url = `${window.location.origin}/cardapio`;
        setCardapioUrl(url);
        new window.QRious({
          element: qrRef.current,
          value: url,
          size: 256,
          padding: 20,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-qr, #printable-qr * {
            visibility: visible;
          }
          #printable-qr {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
          }
          .no-print {
            display: none;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md self-center absolute top-8 px-4 no-print">
        </div>

        <div id="printable-qr" className="bg-white rounded-xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
                <QrCode /> Cardápio Digital
            </h1>
            <p className="text-gray-600 mb-6">Aponte a câmera do seu telefone para acessar.</p>
            
            <canvas ref={qrRef} className="mx-auto"></canvas>
            
            <a href={cardapioUrl} target="_blank" rel="noopener noreferrer" className="mt-4 text-xs text-blue-600 hover:underline break-all block">
                {cardapioUrl}
            </a>
        </div>

        <button
            onClick={handlePrint}
            className="no-print mt-8 flex items-center gap-2 bg-[#A16207] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#8f5606] transition-colors"
        >
            <Printer size={20} />
            Imprimir QR Code
        </button>
      </div>
    </>
  );
}

