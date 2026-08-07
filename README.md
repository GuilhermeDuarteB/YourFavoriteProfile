# YourFavoriteProfile

> 🚧 **Status: In Development** — core features are live and working; more are being added regularly.

A full-stack review platform for movies, TV series, and games, with public, searchable user profiles. The key feature: for TV series, users review episode by episode, and the overall series rating is calculated automatically as the average of every episode reviewed — instead of guessing what an entire show "deserves" after finishing it.

## 📸 Screenshots

<!-- Replace with real screenshots once uploaded to docs/screenshots/ -->
| Home | Browse |
|---|---|
| ![Home page with trending posters](docs/screenshots/home.png) | ![Browse page with filters and results](docs/screenshots/browse.png) |

| Media Detail & Review | Profile |
|---|---|
| ![Media detail page with review modal open](docs/screenshots/media-detail.png) | ![User profile with stats and recent reviews](docs/screenshots/profile.png) |

## ✨ Features

**Live**
- JWT authentication (register/login) with bcrypt password hashing
- Public, searchable user profiles (`/username`) with stats, bio, and recent reviews
- Browse and discover movies, series, and games with filters (type, genre, minimum rating, sort), live debounced search, and pagination — all synced to the URL
- Real-time data from the TMDB and RAWG APIs, with graceful degradation if one provider goes down
- Media detail pages (synopsis, cast, seasons, platforms) that auto-import into the local database on first view
- Full review system: star ratings (0–5, stored as 0–10), optional comments, one review per user per title, edit/delete your own reviews
- Rate limiting on auth and media routes, plus basic failed-login logging

**Planned**
- Episode-by-episode reviews with automatic series rating calculation
- Watchlist (want to watch / watching / completed / dropped)
- Personal top 5
- Follow other users
- Account settings (change email, delete account)
- Avatar upload

## 🛠️ Tech Stack

**Frontend**
- Vue 3 (Composition API, `<script setup>`)
- Vite
- Pinia (state management)
- Vue Router
- Axios

**Backend**
- Node.js
- Express
- PostgreSQL
- JWT (authentication)
- bcrypt (password hashing)
- express-rate-limit

**External APIs**
- [TMDB (The Movie Database)](https://www.themoviedb.org/) — movies and TV series data
- [RAWG](https://rawg.io/apidocs) — games data

## 📂 Project Structure

```
YourFavoriteProfile/
├── backend/
│   ├── src/
│   │   ├── config/       # Database connection setup
│   │   ├── controllers/  # Request handling logic
│   │   ├── middleware/   # Auth, rate limiting
│   │   ├── models/       # Database queries
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # TMDB / RAWG API clients
│   │   └── app.js
│   ├── db/
│   │   └── schema.sql    # Full database schema
│   └── server.js
├── frontend/
│   └── src/
│       ├── api/          # Axios instance
│       ├── components/   # Reusable UI (MediaCard, Modal, StarRating, etc.)
│       ├── router/
│       ├── stores/        # Pinia stores
│       └── views/         # Pages
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js
- PostgreSQL
- A free [TMDB API key](https://www.themoviedb.org/settings/api)
- A free [RAWG API key](https://rawg.io/apidocs)

### Database

```bash
createdb review_app
psql -U postgres -d review_app -f backend/db/schema.sql
```

### Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/review_app
JWT_SECRET=your_random_secret_here
TMDB_API_KEY=your_tmdb_key
RAWG_API_KEY=your_rawg_key
```

```bash
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:5173` (frontend) and `http://localhost:3000` (backend API).

## 🗺️ Roadmap

- [x] Backend authentication (register/login)
- [x] Database schema (users, media, seasons, episodes, reviews, watchlist, top_five)
- [x] TMDB + RAWG integration
- [x] Browse/discover with filters, search, and pagination
- [x] Media detail pages
- [x] Movie/series/game review system
- [x] User profile pages with stats
- [x] Rate limiting & basic security hardening
- [ ] Episode-based review system + automatic series rating
- [ ] Watchlist
- [ ] Personal top 5
- [ ] Follow system
- [ ] Account settings
- [ ] Deployment

## 📄 License

TBD

---

*This project is being developed as part of a personal portfolio.*
