require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
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
/* LOGIN */
/* ===================== */
app.post("/login", async (req, res) => {

  const user = await User.findOne({
    username: req.body.username
  });

  if (!user) {
    return res.json({ success:false });
  }

  if (user.password !== req.body.password) {
    return res.json({ success:false });
  }

  res.json({
    success:true,
    user
  });
});

/* ===================== */
/* LISTAR CHAMADOS */
/* ===================== */
app.get("/api/tickets", async (req, res) => {

  const data = await Ticket.find()
    .sort({ createdAt:-1 });

  res.json(data);
});

/* ===================== */
/* CRIAR CHAMADO */
/* ===================== */
app.post("/api/tickets", async (req, res) => {

  const t = await Ticket.create(req.body);

  res.json(t);
});

/* ===================== */
/* ABRIR CHAMADO */
/* ===================== */
app.post("/abrir-chamado", async (req, res) => {

  try {

    const company = await Company.findOne({
      plan:"enterprise"
    });

    const doc = String(
      req.body.cpfcnpj
    ).replace(/\D/g, "");

    const chamadosAbertos =
      await Ticket.countDocuments({
        companyId: company?._id,
        cpfcnpj: doc,
        status: { $ne:"finalizado" }
      });

    if (chamadosAbertos >= LIMITE_CLIENTE) {

      return res.status(403).json({
        ok:false,
        error:"Você já possui 3 chamados em andamento."
      });
    }

    await Ticket.create({
      companyId: company?._id,
      cliente: req.body.cliente,
      telefone: req.body.telefone,
      cpfcnpj: doc,
      equipamento: req.body.equipamento,
      problema: req.body.problema,
      status:"aberto"
    });

    return res.json({ ok:true });

  } catch (err) {

    console.log(err);

    return res.status(500).json({
      ok:false
    });
  }
});

/* ===================== */
/* UPDATE STATUS */
/* ===================== */
app.put("/api/tickets/:id", async (req, res) => {

  try {

    await Ticket.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedAt:new Date()
      }
    );

    res.json({ ok:true });

  } catch {

    res.status(500).json({
      ok:false
    });
  }
});

/* ===================== */
/* DELETE */
/* ===================== */
app.delete("/api/tickets/:id", async (req, res) => {

  try {

    await Ticket.findByIdAndDelete(
      req.params.id
    );

    res.json({ ok:true });

  } catch {

    res.status(500).json({
      ok:false
    });
  }
});

/* ===================== */
/* START */
/* ===================== */
app.listen(PORT, "0.0.0.0", () => {
  console.log("Rodando na porta " + PORT);
});