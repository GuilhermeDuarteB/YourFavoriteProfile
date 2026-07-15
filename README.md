# YourFavoriteProfile

> 🚧 **Status: In Development** — this project is actively being built. Features, structure, and documentation below are subject to change.

A review platform for movies, TV series, and games, with a personalized user profile. The key feature: for TV series, users review episode by episode, and the overall series rating is automatically calculated as the average of all episode ratings.

## ✨ Planned Features

- User authentication (register/login) with JWT
- Personalized, customizable user profiles
- Search and browse movies, series, and games (via external APIs)
- Review movies and games directly
- Review TV series episode by episode
- Automatic series rating calculated from the average of episode reviews
- Review history per user

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

**External APIs**
- [TMDB (The Movie Database)](https://www.themoviedb.org/) — movies and TV series data
- [RAWG](https://rawg.io/apidocs) — games data (planned for a later phase)

## 📂 Project Structure

```
YourFavoriteProfile/
├── backend/
│   ├── src/
│   │   ├── config/       # Database connection setup
│   │   ├── controllers/  # Request handling logic
│   │   ├── routes/       # API endpoints
│   │   ├── middleware/   # Auth middleware, etc.
│   │   ├── models/       # Database queries
│   │   └── app.js
│   └── server.js
├── frontend/
│   └── (Vue 3 + Vite app)
└── README.md
```

## 🚀 Getting Started

> ⚠️ Setup instructions will be finalized once the project reaches a stable initial version.

### Prerequisites
- Node.js
- PostgreSQL
- A free [TMDB API key](https://www.themoviedb.org/settings/api)

### Backend

```bash
cd backend
npm install
# create a .env file (see .env.example when available)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🗺️ Roadmap

- [ ] Backend authentication (register/login)
- [ ] Database schema (users, media, seasons, episodes, reviews)
- [ ] TMDB integration
- [ ] Movie/series review system
- [ ] Episode-based review system + automatic series rating
- [ ] User profile pages
- [ ] Games support via RAWG API
- [ ] Deployment

## 📄 License

TBD

---

*This project is being developed as part of a personal portfolio.*