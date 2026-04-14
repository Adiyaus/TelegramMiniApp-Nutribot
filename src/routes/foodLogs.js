// api/src/routes/foodLogs.js
const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const db      = require('../services/database');
const gemini  = require('../services/gemini');

// Multer: simpan file di memory (bukan disk) buat langsung kirim ke Gemini
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 10 * 1024 * 1024 } // max 10MB
});

// POST /api/food-logs/analyze-image — analisis foto makanan
router.post('/analyze-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

        const result = await gemini.analyzeFoodImage(
            req.file.buffer,
            req.file.mimetype
        );
        res.json(result);
    } catch (err) {
        const status = err.message === 'RATE_LIMIT' ? 429 : 500;
        res.status(status).json({ error: err.message });
    }
});

// POST /api/food-logs/estimate-text — estimasi nutrisi dari teks
router.post('/estimate-text', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'text is required' });

        const result = await gemini.estimateNutritionFromText(text);
        res.json(result);
    } catch (err) {
        const status = err.message === 'RATE_LIMIT' ? 429 : 500;
        res.status(status).json({ error: err.message });
    }
});

// POST /api/food-logs — log makanan baru
router.post('/', async (req, res) => {
    try {
        const { telegram_id, food_description, calories, protein_g, carbs_g, fat_g, gemini_raw } = req.body;
        if (!telegram_id) return res.status(400).json({ error: 'telegram_id required' });

        const log = await db.insertFoodLog(telegram_id, {
            food_description, calories, protein_g, carbs_g, fat_g, gemini_raw
        });
        res.json(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/food-logs/:id — hapus log spesifik
router.delete('/:id', async (req, res) => {
    try {
        const { telegram_id } = req.body;
        await db.deleteLogById(parseInt(req.params.id), telegram_id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/food-logs/reset/:telegramId — reset semua log hari ini
router.delete('/reset/:telegramId', async (req, res) => {
    try {
        const deleted = await db.deleteTodayLogs(parseInt(req.params.telegramId));
        res.json({ deleted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
