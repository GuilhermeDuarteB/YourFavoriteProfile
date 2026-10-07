<template>
  <section class="auth-hero">
    <div class="background-glow glow-top"></div>
    <div class="background-glow glow-bottom"></div>

    <div class="hero-container">
      <!-- Brand -->
      <div class="brand">
        <a href="/">
          <img
            src="../assets/ifp-logo.png"
            alt="Your Favorite Profile Logo"
            class="brand-logo"
          />

          <span>YOUR FAVORITE PROFILE</span>
        </a>
      </div>

      <!-- Main content -->
      <div class="hero-main">
        <h1>
          Your <span>movies.</span><br />
          Your <span>games.</span><br />
          Your <span>stories.</span>
        </h1>

        <p class="description">
          Track what you watch and play, share your reviews,<br />
          build your favorites and discover what others love.
        </p>

        <!-- Features -->
        <div class="features">
          <div class="feature">
            <div class="feature-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 3v18M16 3v18M4 8h4M4 16h4M16 8h4M16 16h4" />
              </svg>
            </div>

            <div class="feature-text">
              <strong>Discover</strong>
              <p>Movies, series<br />and games</p>
            </div>
          </div>

          <div class="feature">
            <div class="feature-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.2-.9L12 2.8Z"
                />
              </svg>
            </div>

            <div class="feature-text">
              <strong>Review</strong>
              <p>Rate what<br />you love</p>
            </div>
          </div>

          <div class="feature">
            <div class="feature-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="3" />
                <circle cx="5" cy="10" r="2.5" />
                <circle cx="19" cy="10" r="2.5" />
                <path d="M7 19v-2a5 5 0 0 1 10 0v2" />
                <path
                  d="M1.5 18v-1a4 4 0 0 1 5-3.9M22.5 18v-1a4 4 0 0 0-5-3.9"
                />
              </svg>
            </div>

            <div class="feature-text">
              <strong>Share</strong>
              <p>Build your<br />profile</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Decorative cards -->
    <div class="cards">
      <div class="media-card card-one">
        <div class="planet"></div>
      </div>

      <div class="media-card card-two">
        <div class="horizon"></div>
      </div>

      <div class="media-card card-three">
        <div class="bars">
          <i></i>
          <i></i>
          <i></i>
        </div>
      </div>

      <div class="media-card card-four">
        <div class="ring"></div>
      </div>

      <div class="media-card card-five">
        <div class="triangle"></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.auth-hero {
  position: fixed;
  inset: 0 25% 0 0;

  min-height: 100vh;

  background:
    radial-gradient(
      circle at 55% 105%,
      rgba(20, 86, 253, 0.18),
      transparent 40%
    ),
    radial-gradient(
      circle at 70% 10%,
      rgba(20, 86, 253, 0.08),
      transparent 32%
    ),
    #0b0e13;

  overflow: hidden;
  box-sizing: border-box;
}
.hero-container {
  position: relative;
  z-index: 5;

  width: min(900px, 82%);
  height: 100%;

  margin: 0 auto;
  padding-top: clamp(60px, 9vh, 100px);

  box-sizing: border-box;
}

.brand {
  margin-bottom: clamp(45px, 6vh, 70px);
}

.brand a {
  display: inline-flex;
  align-items: center;
  gap: 14px;

  color: #4380ff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2.4px;

  text-decoration: none;

  transition: opacity 0.2s ease;
}

.brand a:hover {
  opacity: 0.85;
}

.brand-logo {
  width: 38px;
  height: 38px;
  flex-shrink: 0;

  display: block;
  object-fit: cover;

  border-radius: 10px;

  box-shadow:
    0 4px 15px rgba(0, 0, 0, 0.3),
    0 0 18px rgba(20, 86, 253, 0.08);
}

.hero-main {
  width: 100%;
}

h1 {
  margin: 0;

  color: #f4f2ee;

  font-size: clamp(48px, 4vw, 72px);
  font-weight: 800;

  line-height: 1.02;
  letter-spacing: -2.5px;
}

h1 span {
  color: #2872ff;
}

.description {
  margin: 28px 0 40px;

  color: #989daa;

  font-size: clamp(15px, 1.1vw, 18px);
  line-height: 1.6;
}

.features {
  display: grid;

  grid-template-columns: repeat(3, 1fr);

  max-width: 720px;

  gap: 45px;
}

.feature {
  display: flex;
  align-items: center;

  gap: 15px;

  min-width: 0;
}

