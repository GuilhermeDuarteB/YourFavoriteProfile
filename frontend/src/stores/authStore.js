 import {defineStore} from 'pinia';
 import api from '../api/axios';

 export const useAuthStore = defineStore('auth', {
   state: () => ({
     user: JSON.parse(localStorage.getItem('user')) || null,
     token: localStorage.getItem('token') || null,
   }),
   
   getters: {
     isAuthenticated: (state) => !!state.token,
   },

   actions: {
     async register ({username, email, password}) {
        const res = await api.post('/auth/register', {username, email, password});
        this.setSessions(res.data.user, res.data.token);
     },

     async login ({username, email, password}) {
        const res = await api.post('/auth/login', {email, password});
        this.setSessions(res.data.user, res.data.token);
     },

     setSessions(user, token) {
        this.user = user;
        this.token = token;
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('token', token);
     },

     logout() {
        this.user = null;
        this.token = null;
        localStorage.removeItem('user');
        localStorage.removeItem('token');
     },
    },
    });