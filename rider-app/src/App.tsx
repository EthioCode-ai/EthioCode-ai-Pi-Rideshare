import React, { useEffect } from 'react';
import RiderApp from './pages/RiderApp';
import { initializePlugins } from './plugins';
import './App.css';

function App() {
  useEffect(() => {
    // Initialize Capacitor plugins on app start
    initializePlugins().catch(error => {
      console.error('❌ Plugin initialization error:', error);
    });
  }, []);

  return <RiderApp />;
}

export default App;
