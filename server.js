const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
require("dotenv").config();

const User = require("./models/User");
const Ticket = require("./models/Ticket");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 SESSÃO
app.use(
  session({
    secret: "bitsebytes_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URL,
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  })
);

// 🔥 CONEXÃO BANCO
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Mongo conectado"))
  .catch(err => console.log(err));

/* =========================
   🔐 LOGIN
========================= */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) return res.status(400).send("Usuário não encontrado");

  const check = await bcrypt.compare(password, user.password);

  if (!check) return res.status(400).send("Senha inválida");

  // 🔥 AQUI É O CORAÇÃO DO SISTEMA
  req.session.user = {
    _id: user._id,
    username: user.username,
    role: user.role,
    companyId: user.companyId,
  };

  res.send("Login OK");
});

/* =========================
   🔒 MIDDLEWARE AUTH
========================= */
function auth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).send("Não autorizado");
  }
  next();
}

/* =========================
   🎫 TICKETS
========================= */

// LISTAR
app.get("/tickets", auth, async (req, res) => {
  const tickets = await Ticket.find({
    companyId: req.session.user.companyId,
  });

  res.json(tickets);
});

// CRIAR
app.post("/tickets", auth, async (req, res) => {
  const ticket = await Ticket.create({
    cliente: req.body.cliente,
    problema: req.body.problema,
    status: "aberto",
    companyId: req.session.user.companyId, // 🔥 ISOLA EMPRESA
  });

  res.json(ticket);
});

// ATUALIZAR
app.put("/tickets/:id", auth, async (req, res) => {
  const ticket = await Ticket.findOneAndUpdate(
    {
      _id: req.params.id,
      companyId: req.session.user.companyId,
    },
    { status: req.body.status },
    { new: true }
  );

  res.json(ticket);
});

// DELETAR
app.delete("/tickets/:id", auth, async (req, res) => {
  await Ticket.findOneAndDelete({
    _id: req.params.id,
    companyId: req.session.user.companyId,
  });

  res.send("Deletado");
});

/* =========================
   🚀 START SERVER
========================= */
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});