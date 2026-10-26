require('dotenv').config();
const session = require('express-session');
const bcrypt = require('bcryptjs');
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

const ALLOWED_STATUSES = ['free', 'occupied', 'maintenance'];

app.use(express.json());
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));
app.use(express.static('public'));

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Нужно войти в аккаунт' });
  }
  next();
}

// --- Кто вошёл и выход ---
app.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Вы не вошли' });
  }
  res.json({ userId: req.session.userId, login: req.session.login });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.json({ message: 'Вы вышли' });
  });
});

// --- Места: чтение ---
app.get('/seats', async (req, res) => {
  const seats = await prisma.seat.findMany();
  res.json(seats);
});

app.get('/seats/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const seat = await prisma.seat.findUnique({ where: { id } });

  if (!seat) {
    return res.status(404).send('Место не найдено');
  }
  res.json(seat);
});

// --- Места: создание ---
app.post('/seats', requireAuth, async (req, res) => {
  try {
    const { name, status } = req.body;

    if (!name || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Нужны name и корректный status' });
    }

    const newSeat = await prisma.seat.create({ data: { name, status } });
    res.status(201).json(newSeat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// --- Места: изменение ---
app.put('/seats/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ message: 'Неверный id' });
    }
    if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Неверный статус' });
    }

    const updated = await prisma.seat.update({
      where: { id },
      data: { name, status }
    });
    res.json(updated);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Место не найдено' });
    }
    console.error(error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// --- Места: удаление ---
app.delete('/seats/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ message: 'Неверный id' });
    }

    await prisma.seat.delete({ where: { id } });
    res.json({ message: 'Место удалено' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Место не найдено' });
    }
    console.error(error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// --- Регистрация ---
app.post('/register', async (req, res) => {
  try {
    const { login, password, agree } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: 'Заполните все поля' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Пароль должен быть не короче 8 символов' });
    }
    if (!agree) {
      return res.status(400).json({ message: 'Нужно принять соглашение' });
    }

    const exists = await prisma.user.findUnique({ where: { login } });
    if (exists) {
      return res.status(409).json({ message: 'Такой пользователь уже есть' });
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { login, password: hash } });
    res.status(201).json({ message: 'Вы зарегистрированы' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// --- Вход ---
app.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: 'Заполните все поля' });
    }

    const user = await prisma.user.findUnique({ where: { login } });
    if (!user) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ message: 'Ошибка создания сессии' });
      }
      req.session.userId = user.id;
      req.session.login = user.login;
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: 'Не удалось сохранить сессию' });
        }
        res.json({ message: 'Добро пожаловать, ' + user.login, login: user.login });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

app.listen(3000, () => {
  console.log('Сервер запущен на http://localhost:3000');
});