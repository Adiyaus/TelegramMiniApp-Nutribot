// api/src/index.js — Express API server untuk Mini App
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const userRouter = require('./routes/user');
const foodRouter = require('./routes/foodLogs');
const menuRouter = require('./routes/savedMenus');
const aiRouter   = require('./routes/ai');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || '*', // Vercel URL setelah deploy
        'http://localhost:5173'          // Vite dev server
    ],
    credentials: true
}));

app.use(express.json({ limit: '20mb' }));    // handle base64 images
app.use(express.urlencoded({ extended: true }));

// ── Routes ─────────────────────────────────────────────────
app.use('/api/user',       userRouter);
app.use('/api/food-logs',  foodRouter);
app.use('/api/menus',      menuRouter);
app.use('/api/ai',         aiRouter);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 NutriBot Mini App API running on port ${PORT}`);
    console.log(`📊 Database: Supabase`);
    console.log(`🤖 AI: Gemini\n`);
});
