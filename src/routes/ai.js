// api/src/routes/ai.js
const express = require('express');
const router  = express.Router();
const db      = require('../services/database');
const gemini  = require('../services/gemini');

// POST /api/ai/ask — tanya coach
router.post('/ask', async (req, res) => {
    try {
        const { telegram_id, question } = req.body;
        if (!telegram_id || !question) {
            return res.status(400).json({ error: 'telegram_id and question required' });
        }

        const [user, todaySummary] = await Promise.all([
            db.getUser(telegram_id),
            db.getDailySummary(telegram_id)
        ]);

        if (!user) return res.status(404).json({ error: 'User not found' });

        const answer = await gemini.generateCoachAnswer(user, todaySummary, question);
        res.json({ answer });
    } catch (err) {
        const status = err.message === 'RATE_LIMIT' ? 429 : 500;
        res.status(status).json({ error: err.message });
    }
});

module.exports = router;
