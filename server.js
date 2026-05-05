require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

/* ===================== */
/* CONFIG */
/* ===================== */
const LIMITE_CLIENTE = 3;

/* ===================== */
/* DEBUG */
/* ===================== */
console.log("ENV MONGO_URL:", process.env.MONGO_URL);

/* ===================== */
/* MIDDLEWARES */
/* ===================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===================== */
/* SESSION */
/* ===================== */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "segredo",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URL,
    }),
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

/* ===================== */
/* MODELS */
/* ===================== */
const Company = mongoose.model("Company", {
  name: String,
  plan: String
});

const User = mongoose.model("User", {
  username: String,
  password: String,
  role: String,
  companyId: String
});

const Ticket = mongoose.model("Ticket", {
  companyId: String,
  cliente: String,
  telefone: String,
  cpfcnpj: String,
  equipamento: String,
  problema: String,
  status: { type: String, default: "aberto" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

/* ===================== */
/* CREATE ADMIN */
/* ===================== */
async function createAdmin() {
  try {
    const exists = await User.findOne({ username: "admin" });
    if (exists) return;

    const hash = await bcrypt.hash("123456", 10);

    await User.create({
      username: "admin",
      password: hash,
      role: "admin",
      companyId: "teste"
    });

    console.log("ADMIN CRIADO");
  } catch (err) {
    console.log("ERRO CREATE ADMIN:", err);
  }
}

/* ===================== */
/* CREATE COMPANY */
/* ===================== */
async function createCompany() {
  try {
    const exists = await Company.findOne({ name: "Bits & Bytes Teste" });
    if (exists) return;

    await Company.create({
      name: "Bits & Bytes Teste",
      plan: "enterprise"
    });

    console.log("COMPANY CRIADA");
  } catch (err) {
    console.log("ERRO CREATE COMPANY:", err);
  }
}

/* ===================== */
/* MONGO */
/* ===================== */
mongoose
  .connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 5000
  })
  .then(() => {
    console.log("Mongo conectado com sucesso");

    setTimeout(() => {
      createAdmin();
      createCompany();
    }, 2000);
  })
  .catch((err) => {
    console.log("ERRO MONGO:", err);
  });

/* ===================== */
/* SESSION CHECK (NOVO - CORRIGE SEU ERRO) */
/* ===================== */
app.get("/session", (req, res) => {
  if (!req.session.user) {
    return res.json({
      logged: false
    });
  }

  return res.json({
    logged: true,
    user: req.session.user
  });
});

/* ===================== */
/* DATA */
/* ===================== */
function getDataHora() {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    hour12: false
  });
}

/* ===================== */
/* AUTH */
/* ===================== */
function auth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "not_logged" });
  }
  next();
}

/* ===================== */
/* LOGIN */
/* ===================== */
app.post("/login", async (req, res) => {
  const user = await User.findOne({ username: req.body.username });

  if (!user) return res.json({ success: false });

  const ok = await bcrypt.compare(req.body.password, user.password);

  if (!ok) return res.json({ success: false });

  req.session.user = user;
  res.json({ success: true });
});

/* ===================== */
/* LOGOUT */
/* ===================== */
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

/* ===================== */
/* LISTAR CHAMADOS */
/* ===================== */
app.get("/api/tickets", auth, async (req, res) => {
  const data = await Ticket.find().sort({ createdAt: -1 });
  res.json(data);
});

/* ===================== */
/* ABRIR CHAMADO */
/* ===================== */
app.post("/abrir-chamado", async (req, res) => {
  try {
    const company = await Company.findOne({
      name: "Bits & Bytes Teste"
    });

    if (!company) {
      return res.status(500).json({
        ok: false,
        error: "company_not_found"
      });
    }

    const doc = String(req.body.cpfcnpj).replace(/\D/g, "");

    const chamadosAbertos = await Ticket.countDocuments({
      companyId: company._id,
      cpfcnpj: doc,
      status: { $ne: "finalizado" }
    });

    if (chamadosAbertos >= LIMITE_CLIENTE) {
      return res.status(403).json({
        ok: false,
        error: "limite atingido"
      });
    }

    await Ticket.create({
      companyId: company._id,
      cliente: req.body.cliente,
      telefone: req.body.telefone,
      cpfcnpj: doc,
      equipamento: req.body.equipamento,
      problema: req.body.problema,
      status: "aberto"
    });

    return res.json({ ok: true });

  } catch (err) {
    console.log("ERRO ABRIR CHAMADO:", err);
    return res.status(500).json({ ok: false });
  }
});

/* ===================== */
/* START */
/* ===================== */
app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor rodando na porta " + PORT);
});