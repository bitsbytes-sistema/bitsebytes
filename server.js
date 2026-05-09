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
   🔥 RENDER FIX (OBRIGATÓRIO)
========================= */
app.set("trust proxy", 1);

/* =========================
   🔥 CONFIG SIMPLES (SEM ISPROD BUGADO)
========================= */

const MONGO_URL = process.env.MONGO_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;

/* =========================
   🔥 CHECK BÁSICO
========================= */

if (!MONGO_URL) console.error("❌ MONGO_URL não definida");
if (!SESSION_SECRET) console.error("❌ SESSION_SECRET não definida");

/* =========================
   🔥 MIDDLEWARES
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

/* =========================
   🌐 FRONTEND
========================= */

app.use(express.static(path.join(__dirname, "public")));

/* =========================
   🔥 SESSION (ESTÁVEL PRA PRODUÇÃO)
========================= */

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URL,
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: true,     // Render usa HTTPS
      sameSite: "lax",
    },
  })
);

/* =========================
   🔥 BANCO
========================= */

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("Mongo conectado"))
  .catch((err) => console.log("Erro Mongo:", err));

/* =========================
   🏠 ROTAS FRONTEND
========================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/clientes", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "clientes.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/painel", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "painel.html"));
});

app.get("/abrir-chamado", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "abrir chamado.html"));
});

/* =========================
   🔐 LOGIN (CORRIGIDO)
========================= */

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return res.json({ success: false, message: "Usuário não encontrado" });
    }

    const check = await bcrypt.compare(password, user.password);

    if (!check) {
      return res.json({ success: false, message: "Senha inválida" });
    }

    if (!user.companyId) {
      return res.json({ success: false, message: "Sem empresa vinculada" });
    }

    req.session.user = {
      _id: user._id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
    };

    return res.json({
      success: true,
      message: "Login OK",
    });
  } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      message: "Erro no login",
    });
  }
});

/* =========================
   🔒 AUTH
========================= */

function auth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Não autorizado" });
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

  if (!ticket) {
    return res.status(404).json({ success: false, message: "Não encontrado" });
  }

  res.json(ticket);
});

app.delete("/tickets/:id", auth, async (req, res) => {
  const deleted = await Ticket.findOneAndDelete({
    _id: req.params.id,
    companyId: req.session.user.companyId,
  });

  if (!deleted) {
    return res.status(404).json({ success: false, message: "Não encontrado" });
  }

  res.json({ success: true });
});

/* =========================
   🚪 LOGOUT
========================= */

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

/* =========================
   ❌ 404
========================= */

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Rota não encontrada" });
});

/* =========================
   🚀 START
========================= */

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor rodando");
});