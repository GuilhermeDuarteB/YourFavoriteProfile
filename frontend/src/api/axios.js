import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

api.interceptors.request.use((config) => {
    const authStore = useAuthStore();
    if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    return config;
});


// Credential failures in Settings must not destroy a valid session.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && error.response.data?.code === 'INVALID_TOKEN') {
            const authStore = useAuthStore();
            // A delayed response for an older token must not log out a new session.
            if (error.config?.headers?.Authorization === `Bearer ${authStore.token}`) {
                authStore.logout();
            }
        }
        return Promise.reject(error);
    }
);

export default api;
