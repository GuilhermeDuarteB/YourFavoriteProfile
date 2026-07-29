import {pools} from '../config/db.js';

export async function findOrCreateMedia({
    externalId, source, type, title, posterUrl, releaseDate
}){
    const existing = await pools.query(
        'SELECT * FROM media WHERE external_id = $1 AND source = $2',
        [externalId, source]
    );

    if (existing.rows[0]){
        return (await existing).rows[0];
    }

    const result = await pools.query(
        `INSERT INTO media (external_id, source, type, title, poster_url, release_date) 
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *`,
        [externalId, source, type, title, posterUrl, releaseDate]
    );

    return result.rows[0];
}