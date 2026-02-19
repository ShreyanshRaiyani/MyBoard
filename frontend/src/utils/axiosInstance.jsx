import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).trim() : '';

if (!API_URL && import.meta.env.DEV) {
  console.warn('VITE_API_URL is not set or empty — axios will use relative URLs; check .env (no spaces around =).');
}

const axiosInstance = axios.create({
  baseURL: API_URL,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: log detailed info for failed requests in development
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (import.meta.env.DEV) {
      try {
        const { config, response } = error;
        console.groupCollapsed('[axios] Request error:', config && `${config.method.toUpperCase()} ${config.url}`);
        console.log('Request config:', config);
        if (response) {
          console.log('Response status:', response.status);
          console.log('Response data:', response.data);
        } else {
          console.log('No response received (network error or CORS).');
        }
        console.groupEnd();
      } catch (e) {
        console.error('Failed to log axios error details', e);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;