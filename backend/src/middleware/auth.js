import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({code: 'AUTH_REQUIRED', message: 'Authorization header missing or malformed'});
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!Number.isSafeInteger(decoded.userId) || decoded.userId <= 0) {
            return res.status(401).json({code: 'INVALID_TOKEN', message: 'Invalid or expired token'});
        }
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({code: 'INVALID_TOKEN', message: 'Invalid or expired token'});
    }
}
