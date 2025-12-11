import React, { useState, useEffect } from 'react';

interface RideRequestPromptProps {
  status: 'searching' | 'found' | 'hidden';
  onClose?: () => void;
}

const RideRequestPrompt: React.FC<RideRequestPromptProps> = ({ status, onClose }) => {
  const [activeCircle, setActiveCircle] = useState(0);
  const [allGreen, setAllGreen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  // Progressive circle animation (>>>>> direction)
  useEffect(() => {
    if (status === 'searching') {
      setAllGreen(false);
      setIsFlashing(false);
      const interval = setInterval(() => {
        setActiveCircle(prev => (prev + 1) % 7);
      }, 500); // Animate every 500ms
      
      return () => clearInterval(interval);
    } else if (status === 'found') {
      setAllGreen(true);
      // 🎉 FLASHING GREEN LIGHTS for 2 seconds!
      setIsFlashing(true);
      
      // Stop flashing after 2 seconds and auto-close
      setTimeout(() => {
        setIsFlashing(false);
        onClose?.();
      }, 2000);
    }
  }, [status, onClose]);

  if (status === 'hidden') {
    return null;
  }

  const message = status === 'searching' 
    ? 'Finding the best π Driver for you...'
    : 'We found your Driver';

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 1000,
      background: '#1e293b',
      borderRadius: '12px',
      padding: '24px 32px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      minWidth: '320px',
      textAlign: 'center',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      {/* 7 Progressive Circles */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {Array.from({ length: 7 }, (_, index) => {
          const isActive = allGreen || index <= activeCircle;
          return (
            <div
              key={index}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: isActive ? '#10b981' : '#ffffff',
                transition: 'background-color 0.3s ease',
                opacity: isActive ? 1 : 0.3,
                // 🎉 FLASHING animation when found!
                animation: isFlashing && isActive ? 'flashGreen 0.3s ease-in-out infinite alternate' : 'none'
              }}
            />
          );
        })}
      </div>

      {/* Message */}
      <div style={{
        color: '#ffffff',
        fontSize: '16px',
        fontWeight: '500',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        {message}
      </div>

      {/* Add fade-in and flashing animation CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
          }
          
          @keyframes flashGreen {
            from {
              background-color: #10b981;
              opacity: 1;
              transform: scale(1);
            }
            to {
              background-color: #22d3ee;
              opacity: 0.7;
              transform: scale(1.2);
            }
          }
        `
      }} />
    </div>
  );
};

export default RideRequestPrompt;