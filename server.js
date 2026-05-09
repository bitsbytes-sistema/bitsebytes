const bcrypt = require("bcrypt");
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const LIMITE_CLIENTE = 3;

/* ===================== */
/* MIDDLEWARE */
/* ===================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);

app.use(express.static(path.join(__dirname, "public")));

/* ===================== */
/* MONGO */
/* ===================== */
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("✔ Mongo conectado");
    console.log("DB:", mongoose.connection.name);
  })
  .catch((err) => console.log("❌ ERRO MONGO:", err));

/* ===================== */
/* SESSÃO */
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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

/* ===================== */
/* SCHEMAS */
/* ===================== */
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  companyId: String,
});

const ticketSchema = new mongoose.Schema(
  {
    companyId: String,
    cliente: String,
    telefone: String,
    cpfcnpj: String,
    equipamento: String,
    problema: String,
    status: { type: String, default: "aberto" },
  },
  { timestamps: true }
);

const User =
  mongoose.models.User || mongoose.model("User", userSchema);

const Ticket =
  mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema);

/* ===================== */
/* LOGIN CORRIGIDO */
/* ===================== */
app.post("/login", async (req, res) => {
  try {
    const username = req.body.username?.trim().toLowerCase();
    const password = req.body.password;

    console.log("LOGIN RECEBIDO:", { username, password });

    const user = await User.findOne({ username });

    console.log("USER FOUND:", user);

    if (!user) {
      return res.json({ success: false, msg: "Usuário não existe" });
    }

    const senhaOk = await bcrypt.compare(password, user.password);

    console.log("SENHA OK:", senhaOk);

    if (!senhaOk) {
      return res.json({ success: false, msg: "Senha inválida" });
    }

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ success: false });

      req.session.user = {
        id: user._id,
        username: user.username,
        role: user.role,
        companyId: user.companyId,
      };

      return res.json({ success: true });
    });
  } catch (err) {
    console.log("ERRO LOGIN:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

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
/* TICKETS */
/* ===================== */
app.get("/api/tickets", auth, async (req, res) => {
  const data = await Ticket.find({}).sort({ createdAt: -1 });
  res.json(data);
});

/* ===================== */
/* START */
/* ===================== */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Rodando na porta " + PORT);
});