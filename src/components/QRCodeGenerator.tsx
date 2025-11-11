
import React, { useEffect, useState } from 'react';

interface QRCodeGeneratorProps {
  url: string;
  size?: number;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ url, size = 200 }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    // Using QR Server API to generate QR code
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
    setQrCodeUrl(qrUrl);
  }, [url, size]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(url);
    alert('URL copied to clipboard!');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      backgroundColor: '#f8fafc',
      borderRadius: '12px',
      border: '2px solid #e2e8f0',
      maxWidth: '300px',
      margin: '0 auto'
    }}>
      {qrCodeUrl && (
        <img
          src={qrCodeUrl}
          alt="QR Code for Rider App"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            border: '4px solid white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        />
      )}
      
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        width: '100%'
      }}>
        <p style={{
          fontSize: '12px',
          color: '#64748b',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          Scan to access Rider App:
        </p>
        <p style={{
          fontSize: '14px',
          fontWeight: '500',
          color: '#334155',
          textAlign: 'center',
          wordBreak: 'break-all'
        }}>
          {url}
        </p>
        <button
          onClick={copyToClipboard}
          style={{
            width: '100%',
            marginTop: '8px',
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          📋 Copy URL
        </button>
      </div>
      
      <div style={{
        marginTop: '12px',
        padding: '8px 12px',
        backgroundColor: '#dbeafe',
        borderRadius: '6px',
        border: '1px solid #93c5fd'
      }}>
        <p style={{
          fontSize: '11px',
          color: '#1e40af',
          textAlign: 'center',
          margin: 0
        }}>
          💡 Open this URL on mobile for the best experience
        </p>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
