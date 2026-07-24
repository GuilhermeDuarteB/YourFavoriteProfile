<script setup>
const year = new Date().getFullYear();
</script>

<template>
  <footer>
    <div class="footer-top">
      <router-link to="/" class="brand">
        <div class="brand-mark">
          <img src="../assets/ifp-logo.png" alt="Your Favorite Profile logo" />
        </div>
        Your Favorite Profile
      </router-link>
      <p class="tagline">
        Rate every episode. Get the real series score.
      </p>
    </div>

    <div class="footer-columns">
      <div class="footer-col">
        <h4>Explore</h4>
        <router-link to="/movies">Movies</router-link>
        <router-link to="/series">Series</router-link>
        <router-link to="/games">Games</router-link>
      </div>

      <div class="footer-col">
        <h4>Account</h4>
        <router-link to="/register">Register</router-link>
        <router-link to="/login">Log in</router-link>
        <router-link to="/watchlist">Watchlist</router-link>
      </div>

      <div class="footer-col">
        <h4>Project</h4>
        <a href="https://github.com/GuilhermeDuarteB/YourFavoriteProfile" target="_blank" rel="noopener">
          GitHub Repo
        </a>
        <a href="https://guilhermebranco.dev" target="_blank" rel="noopener">
          Developer Portfolio
        </a>
      </div>
    </div>

    <div class="footer-bottom">
      <span>&copy; {{ year }} Your Favorite Profile. All rights reserved.</span>
      <span class="footer-note">Personal portfolio project — powered by TMDB &amp; RAWG</span>
    </div>
  </footer>
</template>

<style scoped>
footer {
  border-top: 1px solid var(--border);
  padding: 48px 56px 28px;
  background: var(--bg);
}

.footer-top {
  margin-bottom: 32px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 18px;
  color: var(--text);
  width: fit-content;
}

.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.brand-mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.tagline {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--text-mute);
}

.footer-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  padding-bottom: 32px;
  border-bottom: 1px solid var(--border);
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer-col h4 {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text);
  margin: 0 0 4px;
}

.footer-col a {
  font-size: 13px;
  color: var(--text-dim);
  width: fit-content;
}

.footer-col a:hover {
  color: var(--blue);
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20px;
  font-size: 12px;
  color: var(--text-mute);
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 768px) {
  footer {
    padding: 36px 24px 24px;
  }
  .footer-columns {
    grid-template-columns: 1fr 1fr;
  }
  .footer-bottom {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 480px) {
  .footer-columns {
    grid-template-columns: 1fr;
  }
}
</style>