const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const User = require("./models/User");
const Ticket = require("./models/Ticket");

const app = express();

/* =========================
   🔥 ENV SAFE (CORRIGIDO)
========================= */

const isProd = process.env.NODE_ENV === "production";

const MONGO_URL =
  isProd ? process.env.MONGO_URL_PROD : process.env.MONGO_URL_TESTE;

const SESSION_SECRET =
  isProd ? process.env.SESSION_SECRET_PROD : process.env.SESSION_SECRET_TESTE;

/* =========================
   🔥 VALIDATION (EVITA DEPLOY QUEBRADO)
========================= */

if (!MONGO_URL) {
  console.error("❌ MONGO_URL não definido");
}

if (!SESSION_SECRET) {
  console.error("❌ SESSION_SECRET não definido");
}

/* =========================
   🔥 MIDDLEWARES
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   🌐 FRONTEND
========================= */

app.use(express.static(path.join(__dirname, "public")));

/* =========================
   🔥 CORS
========================= */

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

/* =========================
   🔥 SESSION
========================= */

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URL,
      ttl: 60 * 60 * 24,
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
    },
  })
);

/* =========================
   🔥 BANCO
========================= */

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("Mongo conectado:", isProd ? "PROD" : "TESTE"))
  .catch((err) => console.log("Erro Mongo:", err));

/* =========================
   🏠 ROTA PRINCIPAL (CORREÇÃO DO SEU ERRO)
========================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   🔐 LOGIN
========================= */

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user) return res.status(400).send("Usuário não encontrado");

    const check = await bcrypt.compare(password, user.password);

    if (!check) return res.status(400).send("Senha inválida");

    if (!user.companyId) {
      return res.status(400).send("Usuário sem empresa vinculada");
    }

    req.session.user = {
      _id: user._id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
    };

    res.send("Login OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro no login");
  }
});

/* =========================
   🔒 AUTH
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

app.get("/tickets", auth, async (req, res) => {
  const tickets = await Ticket.find({
    companyId: req.session.user.companyId,
  });

  res.json(tickets);
});

app.post("/tickets", auth, async (req, res) => {
  const ticket = await Ticket.create({
    cliente: req.body.cliente,
    problema: req.body.problema,
    status: "aberto",
    companyId: req.session.user.companyId,
  });

  res.json(ticket);
});

app.put("/tickets/:id", auth, async (req, res) => {
  const ticket = await Ticket.findOneAndUpdate(
    {
      _id: req.params.id,
      companyId: req.session.user.companyId,
    },
    { status: req.body.status },
    { new: true }
  );

  if (!ticket) return res.status(404).send("Ticket não encontrado");

  res.json(ticket);
});

app.delete("/tickets/:id", auth, async (req, res) => {
  const deleted = await Ticket.findOneAndDelete({
    _id: req.params.id,
    companyId: req.session.user.companyId,
  });

  if (!deleted) return res.status(404).send("Ticket não encontrado");

  res.send("Deletado");
});

/* =========================
   🚪 LOGOUT
========================= */

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.send("Logout feito");
  });
});

/* =========================
   ❌ 404 HANDLER (OPCIONAL MAS BOM)
========================= */

app.use((req, res) => {
  res.status(404).send("Página não encontrada");
});

/* =========================
   🚀 START
========================= */

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor rodando na porta", process.env.PORT || 3000);
});