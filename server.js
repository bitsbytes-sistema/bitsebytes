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
/* FUNÇÃO DE DATA (SEM BUG) */
/* ===================== */
function getDataHora() {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    hour12: false
  });
}

/* ===================== */
/* ADMIN AUTO */
/* ===================== */
async function createAdmin() {
  const exists = await User.findOne({ username: "admin" });

  if (!exists) {
    const company = await Company.create({
      name: "Minha Empresa",
      plan: "enterprise"
    });

    const hash = await bcrypt.hash("1802", 10);

    await User.create({
      username: "admin",
      password: hash,
      role: "admin",
      companyId: company._id
    });

    console.log("ADMIN CRIADO: admin / 1802");
  }
}

mongoose.connection.once("open", createAdmin);

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
/* LISTAR TICKETS */
/* ===================== */
app.get("/api/tickets", auth, async (req, res) => {
  const data = await Ticket.find().sort({ createdAt: -1 });
  res.json(data);
});

/* ===================== */
/* CRIAR TICKET (ADMIN) */
/* ===================== */
app.post("/api/tickets", auth, async (req, res) => {
  const t = await Ticket.create(req.body);
  res.json(t);
});

/* ===================== */
/* ABRIR CHAMADO (PÚBLICO) */
/* ===================== */
app.post("/abrir-chamado", async (req, res) => {
  try {
    const company = await Company.findOne({ plan: "enterprise" });

    await Ticket.create({
      companyId: company._id,
      cliente: req.body.cliente,
      telefone: req.body.telefone,
      cpfcnpj: req.body.cpfcnpj,
      equipamento: req.body.equipamento,
      problema: req.body.problema,
      status: "aberto"
    });

    return res.json({ ok: true });

  } catch (err) {
    console.log("ERRO abrir chamado:", err);
    return res.status(500).json({ ok: false });
  }
});

/* ===================== */
/* UPDATE + WHATSAPP LINK */
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

  const msg = `
Bits & Bytes Assistência Técnica

Status do seu atendimento: ${String(t.status).toUpperCase()}

Cliente: ${t.cliente}
${tipoDoc}: ${t.cpfcnpj || "Não informado"}
Equipamento: ${t.equipamento}
Atualizado em: ${getDataHora()}

Seu equipamento ja esta pronto para retirada!
  `.trim();

  const whatsapp = `https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`;

  return res.json({
    ok: true,
    whatsapp
  });
});

/* ===================== */
/* DELETE TICKET */
/* ===================== */
app.delete("/api/tickets/:id", auth, async (req, res) => {
  try {
    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

/* ===================== */
/* START */
/* ===================== */
app.listen(PORT, "0.0.0.0", () => {
  console.log("Rodando na porta " + PORT);
});