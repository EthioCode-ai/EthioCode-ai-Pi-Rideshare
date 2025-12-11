import React, { useState } from 'react';
import { Check, X, AlertTriangle, Building2, Calendar, User } from 'lucide-react';

interface DriverVerificationModalProps {
  isOpen: boolean;
  riderInfo: {
    name: string;
    companyName: string;
    expiryDate: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

const DriverVerificationModal: React.FC<DriverVerificationModalProps> = ({
  isOpen,
  riderInfo,
  onConfirm,
  onCancel
}) => {
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsVerifying(true);
    try {
      await onConfirm();
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '30px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        textAlign: 'center',
        animation: 'slideIn 0.3s ease-out'
      }}>
        {/* Alert Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FEF3C7 0%, #FCD34D 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          border: '3px solid #F59E0B'
        }}>
          <AlertTriangle size={40} color="#D97706" />
        </div>

        {/* Header */}
        <h2 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#1F2937',
          marginBottom: '10px'
        }}>
          Corporate Discount Expired
        </h2>
        
        <p style={{
          color: '#6B7280',
          fontSize: '16px',
          marginBottom: '25px',
          lineHeight: '1.5'
        }}>
          Please verify that the rider still has their work ID badge
        </p>

        {/* Rider Info Card */}
        <div style={{
          background: '#F9FAFB',
          border: '2px solid #E5E7EB',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '25px',
          textAlign: 'left'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <User size={18} color="#6B7280" />
            <span style={{ fontWeight: 'bold', color: '#374151' }}>
              {riderInfo.name}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <Building2 size={18} color="#6B7280" />
            <span style={{ color: '#6B7280' }}>
              {riderInfo.companyName}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Calendar size={18} color="#EF4444" />
            <span style={{ color: '#EF4444', fontWeight: '600' }}>
              Expired: {riderInfo.expiryDate}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          background: '#EBF8FF',
          border: '1px solid #BFDBFE',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '25px',
          textAlign: 'left'
        }}>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#1E40AF',
            fontWeight: '600'
          }}>
            📋 Verification Steps:
          </p>
          <ol style={{
            margin: '8px 0 0 0',
            paddingLeft: '20px',
            fontSize: '13px',
            color: '#3730A3',
            lineHeight: '1.4'
          }}>
            <li>Ask rider to show their work ID badge</li>
            <li>Verify their name and company match</li>
            <li>Confirm badge appears current and valid</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center'
        }}>
          <button
            onClick={onCancel}
            disabled={isVerifying}
            style={{
              flex: 1,
              padding: '14px 20px',
              background: '#F3F4F6',
              color: '#6B7280',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isVerifying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: isVerifying ? 0.5 : 1
            }}
          >
            <X size={18} />
            Invalid ID
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={isVerifying}
            style={{
              flex: 1,
              padding: '14px 20px',
              background: isVerifying ? '#10B981' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isVerifying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: isVerifying ? 0.8 : 1
            }}
          >
            {isVerifying ? (
              <>
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid #ffffff40',
                  borderTop: '2px solid #ffffff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Verifying...
              </>
            ) : (
              <>
                <Check size={18} />
                Valid ID ✓
              </>
            )}
          </button>
        </div>

        {/* Footer Note */}
        <p style={{
          fontSize: '12px',
          color: '#9CA3AF',
          marginTop: '20px',
          margin: '20px 0 0 0'
        }}>
          Confirming will extend their discount for another 90 days
        </p>
      </div>

      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default DriverVerificationModal;