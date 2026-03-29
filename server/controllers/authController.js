/**
 * Controller для аутентификации пользователей
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Секретный ключ для JWT (в продакшене должен быть в .env)
const JWT_SECRET = process.env.JWT_SECRET || 'hyperlex-secret-key-2024';

/**
 * Регистрация пользователя
 */
async function register(req, res) {
    try {
        const { username, email, password } = req.body;

        // Валидация входных данных
        if (!username || !email || !password) {
            return res.status(400).json({
                error: 'All fields are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'Password must be at least 6 characters'
            });
        }

        // Проверка, существует ли уже такой email или username
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(409).json({
                    error: 'Email already registered'
                });
            }
            if (existingUser.username === username) {
                return res.status(409).json({
                    error: 'Username already taken'
                });
            }
        }

        // Создание пользователя
        const newUser = new User({
            username,
            email,
            password,
            role: email === 'admin@hyperlex.com' ? 'admin' : 'user'
        });

        await newUser.save();

        // Создание JWT токена
        const token = jwt.sign(
            { id: newUser._id, email: newUser.email, username: newUser.username, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Server error during registration'
        });
    }
}

/**
 * Вход пользователя
 */
async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Валидация входных данных
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        // Поиск пользователя по email (с паролем)
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        // Проверка пароля
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        // Определение роли - если админ эмейл, то админ
        let userRole = user.role;
        if (user.email === 'admin@hyperlex.com' && userRole !== 'admin') {
            userRole = 'admin';
            // Обновляем роль в БД также
            user.role = 'admin';
            await user.save();
        }

        // Создание JWT токена
        const token = jwt.sign(
            { id: user._id, email: user.email, username: user.username, role: userRole },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Logged in successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: userRole
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Server error during login'
        });
    }
}

/**
 * Получение текущего пользователя
 */
async function getCurrentUser(req, res) {
    try {
        // Пользователь добавлен в req через middleware аутентификации
        if (!req.user) {
            return res.status(401).json({
                error: 'Not authorized'
            });
        }

        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            error: 'Server error'
        });
    }
}

// Middleware для проверки JWT токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            error: 'Token not provided'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                error: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
}

// Middleware для проверки админ роли
async function checkAdminRole(req, res, next) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authorized' });
        }

        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
}

/**
 * Получение всех пользователей (только для админов)
 */
async function getAllUsers(req, res) {
    try {
        const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
        res.json({ users });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
}

/**
 * Обновление пользователя (изменение роли)
 */
async function updateUser(req, res) {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { role },
            { new: true, select: { password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User updated', user });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
}

/**
 * Удаление пользователя
 */
async function deleteUser(req, res) {
    try {
        const { userId } = req.params;

        const user = await User.findByIdAndDelete(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
}

module.exports = {
    register,
    login,
    getCurrentUser,
    authenticateToken,
    checkAdminRole,
    getAllUsers,
    updateUser,
    deleteUser
};
