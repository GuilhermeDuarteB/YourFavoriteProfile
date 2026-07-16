-- =========================================
-- YourFavoriteProfile - Database Schema
-- =========================================

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media (movies and series from TMDB and games from RAWG)
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(50) NOT NULL,      -- TMDB/RAWG ID
    source VARCHAR(20) NOT NULL,           -- 'tmdb' or 'rawg'
    type VARCHAR(20) NOT NULL,             -- 'movie', 'series', 'game'
    title VARCHAR(255) NOT NULL,
    poster_url VARCHAR(500),
    release_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(external_id, source)
);

-- Seasons (only series table)
CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    title VARCHAR(255),
    UNIQUE(media_id, season_number)
);

-- Episodes
CREATE TABLE episodes (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL,
    title VARCHAR(255),
    air_date DATE,
    UNIQUE(season_id, episode_number)
);

--Reviews of movies, games or episodes
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id INTEGER REFERENCES media(id) ON DELETE CASCADE,        -- movies/games
    episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,   -- episodes
    score NUMERIC(3,1) NOT NULL CHECK (score >= 0 AND score <= 10),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (media_id IS NOT NULL AND episode_id IS NULL) OR
        (media_id IS NULL AND episode_id IS NOT NULL)
    )
);

-- Watchlist / Wishlist
CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'want_to_watch',
        -- 'want_to_watch', 'watching', 'completed', 'dropped'
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, media_id)
);

-- Top 5 user media
CREATE TABLE top_five (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    rank SMALLINT NOT NULL CHECK (rank BETWEEN 1 AND 5),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, rank),   
    UNIQUE(user_id, media_id)
);

-- =========================================
-- View: calc series note with the episodes note
-- =========================================
CREATE VIEW vw_series_rating AS
SELECT m.id AS media_id, m.title, AVG(ep_avg.avg_score) AS series_score
FROM media m
JOIN seasons se ON se.media_id = m.id
JOIN episodes ep ON ep.season_id = se.id
JOIN (
    SELECT episode_id, AVG(score) AS avg_score
    FROM reviews
    WHERE episode_id IS NOT NULL
    GROUP BY episode_id
) ep_avg ON ep_avg.episode_id = ep.id
WHERE m.type = 'series'
GROUP BY m.id, m.title;

-- =========================================
-- View: movie/game note
-- =========================================
CREATE VIEW vw_media_rating AS
SELECT m.id AS media_id, m.title, AVG(r.score) AS avg_score
FROM media m
JOIN reviews r ON r.media_id = m.id
WHERE m.type IN ('movie', 'game')
GROUP BY m.id, m.title;

-- =========================================
-- Frenquent queries
-- =========================================
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_media ON reviews(media_id);
CREATE INDEX idx_reviews_episode ON reviews(episode_id);
CREATE INDEX idx_watchlist_user ON watchlist(user_id);
CREATE INDEX idx_episodes_season ON episodes(season_id);
CREATE INDEX idx_seasons_media ON seasons(media_id);
CREATE INDEX idx_top_five_user ON top_five(user_id);