const bcrypt = require('bcryptjs');
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Привет, мир!');
});

app.post('/seats', async (req, res) => {
  const { name, status } = req.body;

  const newSeat = await prisma.seat.create({
    data: { name, status }
  });

  res.status(201).json(newSeat);
});

app.post('/register', async (req, res) => {
  const {login, password, agree} = req.body;

  if(!login || !password) {
    return res.status(400).json({message: 'Заполните все поля'});
  }
  if (password.length < 8) {
  return res.status(400).json({ message: 'Пароль должен быть не короче 8 символов' });
}
  if (!agree){
    return res.status(400).json({message: 'Нужно принять соглашение'});  
  }
  const exists = await prisma.user.findUnique({where: {login} });
  if (exists){
    return res.status(409).json({message: 'Такой пользователь уже есть'});
  }
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({data: {login, password: hash} });
  res.status(201).json({message: 'Вы зарегистрированы'});
})

app.post('/login', async (req, res) => {
  const { login, password } = req.body;

  if(!login || !password) {
    return res.status(400).json({message: 'Напишиште имя или парол'});
  }
  const user = await prisma.user.findUnique({where: {login}});
  if (!user) {
    return res.status(401).json({message: 'Неправлены логин или проль'});
  }
  const ok = await bcrypt.compare(password, user.password);
  if(!ok) {
    return res.status(401).json({message: 'Неправлены логин или пароль'});
  }
  res.json({message: 'Добро пожаловать, ' + user.login});
})

app.listen(3000, () => {
  console.log('Сервер запущен на http://localhost:3000');
});
const seats = [
  { id: 1, name: "Место 1", status: "free" },
  { id: 2, name: "Место 2", status: "occupied" },
  { id: 3, name: "Место 3", status: "free" }
];

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