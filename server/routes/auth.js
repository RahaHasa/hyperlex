/**
 * Маршруты для аутентификации
 */

const express = require('express');
const router = express.Router();
const { 
    register, 
    login, 
    getCurrentUser, 
    authenticateToken,
    checkAdminRole,
    getAllUsers,
    updateUser,
    deleteUser
} = require('../controllers/authController');

// POST /api/auth/register - Регистрация
router.post('/register', register);

// POST /api/auth/login - Вход
router.post('/login', login);

// GET /api/auth/me - Получить текущего пользователя (требует авторизации)
router.get('/me', authenticateToken, getCurrentUser);

// Admin routes
// GET /api/auth/users - Получить всех пользователей (требует админ роли)
router.get('/users', authenticateToken, checkAdminRole, getAllUsers);

// PUT /api/auth/users/:userId - Обновить пользователя
router.put('/users/:userId', authenticateToken, checkAdminRole, updateUser);

// DELETE /api/auth/users/:userId - Удалить пользователя
router.delete('/users/:userId', authenticateToken, checkAdminRole, deleteUser);

module.exports = router;
