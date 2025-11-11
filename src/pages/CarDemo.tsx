
import React from 'react';
import TopDownCar from '../components/TopDownCar';

const CarDemo: React.FC = () => {
  const carColors = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Yellow
    '#6b7280', // Gray
    '#8b5cf6', // Purple
    '#000000', // Black
    '#ffffff'  // White
  ];

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '20px', color: '#1e293b' }}>
        Top-Down Car Designs
      </h1>

      {/* Different Car Types */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
          Vehicle Types
        </h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <TopDownCar type="compact" color="#3b82f6" size={40} />
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>Compact</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <TopDownCar type="sedan" color="#10b981" size={40} />
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>Sedan</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <TopDownCar type="suv" color="#f59e0b" size={40} />
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>SUV</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <TopDownCar type="luxury" color="#000000" size={40} />
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>Luxury</div>
          </div>
        </div>
      </div>

      {/* Different Colors */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
          Color Variations
        </h2>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          {carColors.map((color, index) => (
            <TopDownCar key={index} color={color} size={35} />
          ))}
        </div>
      </div>

      {/* Different Rotations */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
          Directional Orientations
        </h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((rotation) => (
            <div key={rotation} style={{ textAlign: 'center' }}>
              <TopDownCar rotation={rotation} color="#6366f1" size={35} />
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>{rotation}°</div>
            </div>
          ))}
        </div>
      </div>

      {/* With Turn Indicators */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
          With Turn Signals
        </h2>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <TopDownCar color="#ef4444" size={50} showIndicators={true} />
          <TopDownCar color="#10b981" size={50} rotation={90} showIndicators={true} />
        </div>
      </div>

      {/* Different Sizes */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
          Size Variations
        </h2>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'end' }}>
          <TopDownCar color="#8b5cf6" size={20} />
          <TopDownCar color="#8b5cf6" size={30} />
          <TopDownCar color="#8b5cf6" size={40} />
          <TopDownCar color="#8b5cf6" size={50} />
          <TopDownCar color="#8b5cf6" size={60} />
        </div>
      </div>
    </div>
  );
};

export default CarDemo;
