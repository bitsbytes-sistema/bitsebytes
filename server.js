require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

const LIMITE_CLIENTE = 3;

console.log("ENV MONGO_URL:", process.env.MONGO_URL);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* SESSION */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "segredo",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URL
    }),
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

/* MONGO */
mongoose
  .connect(process.env.MONGO_URL)
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

/* SESSION */
app.get("/session", async (req, res) => {
  if (!req.session.user) {
    return res.json({ logged: false });
  }

  try {
    const user = await User.findById(req.session.user._id);
    if (!user) return res.json({ logged: false });

    const company = await Company.findById(user.companyId);

    return res.json({
      logged: true,
      user,
      company
    });

  } catch (err) {
    console.log(err);
    return res.json({ logged: false });
  }
});

/* LOGIN */
app.post("/login", async (req, res) => {
  const user = await User.findOne({ username: req.body.username });

  if (!user) return res.json({ success: false });

  const ok = await bcrypt.compare(req.body.password, user.password);

  if (!ok) return res.json({ success: false });

  req.session.user = user;
  res.json({ success: true });
});

/* LOGOUT */
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

/* TICKETS */
app.get("/api/tickets", async (req, res) => {
  const data = await Ticket.find().sort({ createdAt: -1 });
  res.json(data);
});

/* ABRIR CHAMADO */
app.post("/abrir-chamado", async (req, res) => {
  try {
    const company = await Company.findOne({
      name: "Bits & Bytes Teste"
    });

    if (!company) {
      return res.json({ ok: false, error: "empresa não encontrada" });
    }

    const doc = String(req.body.cpfcnpj).replace(/\D/g, "");

    const count = await Ticket.countDocuments({
      companyId: company._id,
      cpfcnpj: doc,
      status: { $ne: "finalizado" }
    });

    if (count >= LIMITE_CLIENTE) {
      return res.json({
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
    console.log(err);
    return res.json({ ok: false });
  }
});

/* START */
app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor rodando na porta " + PORT);
});