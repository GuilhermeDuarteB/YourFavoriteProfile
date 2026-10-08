# Your Favorite Profile

Your Favorite Profile is a full-stack media discovery and community application for movies, TV series, and games. Users can discover titles, write reviews, build a public profile, follow other users, manage a watchlist, and curate a personal Top 5.

Movies and games use direct reviews. TV series are reviewed episode by episode through interactive season lists, and their community score is calculated from the averages of rated episodes. Provider scores from TMDB/RAWG remain separate from Your Favorite Profile community scores.

## Screenshots

| Home | Browse |
| --- | --- |
| ![Home](docs/screenshots/home.png) | ![Browse](docs/screenshots/browse.png) |

| Media detail | Public profile |
| --- | --- |
| ![Media detail](docs/screenshots/media-detail.png) | ![Profile](docs/screenshots/profile.png) |

## Current features

- Registration and login with JWT authentication and bcrypt password hashing
- Case-insensitive username identity with preserved display casing and ID-based ownership
- Public profiles with reviews, a publicly displayed Top 5, genre radar, follower counts, and follow/unfollow
- Top 5 management in Settings with ranked movie, series, and game selections
- User search and global navbar search across users and media
- Browse and discover for movies, series, and games with URL-synchronised type, genre, decade, rating, sort, and text filters
- Provider-aware genre filtering: TMDB and RAWG taxonomies are mapped separately, including mixed and All types Browse selections
- Watchlist statuses (want to watch, watching, completed, and dropped), including watchlist-only Browse filtering
- Media detail pages with provider metadata, cast, seasons, platforms, reviews, and watchlist actions
- Review create, update, delete, and positive score validation (`0 < score <= 10`; fractions such as `8.5` are accepted; the star UI uses 1–10)
- Lazy season loading with episode reviews, editing, deletion, and automatic series community scores
- TMDB and RAWG integrations with normalized media cards and partial-provider failure handling
- Interactive OpenAPI API documentation with JWT-authenticated endpoint testing through Swagger UI
- Responsive public UI, API rate limiting, CORS configuration, and startup environment/database checks

## In development and roadmap

- Production deployment and operational monitoring
- Avatar uploads and broader automated UI coverage

## Tech stack

Frontend: Vue 3, Vite, Pinia, Vue Router, and Axios.

Backend: Node.js, Express, PostgreSQL, JWT, bcrypt, express-rate-limit, OpenAPI 3, Swagger UI (`swagger-ui-express`), and a YAML-based API specification.

