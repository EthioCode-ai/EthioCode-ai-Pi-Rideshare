
import React from 'react';

interface TopDownCarProps {
  color?: string;
  type?: 'sedan' | 'suv' | 'compact' | 'luxury';
  size?: number;
  rotation?: number;
  showIndicators?: boolean;
  isDriver?: boolean;
}

const TopDownCar: React.FC<TopDownCarProps> = ({
  color = '#3b82f6',
  type = 'sedan',
  size = 40,
  rotation = 0,
  showIndicators = false,
  isDriver = false
}) => {
  const getCarDimensions = () => {
    switch (type) {
      case 'compact':
        return { width: size * 0.8, height: size * 1.4 };
      case 'suv':
        return { width: size * 1.1, height: size * 1.6 };
      case 'luxury':
        return { width: size * 0.9, height: size * 1.8 };
      default: // sedan
        return { width: size, height: size * 1.5 };
    }
  };

  const { width, height } = getCarDimensions();

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        transform: `rotate(${rotation}deg)`,
        position: 'relative',
        display: 'inline-block'
      }}
    >
      {/* Car Body */}
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: color,
          borderRadius: '15% 15% 15% 15%',
          position: 'relative',
          border: '2px solid rgba(0,0,0,0.2)',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)'
        }}
      >
        {/* Windshield */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '15%',
            width: '70%',
            height: '25%',
            backgroundColor: 'rgba(135, 206, 235, 0.6)',
            borderRadius: '8px',
            border: '1px solid rgba(0,0,0,0.3)'
          }}
        />

        {/* Rear Window */}
        <div
          style={{
            position: 'absolute',
            bottom: '20%',
            left: '15%',
            width: '70%',
            height: '20%',
            backgroundColor: 'rgba(135, 206, 235, 0.6)',
            borderRadius: '6px',
            border: '1px solid rgba(0,0,0,0.3)'
          }}
        />

        {/* Side Windows */}
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '10%',
            width: '80%',
            height: '30%',
            backgroundColor: 'rgba(135, 206, 235, 0.4)',
            borderRadius: '4px'
          }}
        />

        {/* Headlights */}
        <div
          style={{
            position: 'absolute',
            top: '5%',
            left: '20%',
            width: '15%',
            height: '8%',
            backgroundColor: '#fff',
            borderRadius: '50%',
            border: '1px solid #ccc'
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '5%',
            right: '20%',
            width: '15%',
            height: '8%',
            backgroundColor: '#fff',
            borderRadius: '50%',
            border: '1px solid #ccc'
          }}
        />

        {/* Taillights */}
        <div
          style={{
            position: 'absolute',
            bottom: '5%',
            left: '20%',
            width: '15%',
            height: '8%',
            backgroundColor: '#ff4444',
            borderRadius: '50%',
            border: '1px solid #cc0000'
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '5%',
            right: '20%',
            width: '15%',
            height: '8%',
            backgroundColor: '#ff4444',
            borderRadius: '50%',
            border: '1px solid #cc0000'
          }}
        />

        {/* Door Lines */}
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '0',
            width: '100%',
            height: '1px',
            backgroundColor: 'rgba(0,0,0,0.2)'
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '25%',
            left: '0',
            width: '100%',
            height: '1px',
            backgroundColor: 'rgba(0,0,0,0.2)'
          }}
        />

        {/* Turn Indicators (if enabled) */}
        {showIndicators && (
          <>
            <div
              style={{
                position: 'absolute',
                top: '12%',
                left: '8%',
                width: '8%',
                height: '6%',
                backgroundColor: '#ffa500',
                borderRadius: '50%',
                animation: 'blink 1s infinite'
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '12%',
                right: '8%',
                width: '8%',
                height: '6%',
                backgroundColor: '#ffa500',
                borderRadius: '50%',
                animation: 'blink 1s infinite'
              }}
            />
          </>
        )}

        {/* Direction Indicator for Driver */}
        {isDriver && (
          <div
            style={{
              position: 'absolute',
              top: '2%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '0',
              height: '0',
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: '12px solid #10b981',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
            }}
          />
        )}
      </div>

      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
          }
        `}
      </style>
    </div>
  );
};

export default TopDownCar;
