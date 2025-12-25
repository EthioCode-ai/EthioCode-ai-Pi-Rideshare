const API_BASE_URL = 'https://ethiocode-ai-pi-rideshare.onrender.com';

export const config = {
  apiUrl: API_BASE_URL,
  socketUrl: API_BASE_URL,
};

export const apiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};

export const getSocketUrl = (): string => {
  return API_BASE_URL;
};

export default config;