External APIs: [TMDB](https://www.themoviedb.org/) for movies and series, and [RAWG](https://rawg.io/apidocs) for games.

Testing uses Node's built-in `node:test` runner. GitHub Actions runs both unit/regression suites, the frontend production build, and real migration/concurrency tests with PostgreSQL 18.

## Architecture

```text
Vue frontend
    ↓ Axios REST calls
Express API controllers
    ↓
Services (TMDB / RAWG) + PostgreSQL models
    ↓
Normalized media, user, review, follow, watchlist, and Top 5 data
```

The provider services normalize external responses into a shared media-card and detail shape. PostgreSQL stores users and user-created data while TMDB and RAWG remain the source of external catalogue data.

## Project structure

```text
YourFavoriteProfile/
├── backend/
│   ├── db/migrations/       # Immutable, numbered SQL migrations
│   ├── scripts/             # Migration, verified backup and DB test commands
│   ├── integration/         # Disposable PostgreSQL integration tests
│   ├── docs/
│   │   └── openapi.yaml      # OpenAPI 3 API specification
│   ├── src/
│   │   ├── config/          # Environment and PostgreSQL setup
│   │   ├── controllers/     # HTTP request handlers
│   │   ├── middleware/      # Auth, optional auth, and rate limits
│   │   ├── models/          # Parameterized PostgreSQL queries
│   │   ├── routes/          # REST route definitions
│   │   ├── services/        # TMDB and RAWG clients
│   │   └── utils/           # Shared validation helpers
│   ├── test/                # Backend regression tests
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client
│   │   ├── components/      # Shared UI components
│   │   ├── constants/       # Provider-aware genre definitions
│   │   ├── router/          # Routes and auth guards
│   │   ├── stores/          # Pinia stores
│   │   └── views/           # Application pages
│   └── test/                # Frontend behavior/regression tests
├── docs/screenshots/
├── YFP-Db.sql               # Final schema reference (not migration history)
└── .github/workflows/ci.yml
```

## Local development

Requirements: Node.js 24, Yarn 1.22, PostgreSQL 18 (the tested version), a TMDB API key, and a RAWG API key.

### Database

Schema changes are managed through migrations. For a fresh database, create an empty database:

```bash
createdb -U postgres yfpdb
```

Install backend dependencies and configure `DATABASE_URL` in `backend/.env` to point at it:
```bash
cd backend
yarn install
copy .env.example .env     # PowerShell; use cp on macOS/Linux
yarn db:status
yarn db:migrate
```

Migration commands require **only `DATABASE_URL`**, not JWT or provider keys. `yarn db:status` and `yarn db:migrate --dry-run` are read-only plans. A fresh database runs the historical baseline followed by all later migrations. `YFP-Db.sql` is the final schema reference, verified against migration output by tests; do not run it before migrations.

For an existing database created from the original schema, stop application writers, take and verify a current backup, then run:

```bash
cd backend
yarn db:status
yarn db:backup
yarn db:migrate
yarn db:status
```

`db:backup` requires `pg_dump` and `pg_restore` on PATH (or `PG_BIN` pointing to their directory), and a database role with `CREATEDB` and permission to restore the original owners and privileges. It supports plain local connections and writes a custom-format dump into the ignored `.backups/` directory. It restores into a newly created disposable database and compares row fingerprints, IDs, sequences and their ownership, columns, constraints, indexes, working rating views, migration history, schemas, extensions, owners, and privileges before writing a `.verified.json` report. PostgreSQL reparses CHECK/view definitions in temporary objects in the disposable database, so equivalent dump/restore cast representations compare correctly while changed expressions still fail. The dump and expected rows use the same exported database snapshot. It never restores over the source database. Keep backups private and retain a copy outside this checkout; deployment-specific TLS/backup tooling should be used for remote databases.

Existing databases are adopted only if all eight application tables, both rating views, columns/types/defaults, constraints, and indexes match `backend/db/baseline-signature.json`. This PostgreSQL 18 catalog signature represents `001_baseline.sql`; the equivalent media-view array-cast rendering produced by `pg_dump`/restore is also accepted. The runner records that baseline without replaying table creation. Unexpected or altered schemas stop with an error; they are never silently stamped. Final-schema SQL imports without migration history are deliberately not adopted as historical baselines.

The runner checks all pending integrity rules before changing an existing database, locks application tables during migration, and uses a transaction-scoped advisory lock to exclude another runner. All pending SQL and `schema_migrations` history entries commit together or roll back together. Applied files are immutable: SHA-256 checksums (with CRLF/LF normalized), filenames, and ordering are checked on every run. Add a new numbered migration for future changes; do not edit or delete applied files. There is no automatic down/reset command.

Core protection includes typed media identity, valid media/watchlist domains, one review per user/target, normalized email uniqueness, case-insensitive username uniqueness, and positive review scores. Existing raw email/username uniqueness, foreign keys, review target XOR, lookup indexes, IDs, and data are retained.

Migration `007_case_insensitive_usernames.sql` adds `users_username_lower_unique` on `LOWER(username)` without rewriting stored names. Preflight stops on case-insensitive collisions; it never renames or merges accounts. Resolve any collisions through an explicit account-ownership decision, then take a new verified backup and run migrations before starting this application version. Until the migration succeeds, ambiguous username lookups fail instead of selecting an arbitrary account.

For example, `/Guilherme`, `/guilherme`, and `/GUILHERME` resolve to the same user, while the UI displays the stored `Guilherme`. Registration and username changes return 409 when another account owns that name ignoring case; changing only your own casing is allowed. Profiles, follow targets, Top Five, and review history share the same lookup. Profile/watchlist ownership and protected writes use user IDs. New links use canonical names from API/session data, without case-only redirects. A full rename preserves relationships but does not create aliases for the old name.

### Backend

After migrations, configure the remaining application environment variables and start the API from `backend/`:

```bash
yarn dev
```

Run migrations before starting this version of the application: its media UPSERT requires the three-column unique constraint, and username identity requires migration 007.

The API listens on `http://localhost:3000` by default. `yarn start` runs the production server entry point.

Swagger UI is available at `http://localhost:3000/api-docs`.

### Frontend

```bash
cd frontend
yarn install
copy .env.example .env     # PowerShell; use cp on macOS/Linux
yarn dev
```

The Vite development server listens on `http://localhost:5173` by default.

## API Documentation

The backend includes interactive OpenAPI documentation through Swagger UI:

`http://localhost:3000/api-docs`

The documentation lets developers inspect API endpoints, request parameters and bodies, response schemas, and test public endpoints directly. Use Swagger UI's **Authorize** button to provide a JWT Bearer token and test protected endpoints. Protected endpoints use Bearer JWT authentication; endpoints with optional authentication remain usable anonymously.

## Environment variables

Backend (`backend/.env`):

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection URL |
| `JWT_SECRET` | Yes | Secret used to sign session tokens |
| `TMDB_API_KEY` | Yes | TMDB API key |
| `RAWG_API_KEY` | Yes | RAWG API key |
| `PORT` | No | HTTP port, default `3000` |
| `FRONTEND_URL` | No | Allowed frontend origin, default `http://localhost:5173` |

Frontend (`frontend/.env`):

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | No | API base URL, default `http://localhost:3000/api` |

The committed `.env.example` files contain variable names and safe local defaults only. Never put provider secrets in frontend environment files.

## Testing and builds

Run each suite from its package directory:

```bash
cd backend
yarn test
yarn test:watch

cd ../frontend
yarn test
yarn test:watch
yarn build
```

The production frontend output is written to `frontend/dist/`. CI runs dependency installation, both test suites, and this build on every push and pull request.

Run PostgreSQL integration tests from `backend/`:

```bash
yarn test:db --local
```

`--local` explicitly uses `DATABASE_URL` as the administrative connection. Alternatively, set `TEST_DATABASE_URL` and run `yarn test:db`. The role must have `CREATEDB`. Tests create randomly named `yfp_migration_test_*` databases, exercise both empty and populated-baseline adoption flows, and drop only databases created by that test run. They never insert test rows into the administrative database. Missing configuration fails instead of silently skipping. CI supplies an isolated PostgreSQL service; no TMDB/RAWG calls or production secrets are needed.

## API areas

The REST API is grouped under `/api`:

- `/api/auth` — registration, login, and account changes
- `/api/users` — public profiles and user search
- `/api/media` — trending, latest episodes, discover/search, and details
- `/api/reviews` — media and episode review operations
- `/api/follow` — follow and unfollow
- `/api/watchlist` — authenticated watchlist operations
- `/api/top-five` — personal Top 5 operations

## Reliability and security

Passwords are hashed with bcrypt, protected routes use JWT middleware, PostgreSQL queries are parameterized, and auth/media routes are rate limited. CORS is restricted through `FRONTEND_URL`. External API calls have bounded timeouts and independent provider failures produce partial results where possible.

## Known limitations

- External provider search and the authenticated watchlist-only Browse view are bounded by provider pagination; Browse communicates when it has scanned a limited result window.
- Legacy direct series reviews are retained; new series reviews must target an episode. Season 0 specials are not included in the episode review flow.
- Database migrations take table locks and should run during a maintenance window. Baseline adoption intentionally rejects customized schemas; inspect differences before planning a separate migration.
- Scores retain PostgreSQL `NUMERIC(3,1)` precision; the API accepts positive numeric fractions, with stored values rounded to one decimal place.
- The current frontend stores the JWT in browser local storage, so deployments should use an appropriate HTTPS origin and browser security policy.
- No license is declared for this repository yet.

## Author

Your Favorite Profile is a portfolio project built to explore full-stack media data, community features, and provider-aware normalization.
