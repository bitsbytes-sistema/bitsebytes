require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ===================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* ===================== MONGO ===================== */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Mongo conectado"))
  .catch(err => console.log("Erro Mongo:", err));

/* ===================== MODELS ===================== */
const User = mongoose.model("User", {
  username: String,
  password: String,
  role: String
});

const Ticket = mongoose.model("Ticket", {
  cliente: String,
  telefone: String,
  cpfcnpj: String,
  equipamento: String,
  problema: String,
  status: { type: String, default: "aberto" },
  createdAt: { type: Date, default: Date.now }
});

/* ===================== LOGIN ===================== */
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user || user.password !== password) {
      return res.json({ success: false });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.log("ERRO LOGIN:", err);
    res.status(500).json({ success: false });
  }
});

/* ===================== LISTAR ===================== */
app.get("/api/tickets", async (req, res) => {
  try {
    const data = await Ticket.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    console.log("ERRO GET TICKETS:", err);
    res.status(500).json({ error: true });
  }
});

/* ===================== CRIAR ===================== */
app.post("/abrir-chamado", async (req, res) => {
  try {
    await Ticket.create(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.log("ERRO CRIAR:", err);
    res.status(500).json({ ok: false });
  }
});

/* ===================== UPDATE ===================== */
app.put("/api/tickets/:id", async (req, res) => {
  try {
    await Ticket.findByIdAndUpdate(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    console.log("ERRO UPDATE:", err);
    res.status(500).json({ ok: false });
  }
});

/* ===================== DELETE ===================== */
app.delete("/api/tickets/:id", async (req, res) => {
  try {
    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.log("ERRO DELETE:", err);
    res.status(500).json({ ok: false });
  }
});

/* ===================== START ===================== */
app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor rodando na porta " + PORT);
});