const bcrypt = require("bcrypt");
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ===================== */
/* CONFIG */
/* ===================== */
const LIMITE_CLIENTE = 3;

/* ===================== */
/* MIDDLEWARES */
/* ===================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
/* MONGO */
/* ===================== */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Mongo conectado"))
  .catch(err => console.log("ERRO MONGO:", err));

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
/* DATA (CUIABÁ) */
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
/* ADMIN ONLY */
/* ===================== */
function adminOnly(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}

/* ===================== */
/* LOGIN (CORRIGIDO) */
/* ===================== */
app.post("/login", async (req, res) => {

  const user = await User.findOne({
    username: req.body.username
  });

  if (!user) {
    return res.json({ success: false });
  }

  if (user.password !== req.body.password) {
    return res.json({ success: false });
  }

  // 🔥 CORREÇÃO PRINCIPAL (SESSION)
  req.session.user = {
    id: user._id,
    username: user.username,
    role: user.role,
    companyId: user.companyId
  };

  res.json({
    success: true,
    user
  });
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
  try {
    const data = await Ticket.find().sort({ createdAt: -1 });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: true });
  }
});

/* ===================== */
/* CRIAR CHAMADO (ADMIN) */
/* ===================== */
app.post("/api/tickets", auth, async (req, res) => {
  const t = await Ticket.create(req.body);
  res.json(t);
});

/* ===================== */
/* ABRIR CHAMADO (PÚBLICO COM LIMITE) */
/* ===================== */
app.post("/abrir-chamado", async (req, res) => {
  try {
    const company = await Company.findOne({ plan: "enterprise" });

    if (!company) {
      return res.status(400).json({ ok: false, error: "Empresa não encontrada" });
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
        error: "Você já possui 3 chamados em andamento."
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
    console.log(err);
    return res.status(500).json({ ok: false });
  }
});

/* ===================== */
/* UPDATE + WHATSAPP */
/* ===================== */
app.put("/api/tickets/:id", auth, async (req, res) => {
  const t = await Ticket.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedAt: new Date() },
    { new: true }
  );

  if (!t) return res.status(404).json({ error: true });

  const telefone = String(t.telefone || "").replace(/\D/g, "");

  if (!telefone) {
    return res.json({ ok: true, whatsapp: null });
  }

  let tipoDoc = "Documento";
  const doc = String(t.cpfcnpj || "").replace(/\D/g, "");

  if (doc.length === 11) tipoDoc = "CPF";
  if (doc.length === 14) tipoDoc = "CNPJ";

  let msgFinal = "";

  if (t.status === "finalizado") {
    msgFinal = `
Seu equipamento já está pronto para retirada!
    `;
  } else {
    msgFinal = `
Seu atendimento está em andamento.
    `;
  }

  const msg = `
Bits & Bytes Assistência Técnica

Status: ${String(t.status).toUpperCase()}

Cliente: ${t.cliente}
${tipoDoc}: ${t.cpfcnpj || "Não informado"}
Equipamento: ${t.equipamento}
Problema: ${t.problema || "Não informado"}
Atualizado em: ${getDataHora()}

${msgFinal}
  `.trim();

  const whatsapp = `https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`;

  return res.json({
    ok: true,
    whatsapp
  });
});

/* ===================== */
/* DELETE */
/* ===================== */
app.delete("/api/tickets/:id", auth, async (req, res) => {
  try {
    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

/* ===================== */
/* START */
/* ===================== */
app.listen(PORT, "0.0.0.0", () => {
  console.log("Rodando na porta " + PORT);
});