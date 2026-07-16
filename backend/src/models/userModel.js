import {pools} from '../config/db.js';


//create user func
export async function createUser({username, email, passwordHash}){
    const result = await pools.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
        [username, email, passwordHash]
    );
    return result.rows[0];
}

//find user email func

export async function findUserByEmail(email){
    const result = await pools.query('SELECT * from users WHERE email = $1', [email]);
    return result.rows[0];
}

//find user ID func
export async function findUserById(id){
    const result = await pools.query('SELECT id, username, bio, email, avatar_url, created_at from users WHERE id = $1', [id]);
    return result.rows[0];
}