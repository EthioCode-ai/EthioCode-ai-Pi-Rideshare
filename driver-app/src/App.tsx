import React, { useEffect } from 'react';
import DriverApp from './pages/DriverApp';
import { initializePlugins } from './plugins';
import './App.css';

function App() {
  useEffect(() => {
    // Initialize Capacitor plugins on app start
    initializePlugins().catch(error => {
      console.error('❌ Plugin initialization error:', error);
    });
  }, []);

  return <DriverApp />;
}

export default App;
