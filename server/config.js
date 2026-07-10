const secret = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-change-me' : '');
if (!secret) throw new Error('JWT_SECRET is required');
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174').split(',').map(s=>s.trim()).filter(Boolean);
module.exports={secret,allowedOrigins};
