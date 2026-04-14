// ============================================================
// src/services/database.js
// Update: tambah saved_menus queries
// ============================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// ─── TIMEZONE HELPER ──────────────────────────────────────────

/**
 * Ambil tanggal hari ini dalam timezone WIB (UTC+7)
 * Format: 'YYYY-MM-DD'
 *
 * Kenapa perlu ini:
 * new Date().toISOString() selalu return UTC — jadi sebelum jam 07:00 WIB,
 * UTC masih "kemarin" → data hari sebelumnya kebaca sebagai "hari ini"
 *
 * Fix: offset manual +7 jam sebelum format ke string
 */
function getTodayWIB() {
    const now       = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;          // 7 jam dalam milliseconds
    const wibDate   = new Date(now.getTime() + wibOffset); // geser ke WIB
    return wibDate.toISOString().split('T')[0];     // ambil bagian YYYY-MM-DD
}

/**
 * Buat objek Date yang sudah di-offset ke WIB
 * Dipake buat kalkulasi tanggal (streak, weekly logs)
 */
function nowWIB() {
    return new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
}

// ─── USER QUERIES ─────────────────────────────────────────────

async function getUser(telegramId) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[DB] getUser error:', error.message);
    }
    return data;
}

async function upsertUser(telegramId, updates) {
    const { data, error } = await supabase
        .from('users')
        .upsert(
            { telegram_id: telegramId, ...updates, updated_at: new Date().toISOString() },
            { onConflict: 'telegram_id' }
        )
        .select()
        .single();

    if (error) {
        console.error('[DB] upsertUser error:', error.message);
        throw new Error('Gagal nyimpen data user');
    }
    return data;
}

async function updateRegistrationStep(telegramId, step) {
    const { error } = await supabase
        .from('users')
        .update({ registration_step: step, updated_at: new Date().toISOString() })
        .eq('telegram_id', telegramId);

    if (error) console.error('[DB] updateStep error:', error.message);
}

// ─── STREAK ───────────────────────────────────────────────────

async function getStreak(telegramId) {
    const { data, error } = await supabase
        .from('food_logs')
        .select('log_date')
        .eq('telegram_id', telegramId)
        .order('log_date', { ascending: false });

    if (error || !data || data.length === 0) return 0;

    const uniqueDates = [...new Set(data.map(r => r.log_date))];
    let streak    = 0;

    // Pakai nowWIB() biar streak ngitung berdasarkan hari WIB, bukan UTC
    let checkDate = nowWIB();
    checkDate.setUTCHours(0, 0, 0, 0); // reset ke awal hari WIB

    for (let i = 0; i < uniqueDates.length; i++) {
        // Format tanggal dalam WIB — ambil YYYY-MM-DD dari ISO string
        const dateStr = checkDate.toISOString().split('T')[0];
        if (uniqueDates.includes(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1); // mundur 1 hari
        } else {
            break;
        }
    }
    return streak;
}

// ─── TARGET & REMINDER ────────────────────────────────────────

async function setTargetWeight(telegramId, targetWeight) {
    const { error } = await supabase
        .from('users')
        .update({ target_weight: targetWeight, updated_at: new Date().toISOString() })
        .eq('telegram_id', telegramId);

    if (error) throw new Error('Gagal set target berat');
}

async function setReminderTime(telegramId, time) {
    const { error } = await supabase
        .from('users')
        .update({ reminder_time: time, updated_at: new Date().toISOString() })
        .eq('telegram_id', telegramId);

    if (error) throw new Error('Gagal set reminder');
}

async function getUsersWithReminder(time) {
    const { data, error } = await supabase
        .from('users')
        .select('telegram_id, name, daily_calorie_goal, reminder_time')
        .eq('reminder_time', time)
        .eq('is_registered', true);

    if (error) {
        console.error('[DB] getUsersWithReminder error:', error.message);
        return [];
    }
    return data || [];
}

// ─── FOOD LOG QUERIES ─────────────────────────────────────────

async function insertFoodLog(telegramId, nutritionData) {
    const { data, error } = await supabase
        .from('food_logs')
        .insert({
            telegram_id: telegramId,
            log_date: getTodayWIB(),
            ...nutritionData,
            logged_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('[DB] insertFoodLog error:', error.message);
        throw new Error('Gagal nyimpen food log');
    }
    return data;
}

async function updateFoodLogDescription(logId, newDescription) {
    const { error } = await supabase
        .from('food_logs')
        .update({ food_description: newDescription })
        .eq('id', logId);

    if (error) throw new Error('Gagal update food log');
}

/**
 * Update semua field nutrisi di log tertentu
 * Dipake buat fitur edit angka kalori/protein/karbo/lemak
 * @param {number} logId
 * @param {number} telegramId - validasi ownership
 * @param {object} updates - { food_description, calories, protein_g, carbs_g, fat_g }
 */
async function updateFoodLog(logId, telegramId, updates) {
    const { error } = await supabase
        .from('food_logs')
        .update(updates)
        .eq('id', logId)
        .eq('telegram_id', telegramId); // pastiin log ini milik user yang beneran

    if (error) {
        console.error('[DB] updateFoodLog error:', error.message);
        throw new Error('Gagal update food log');
    }
}

/**
 * Hapus 1 log spesifik by ID
 * Dipake buat fitur /hapus log tertentu (bukan semua)
 * @param {number} logId
 * @param {number} telegramId - validasi ownership
 */
async function deleteLogById(logId, telegramId) {
    const { error } = await supabase
        .from('food_logs')
        .delete()
        .eq('id', logId)
        .eq('telegram_id', telegramId); // hanya bisa hapus log milik sendiri

    if (error) {
        console.error('[DB] deleteLogById error:', error.message);
        throw new Error('Gagal hapus log');
    }
}

async function deleteTodayLogs(telegramId) {
    const today = getTodayWIB();
    const { data, error } = await supabase
        .from('food_logs')
        .delete()
        .eq('telegram_id', telegramId)
        .eq('log_date', today)
        .select();

    if (error) throw new Error('Gagal reset log hari ini');
    return data?.length || 0;
}

async function getDailySummary(telegramId) {
    const today = getTodayWIB();
    const { data, error } = await supabase
        .from('daily_summary')
        .select('*')
        .eq('telegram_id', telegramId)
        .eq('log_date', today)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[DB] getDailySummary error:', error.message);
    }
    return data || {
        total_calories: 0, total_protein: 0,
        total_carbs: 0, total_fat: 0, meal_count: 0
    };
}

