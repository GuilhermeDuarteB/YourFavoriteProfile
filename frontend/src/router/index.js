import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/authStore";

import HomeView from "../views/HomeView.vue";
import LoginView from "../views/LoginView.vue";
import RegisterView from "../views/RegisterView.vue";
import ProfileView from "../views/ProfileView.vue";
import SearchView from "../views/SearchView.vue";
import NotFoundView from "../views/NotFoundView.vue";
import Browse from "../views/BrowseView.vue";
import MediaDetailsView from "../views/MediaDetailsView.vue";

const routes = [
  { path: "/", name: "home", component: HomeView },
  {
    path: "/login",
    name: "login",
    component: LoginView,
    meta: { guestOnly: true },
  },
  {
    path: "/register",
    name: "register",
    component: RegisterView,
    meta: { guestOnly: true },
  },
  { path: "/search", name: "search", component: SearchView },
  { path: "/browse", name: "browse", component: Browse },
  { path: "/movies", redirect: { path: "/browse", query: { types: "movie" } } },
  {
    path: "/series",
    redirect: { path: "/browse", query: { types: "series" } },
  },
  { path: "/games", redirect: { path: "/browse", query: { types: "game" } } },

  { path: "/movie/:id", name: "movie-detail", component: MediaDetailsView },
  { path: "/series/:id", name: "series-detail", component: MediaDetailsView },
  { path: "/game/:id", name: "game-detail", component: MediaDetailsView },

  { path: "/:username", name: "profile", component: ProfileView },

  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: "login" };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: "home" };
  }
});

export default router;