.feature-icon {
  flex: 0 0 52px;

  width: 52px;
  height: 52px;

  display: grid;
  place-items: center;

  border: 1px solid rgba(255, 255, 255, 0.025);

  border-radius: 13px;

  background: linear-gradient(
    145deg,
    rgba(25, 32, 46, 0.95),
    rgba(17, 23, 34, 0.95)
  );

  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.feature-icon svg {
  width: 26px;
  height: 26px;

  stroke: #2872ff;

  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.feature-text strong {
  display: block;
  margin-bottom: 5px;
  color: #f4f2ee;
  font-size: 14px;
  font-weight: 600;
}

.feature-text p {
  margin: 0;
  color: #858b99;
  font-size: 12px;
  line-height: 1.5;
}
.cards {
  position: absolute;
  z-index: 2;
  left: 3%;
  right: 3%;
  bottom: -215px;
  height: 390px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 14px;
  pointer-events: none;
}

.media-card {
  position: relative;

  flex: 0 0 clamp(145px, 13vw, 190px);

  height: clamp(240px, 24vw, 300px);

  overflow: hidden;

  border-radius: 16px;

  border: 1px solid rgba(40, 114, 255, 0.72);

  background:
    radial-gradient(
      circle at 50% 20%,
      rgba(40, 114, 255, 0.05),
      transparent 45%
    ),
    linear-gradient(145deg, #101620, #080b10);

  box-shadow:
    0 0 25px rgba(20, 86, 253, 0.12),
    0 -3px 18px rgba(20, 86, 253, 0.05);
}

.card-one {
  transform: rotate(-7deg) translateY(35px);
}

.card-two {
  transform: rotate(-3deg) translateY(8px);
}

.card-three {
  transform: translateY(-5px);
}

.card-four {
  transform: rotate(3deg) translateY(8px);
}

.card-five {
  transform: rotate(7deg) translateY(35px);
}

.planet {
  position: absolute;

  width: 105px;
  aspect-ratio: 1;

  top: 55px;
  left: 50%;

  transform: translateX(-50%);

  border-radius: 50%;

  background: linear-gradient(145deg, #2872ff, #10285d 65%, #071126);

  box-shadow: 0 0 35px rgba(40, 114, 255, 0.22);
}

.horizon {
  position: absolute;

  width: 260px;
  height: 260px;

  top: 115px;
  left: 45%;

  transform: translateX(-50%);

  border: 3px solid #2872ff;
  border-radius: 50%;

  box-shadow: 0 0 25px rgba(40, 114, 255, 0.25);
}

.bars {
  position: absolute;

  inset: 65px 30px 0;

  display: flex;

  justify-content: center;
  align-items: flex-end;

  gap: 9px;
}

.bars i {
  display: block;

  width: 22px;

  border-radius: 3px 3px 0 0;

  background: linear-gradient(to top, #0b1324, #2872ff);
}

.bars i:nth-child(1) {
  height: 70px;
}

.bars i:nth-child(2) {
  height: 145px;
}

.bars i:nth-child(3) {
  height: 100px;
}

.ring {
  position: absolute;

  width: 105px;
  height: 105px;

  top: 62px;
  left: 50%;

  transform: translateX(-50%);

  border: 8px solid #2872ff;
  border-left-color: #0b1324;

  border-radius: 50%;

  box-shadow: 0 0 25px rgba(40, 114, 255, 0.17);
}

.triangle {
  position: absolute;

  top: 68px;
  left: 50%;

  transform: translateX(-50%);

  width: 0;
  height: 0;

  border-left: 55px solid transparent;
  border-right: 55px solid transparent;
  border-bottom: 100px solid #2872ff;

  filter: drop-shadow(0 0 18px rgba(40, 114, 255, 0.22));
}

.background-glow {
  position: absolute;

  pointer-events: none;

  border-radius: 50%;

  filter: blur(90px);
}

.glow-top {
  width: 350px;
  height: 350px;

  top: -200px;
  right: 5%;

  background: rgba(20, 86, 253, 0.07);
}

.glow-bottom {
  width: 500px;
  height: 300px;

  bottom: -200px;
  left: 25%;

  background: rgba(20, 86, 253, 0.12);
}

@media (max-width: 1200px) {
  .hero-container {
    width: 86%;
  }

  .features {
    gap: 25px;
  }

  .feature {
    gap: 10px;
  }

  .feature-icon {
    flex-basis: 46px;

    width: 46px;
    height: 46px;
  }
}

@media (max-width: 1024px) {
  .auth-hero {
    right: 40%;
  }

  .hero-container {
    width: 84%;

    padding-top: 55px;
  }

  .brand {
    margin-bottom: 40px;
  }

  h1 {
    font-size: clamp(42px, 5vw, 55px);
  }

  .description br {
    display: none;
  }

  .features {
    grid-template-columns: 1fr;

    gap: 14px;
  }

  .feature-text p br {
    display: none;
  }

  .cards {
    opacity: 0.55;
  }
}

@media (max-width: 768px) {
  .auth-hero {
    display: none;
  }
}
</style>
