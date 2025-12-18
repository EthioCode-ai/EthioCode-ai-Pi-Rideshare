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

// Wrapper for fetch that handles 403 errors
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('authToken');
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 403 || response.status === 401) {
    console.warn('🔒 Token expired or invalid. Logging out...');
    localStorage.clear();
    window.location.href = '/login';
  }

  return response;
};

export default config;