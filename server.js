require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

/* CONFIG */
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

/* MONGO */
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

const Ticket = mongoose.model("Ticket", {
  companyId: String,
  cliente: String,
  telefone: String,
  cpfcnpj: String,
  equipamento: String,
  problema: String,
  status: { type: String, default: "aberto" },
  createdAt: { type: Date, default: Date.now }
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

/* LOGIN */
app.post("/login", async (req, res) => {
  const user = await User.findOne({ username: req.body.username });
  if (!user) return res.json({ success: false });

  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.json({ success: false });

  req.session.user = user;
  res.json({ success: true });
});

/* LISTAR */
app.get("/api/tickets", auth, async (req, res) => {
  const data = await Ticket.find().sort({ createdAt: -1 });
  res.json(data);
});

/* CRIAR */
app.post("/api/tickets", auth, async (req, res) => {
  const t = await Ticket.create(req.body);
  res.json(t);
});

/* PUBLICO */
app.post("/api/public/tickets", async (req, res) => {
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

  res.json({ ok: true });
});

/* 🔥 UPDATE STATUS + WHATSAPP */
app.put("/api/tickets/:id", auth, async (req, res) => {

  const ticket = await Ticket.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  // 🔥 ENVIO WHATSAPP (quando mudar status)
  if (req.body.status) {
    await enviarWhatsApp(
      ticket.telefone,
      `🔔 Status do seu chamado atualizado: ${req.body.status}`
    );
  }

  res.json(ticket);
});

/* ❌ DELETE TICKET */
app.delete("/api/tickets/:id", auth, async (req, res) => {
  await Ticket.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

/* 🔥 FUNÇÃO WHATSAPP (PLACEHOLDER) */
async function enviarWhatsApp(numero, mensagem) {
  try {
    // 👉 AQUI você conecta sua API (Z-API, WPPConnect, Twilio etc.)

    console.log("📲 WhatsApp para:", numero);
    console.log("💬 Mensagem:", mensagem);

  } catch (err) {
    console.log("Erro WhatsApp:", err.message);
  }
}

/* START */
app.listen(PORT, "0.0.0.0", () => {
  console.log("Rodando na porta " + PORT);
});