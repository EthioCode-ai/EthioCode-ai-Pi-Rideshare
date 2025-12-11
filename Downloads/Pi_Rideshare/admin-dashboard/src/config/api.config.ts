// API Configuration for Pi VIP Rideshare Admin Dashboard
// Points to the production backend on Render

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://ethiocode-ai-pi-rideshare.onrender.com';

export const config = {
  apiUrl: API_BASE_URL,
  socketUrl: API_BASE_URL,
};

// Helper function to build API URLs
export const apiUrl = (path: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};

// Helper for socket connection
export const getSocketUrl = (): string => {
  return API_BASE_URL;
};

export default config;