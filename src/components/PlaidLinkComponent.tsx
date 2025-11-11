
import React, { useCallback, useState } from 'react';

interface PlaidLinkComponentProps {
  onSuccess: (publicToken: string, metadata: any) => void;
  onExit?: (error: any, metadata: any) => void;
  userId: string;
}

declare global {
  interface Window {
    Plaid: any;
  }
}

export default function PlaidLinkComponent({ onSuccess, onExit, userId }: PlaidLinkComponentProps) {
  const [isLoading, setIsLoading] = useState(false);

  const initializePlaid = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Get link token from backend
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || 'demo-rider-token'}`
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      const { link_token } = await response.json();

      // Load Plaid Link if not already loaded
      if (!window.Plaid) {
        const script = document.createElement('script');
        script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
        script.async = true;
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      // Initialize Plaid Link
      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: (public_token: string, metadata: any) => {
          console.log('✅ Plaid Link success:', metadata);
          onSuccess(public_token, metadata);
        },
        onExit: (err: any, metadata: any) => {
          console.log('Plaid Link exit:', err, metadata);
          onExit?.(err, metadata);
        },
        onEvent: (eventName: string, metadata: any) => {
          console.log('Plaid Link event:', eventName, metadata);
        }
      });

      handler.open();
    } catch (error) {
      console.error('❌ Plaid initialization error:', error);
      alert('Failed to initialize bank verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onExit, userId]);

  return (
    <button
      onClick={initializePlaid}
      disabled={isLoading}
      style={{
        width: '100%',
        padding: '16px',
        backgroundColor: isLoading ? '#9ca3af' : '#059669',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}
    >
      {isLoading ? (
        <>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTop: '2px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Connecting to Bank...
        </>
      ) : (
        <>🏦 Connect Bank Account</>
      )}
    </button>
  );
}
