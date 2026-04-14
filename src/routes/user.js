// api/src/routes/user.js
const express = require('express');
const router  = express.Router();
const db      = require('../services/database');

// GET /api/user/:telegramId — ambil profil user
router.get('/:telegramId', async (req, res) => {
    try {
        const user = await db.getUser(parseInt(req.params.telegramId));
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/user/:telegramId/summary — daily summary + food list
router.get('/:telegramId/summary', async (req, res) => {
    try {
        const tgId = parseInt(req.params.telegramId);
        const [summary, foodList] = await Promise.all([
            db.getDailySummary(tgId),
            db.getTodayFoodList(tgId)
        ]);
        res.json({ summary, foodList });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/user/:telegramId/weekly — weekly logs
router.get('/:telegramId/weekly', async (req, res) => {
    try {
        const logs = await db.getWeeklyLogs(parseInt(req.params.telegramId));
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/user/:telegramId/streak
router.get('/:telegramId/streak', async (req, res) => {
    try {
        const streak = await db.getStreak(parseInt(req.params.telegramId));
        res.json({ streak });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;