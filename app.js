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