/**
 * Ambil list makanan yang sudah di-log hari ini
 * Dipake buat tampilkan detail di /status
 * @param {number} telegramId
 * @returns {Array} list { food_description, calories, logged_at }
 */
async function getTodayFoodList(telegramId) {
    const today = getTodayWIB();

    const { data, error } = await supabase
        .from('food_logs')
        .select('id, food_description, calories, protein_g, carbs_g, fat_g, logged_at')
        .eq('telegram_id', telegramId)
        .eq('log_date', today)
        .order('logged_at', { ascending: true }); // urut dari yang pertama dimakan

    if (error) {
        console.error('[DB] getTodayFoodList error:', error.message);
        return [];
    }
    return data || [];
}

async function getWeeklyLogs(telegramId) {
    // Pakai nowWIB() biar 7 hari terakhir dihitung berdasarkan waktu WIB
    const sevenDaysAgo = nowWIB();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
        .from('food_logs')
        .select('log_date, calories, protein_g, carbs_g, fat_g')
        .eq('telegram_id', telegramId)
        .gte('log_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('log_date', { ascending: true });

    if (error) return [];
    return data;
}

// ─── SAVED MENUS QUERIES ──────────────────────────────────────

/**
 * Simpan menu baru ke tabel saved_menus
 * @param {number} telegramId
 * @param {object} menuData - { menu_name, food_description, calories, protein_g, carbs_g, fat_g }
 */
async function saveMenu(telegramId, menuData) {
    const { data, error } = await supabase
        .from('saved_menus')
        .insert({
            telegram_id: telegramId,
            ...menuData
        })
        .select()
        .single();

    if (error) {
        console.error('[DB] saveMenu error:', error.message);
        throw new Error('Gagal simpan menu');
    }
    return data;
}

/**
 * Ambil semua menu tersimpan milik user
 * Diurutkan berdasarkan use_count (paling sering dipake duluan)
 * @param {number} telegramId
 */
async function getSavedMenus(telegramId) {
    const { data, error } = await supabase
        .from('saved_menus')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('use_count', { ascending: false }) // yang paling sering dipake muncul duluan
        .order('created_at', { ascending: false }); // kalau use_count sama, yang terbaru duluan

    if (error) {
        console.error('[DB] getSavedMenus error:', error.message);
        return [];
    }
    return data || [];
}

/**
 * Ambil 1 menu by ID — dipake waktu user pilih menu dari list
 * @param {number} menuId
 * @param {number} telegramId - untuk validasi ownership
 */
async function getSavedMenuById(menuId, telegramId) {
    const { data, error } = await supabase
        .from('saved_menus')
        .select('*')
        .eq('id', menuId)
        .eq('telegram_id', telegramId) // pastiin menu ini milik user yang beneran
        .single();

    if (error) {
        console.error('[DB] getSavedMenuById error:', error.message);
        return null;
    }
    return data;
}

/**
 * Increment use_count setiap kali menu dipilih dari list
 * Dipake buat sorting — yang sering dipake muncul paling atas
 * @param {number} menuId
 */
async function incrementMenuUseCount(menuId) {
    const { error } = await supabase
        .rpc('increment_menu_use_count', { menu_id: menuId }); // pakai RPC buat atomic increment

    // Fallback kalau RPC belum dibuat — pakai cara manual
    if (error) {
        const { data: menu } = await supabase
            .from('saved_menus')
            .select('use_count')
            .eq('id', menuId)
            .single();

        if (menu) {
            await supabase
                .from('saved_menus')
                .update({ use_count: (menu.use_count || 0) + 1 })
                .eq('id', menuId);
        }
    }
}

/**
 * Hapus menu tersimpan by ID
 * @param {number} menuId
 * @param {number} telegramId - validasi ownership
 */
async function deleteMenu(menuId, telegramId) {
    const { error } = await supabase
        .from('saved_menus')
        .delete()
        .eq('id', menuId)
        .eq('telegram_id', telegramId); // hanya bisa hapus menu milik sendiri

    if (error) {
        console.error('[DB] deleteMenu error:', error.message);
        throw new Error('Gagal hapus menu');
    }
}

module.exports = {
    // user
    getUser, upsertUser, updateRegistrationStep,
    // streak, target, reminder
    getStreak, setTargetWeight, setReminderTime, getUsersWithReminder,
    // food logs
    insertFoodLog, updateFoodLogDescription, updateFoodLog,
    deleteLogById, deleteTodayLogs,
    getDailySummary, getTodayFoodList, getWeeklyLogs,
    // saved menus
    saveMenu, getSavedMenus, getSavedMenuById,
    incrementMenuUseCount, deleteMenu
};