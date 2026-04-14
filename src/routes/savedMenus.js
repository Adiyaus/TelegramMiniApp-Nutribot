// api/src/routes/savedMenus.js
const express = require('express');
const router  = express.Router();
const db      = require('../services/database');

// GET /api/menus/:telegramId
router.get('/:telegramId', async (req, res) => {
    try {
        const menus = await db.getSavedMenus(parseInt(req.params.telegramId));
        res.json(menus);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/menus — simpan menu baru
router.post('/', async (req, res) => {
    try {
        const { telegram_id, menu_name, food_description, calories, protein_g, carbs_g, fat_g } = req.body;
        const menu = await db.saveMenu(telegram_id, {
            menu_name, food_description, calories, protein_g, carbs_g, fat_g
        });
        res.json(menu);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/menus/:id/log — log dari menu tersimpan
router.post('/:id/log', async (req, res) => {
    try {
        const { telegram_id } = req.body;
        const menu = await db.getSavedMenuById(parseInt(req.params.id), telegram_id);
        if (!menu) return res.status(404).json({ error: 'Menu not found' });

        const [log] = await Promise.all([
            db.insertFoodLog(telegram_id, {
                food_description: menu.food_description,
                calories:         menu.calories,
                protein_g:        menu.protein_g,
                carbs_g:          menu.carbs_g,
                fat_g:            menu.fat_g
            }),
            db.incrementMenuUseCount(parseInt(req.params.id))
        ]);
        res.json(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/menus/:id
router.delete('/:id', async (req, res) => {
    try {
        const { telegram_id } = req.body;
        await db.deleteMenu(parseInt(req.params.id), telegram_id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
