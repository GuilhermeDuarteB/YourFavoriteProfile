import {createRouter, createWebHistory} from 'vue-router'
import {useAuthStore} from '../stores/authStore'

import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ProfileView from '../views/ProfileView.vue'
import SearchView from '../views/SearchView.vue'
import NotFoundView from '../views/NotFoundView.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
  { path: '/register', name: 'register', component: RegisterView, meta: { guestOnly: true } },
  { path: '/:username', name: 'profile', component: ProfileView},
  { path: '/search', name: 'search', component: SearchView },

  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },    
]

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login' });
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return next({ name: 'home' });
  }

  next();
});
export default router;