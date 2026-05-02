require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

/* PLANOS */
const PLAN_LIMITS = {
  free: 20,
  pro: 200,
  enterprise: 999999
};

/* MIDDLEWARE */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
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

/* DB */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Mongo conectado"))
  .catch(err => console.log(err));

/* MODELS */
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

const Client = mongoose.model("Client", {
  companyId: String,
  nome: String,
  telefone: String,
  cpfcnpj: String
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
  updatedAt: { type: Date, default: Date.now }
});

/* ADMIN AUTO */
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

/* AUTH */
function auth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "not_logged" });
  }
  next();
}

/* LIMIT */
async function checkLimit(req, res, next) {
  const company = await Company.findById(req.session.user.companyId);

  if (!company) {
    return res.status(500).json({ error: "company_not_found" });
  }

  const total = await Ticket.countDocuments({
    companyId: company._id
  });

  if (total >= PLAN_LIMITS[company.plan]) {
    return res.status(403).json({ error: "limit" });
  }

  next();
}

/* LOGIN */
app.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });

    if (!user || !user.password) {
      return res.status(401).json({ success: false });
    }

    const ok = await bcrypt.compare(req.body.password, user.password);

    if (!ok) {
      return res.status(401).json({ success: false });
    }

    const company = await Company.findById(user.companyId);

    req.session.user = {
      id: user._id,
      username: user.username,
      role: user.role,
      companyId: user.companyId
    };

    req.session.company = company;

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* SESSION */
app.get("/session", (req, res) => {
  res.json({
    user: req.session.user || null,
    company: req.session.company || null
  });
});

/* LOGOUT */
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

/* CLIENTES */
app.post("/api/clientes", auth, async (req, res) => {
  const exists = await Client.findOne({
    cpfcnpj: req.body.cpfcnpj,
    companyId: req.session.user.companyId
  });

  if (!exists) {
    await Client.create({
      companyId: req.session.user.companyId,
      nome: req.body.nome,
      telefone: req.body.telefone,
      cpfcnpj: req.body.cpfcnpj
    });
  }

  res.json({ ok: true });
});

app.get("/api/clientes/:doc", auth, async (req, res) => {
  const c = await Client.findOne({
    cpfcnpj: req.params.doc,
    companyId: req.session.user.companyId
  });

  res.json(c);
});

app.get("/api/clientes/list", auth, async (req, res) => {
  const data = await Client.find({
    companyId: req.session.user.companyId
  });

  res.json(data);
});

/* TICKETS */
app.get("/api/tickets", auth, async (req, res) => {
  const data = await Ticket.find({
    companyId: req.session.user.companyId
  }).sort({ createdAt: -1 });

  res.json(data);
});

app.post("/api/tickets", auth, checkLimit, async (req, res) => {
  const t = await Ticket.create({
    companyId: req.session.user.companyId,
    cliente: req.body.cliente,
    telefone: req.body.telefone,
    cpfcnpj: req.body.cpfcnpj,
    equipamento: req.body.equipamento,
    problema: req.body.problema
  });

  res.json(t);
});

/* PUBLIC TICKET */
app.post("/api/public/tickets", async (req, res) => {
  try {
    const company = await Company.findOne({ plan: "enterprise" });

    if (!company) {
      return res.status(500).json({ error: "no_company" });
    }

    await Ticket.create({
      companyId: company._id,
      cliente: req.body.cliente,
      telefone: req.body.telefone,
      cpfcnpj: req.body.cpfcnpj,
      equipamento: req.body.equipamento,
      problema: req.body.problema,
      status: "aberto"
    });

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ error: true });
  }
});

/* UPDATE + WHATSAPP */
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

  const dataHora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo"
  });

  let tipoDoc = "Documento";
  const docNumeros = (t.cpfcnpj || "").replace(/\D/g, "");

  if (docNumeros.length === 11) tipoDoc = "CPF";
  if (docNumeros.length === 14) tipoDoc = "CNPJ";

  let msg = `
Bits & Bytes Assistência Técnica

Status: ${t.status.toUpperCase()}

Cliente: ${t.cliente}
${tipoDoc}: ${t.cpfcnpj || "Não informado"}
Equipamento: ${t.equipamento}
Atualizado em: ${dataHora}
`;

  const link = `https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`;

  res.json({ ok: true, whatsapp: link });
});

/* DELETE */
app.delete("/api/tickets/:id", auth, async (req, res) => {
  await Ticket.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

/* START (CORRIGIDO PRA RENDER) */
app.listen(PORT, "0.0.0.0", () => {
  console.log("Rodando na porta " + PORT);
});