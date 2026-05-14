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
   TRUST PROXY (RENDER)
========================= */

app.set("trust proxy", 1);

/* =========================
   ENV
========================= */

const MONGO_URL = process.env.MONGO_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;

/* =========================
   CHECK
========================= */

if (!MONGO_URL) console.log("❌ MONGO_URL ausente");
if (!SESSION_SECRET) console.log("❌ SESSION_SECRET ausente");

/* =========================
   MIDDLEWARES
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
   FRONTEND
========================= */

app.use(express.static(path.join(__dirname, "public")));

/* =========================
   SESSION
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
      secure: true,
      sameSite: "lax",
    },
  })
);

/* =========================
   MONGO
========================= */

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("Mongo conectado"))
  .catch((err) => console.log(err));

/* =========================
   ROTAS FRONT
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

/* =========================
   LOGIN
========================= */

app.post("/login", async (req, res) => {
  try {

    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return res.json({
        success: false,
        message: "Usuário não encontrado"
      });
    }

    const check = await bcrypt.compare(
      password,
      user.password
    );

    if (!check) {
      return res.json({
        success: false,
        message: "Senha inválida"
      });
    }

    req.session.user = {
      _id: user._id,
      username: user.username,
      role: user.role || "Padrão",
      companyId: user.companyId || null,
    };

    req.session.save(() => {

      return res.json({
        success: true,
        message: "Login OK"
      });

    });

  } catch (err) {

    console.log(err);

    return res.json({
      success: false,
      message: "Erro login"
    });

  }
});

/* =========================
   USER SESSION
========================= */

app.get("/me", (req, res) => {

  if (!req.session.user) {
    return res.status(401).json({
      logged: false
    });
  }

  res.json({
    logged: true,
    user: req.session.user
  });

});

/* =========================
   AUTH
========================= */

function auth(req, res, next) {

  if (!req.session.user) {

    return res.status(401).json({
      success: false,
      message: "Não autorizado"
    });

  }

  next();
}

/* =========================
   TICKETS
========================= */

app.get("/tickets", auth, async (req, res) => {

  const tickets = await Ticket.find({});

  res.json(tickets);

});

app.post("/tickets", auth, async (req, res) => {

  const ticket = await Ticket.create({
    cliente: req.body.cliente,
    telefone: req.body.telefone,
    cpfcnpj: req.body.cpfcnpj,
    equipamento: req.body.equipamento,
    problema: req.body.problema,
    status: "aberto",
  });

  res.json(ticket);

});

app.put("/tickets/:id", auth, async (req, res) => {

  const ticket = await Ticket.findByIdAndUpdate(
    req.params.id,
    {
      status: req.body.status
    },
    {
      new: true
    }
  );

  res.json(ticket);

});

app.delete("/tickets/:id", auth, async (req, res) => {

  await Ticket.findByIdAndDelete(
    req.params.id
  );

  res.json({
    success: true
  });

});

/* =========================
   LOGOUT
========================= */

app.post("/logout", (req, res) => {

  req.session.destroy(() => {

    res.json({
      success: true
    });

  });

});

/* =========================
   404
========================= */

app.use((req, res) => {

  res.status(404).json({
    success: false,
    message: "Rota não encontrada"
  });

});

/* =========================
   START
========================= */

app.listen(process.env.PORT || 3000, () => {

  console.log("Servidor rodando");

});