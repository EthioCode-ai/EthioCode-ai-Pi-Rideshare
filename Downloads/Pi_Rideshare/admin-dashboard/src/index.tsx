
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';

// Clean startup - no excessive cache clearing

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
