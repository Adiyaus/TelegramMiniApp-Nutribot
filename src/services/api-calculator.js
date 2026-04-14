// api/src/services/calculator.js — reuse from bot
require('dotenv').config();

const ACTIVITY_MULTIPLIERS = {
    sedentary: 1.2, light: 1.375, moderate: 1.55,
    active: 1.725, very_active: 1.9
};

function calculateBMR(weightKg, heightCm, age, gender) {
    return gender === 'pria'
        ? Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5)
        : Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161);
}

function calculateTDEE(bmr, activityLevel) {
    return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.2));
}

function calculateDailyGoal(tdee) {
    return Math.max(tdee - (parseInt(process.env.CALORIE_DEFICIT) || 500), 1200);
}

module.exports = { calculateBMR, calculateTDEE, calculateDailyGoal };
