require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const bcrypt = require("bcrypt");

const Company = require("./models/Company");
const User = require("./models/User");
const Ticket = require("./models/Ticket");

const app = express();
const PORT = process.env.PORT || 3000;

/* ===================== TRUST PROXY ===================== */
app.set("trust proxy", 1);

/* ===================== MIDDLEWARE ===================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===================== SESSION ===================== */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "segredo_forte",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URL
    }),
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

/* ===================== STATIC ===================== */
app.use(express.static(path.join(__dirname, "public")));

/* ===================== MONGO ===================== */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Mongo conectado"))
  .catch(err => console.log("Erro Mongo:", err));

/* ===================== AUTH ===================== */
function auth(req, res, next){
  if(!req.session.user){
    return res.status(401).json({ error: "not_logged" });
  }
  next();
}

/* ===================== MASTER ===================== */
function masterOnly(req, res, next){
  if(req.session.user.role !== "master"){
    return res.status(403).json({ error: "not_master" });
  }
  next();
}

/* ===================== LOGIN ===================== */
app.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });

    if(!user){
      return res.json({ success: false });
    }

    const ok = await bcrypt.compare(req.body.password, user.password);

    if(!ok){
      return res.json({ success: false });
    }

    req.session.user = {
      _id: String(user._id),
      username: user.username,
      role: user.role,
      companyId: user.companyId
    };

    req.session.save(() => {
      res.json({ success: true });
    });

  } catch(err){
    console.log(err);
    res.status(500).json({ success: false });
  }
});

/* ===================== ME ===================== */
app.get("/me", auth, async (req, res) => {
  try {
    const company = await Company.findById(req.session.user.companyId);
    res.json({ user: req.session.user, company });

  } catch(err){
    console.log(err);
    res.status(500).json({ error: true });
  }
});

/* ===================== DASHBOARD ===================== */
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

/* ===================== ADMIN ===================== */
app.get("/admin", auth, masterOnly, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/* ===================== ADMIN STATS ===================== */
app.get("/api/admin/stats", auth, masterOnly, async (req, res) => {
  try {
    const empresas = await Company.countDocuments();
    const usuarios = await User.countDocuments();
    const chamados = await Ticket.countDocuments();
    const companies = await Company.find();

    res.json({ empresas, usuarios, chamados, companies });

  } catch(err){
    console.log(err);
    res.status(500).json({ error: true });
  }
});

/* ===================== CREATE COMPANY ===================== */
app.post("/api/admin/create-company", auth, masterOnly, async (req, res) => {
  try {
    const { name, username, password, plan } = req.body;

    const existe = await User.findOne({ username });

    if(existe){
      return res.status(400).json({ error: "Usuário já existe" });
    }

    let ticketLimit = 10;
    let userLimit = 1;

    if(plan === "basic"){
      ticketLimit = 30;
      userLimit = 3;
    }

    if(plan === "pro"){
      ticketLimit = -1;
      userLimit = -1;
    }

    const company = await Company.create({
      name,
      plan: plan || "free",
      ticketLimit,
      userLimit,
      active: true
    });

    const hash = await bcrypt.hash(password, 10);

    await User.create({
      username,
      password: hash,
      role: "admin",
      companyId: company._id
    });

    res.json({ ok: true });

  } catch(err){
    console.log(err);
    res.status(500).json({ error: true });
  }
});

/* ===================== TICKETS ===================== */
app.get("/api/tickets", auth, async (req, res) => {
  const tickets = await Ticket.find({
    companyId: req.session.user.companyId
  }).sort({ createdAt: -1 });

  res.json(tickets);
});

app.post("/api/tickets", auth, async (req, res) => {
  const ticket = await Ticket.create({
    companyId: req.session.user.companyId,
    ...req.body,
    status: "aberto"
  });

  res.json(ticket);
});

/* ===================== STATUS UPDATE ===================== */
app.put("/api/tickets/:id", auth, async (req, res) => {

  const statusValidos = ["aberto", "andamento", "reparo", "finalizado"];

  if(!statusValidos.includes(req.body.status)){
    return res.status(400).json({ error: "status_invalido" });
  }

  const ticket = await Ticket.findOneAndUpdate(
    {
      _id: req.params.id,
      companyId: req.session.user.companyId
    },
    {
      status: req.body.status,
      updatedAt: new Date()
    },
    { new: true }
  );

  if(!ticket){
    return res.status(404).json({ error: true });
  }

  const numero = String(ticket.telefone || "").replace(/\D/g, "");

  let textoStatus = "";

  if(req.body.status === "aberto"){
    textoStatus = "Seu chamado foi aberto e aguarda análise.";
  }
  if(req.body.status === "andamento"){
    textoStatus = "Seu equipamento está em análise.";
  }
  if(req.body.status === "reparo"){
    textoStatus = "Seu equipamento está em manutenção na bancada.";
  }
  if(req.body.status === "finalizado"){
    textoStatus = "Seu equipamento está pronto para retirada.";
  }

  let whatsapp = null;

  if(numero.length >= 10){

    const data = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Cuiaba"
    });

    const msg = encodeURIComponent(
`Bits & Bytes Assistência Técnica

ORDEM DE SERVIÇO:
${ticket.numeroOS}

Status:
${req.body.status.toUpperCase()}

Cliente:
${ticket.cliente}

CPF/CNPJ:
${ticket.cpfcnpj || "Não informado"}

Equipamento:
${ticket.equipamento || "Não informado"}

Problema informado:
${ticket.problema || "Não informado"}

Atualizado em:
${data}

${textoStatus}`
    );

    whatsapp = `https://wa.me/55${numero}?text=${msg}`;
  }

  res.json({ ok: true, whatsapp });
});

/* ===================== LAUDO (CORRIGIDO DE VERDADE) ===================== */
app.get("/api/tickets/:id/laudo", auth, async (req, res) => {

  try {

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      companyId: req.session.user.companyId
    });

    if(!ticket){
      return res.status(404).send("Laudo não encontrado");
    }

    const data = new Date(ticket.updatedAt || ticket.createdAt)
      .toLocaleString("pt-BR", { timeZone: "America/Cuiaba" });

    res.setHeader("Content-Type", "text/html; charset=utf-8");

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Laudo OS ${ticket.numeroOS}</title>
</head>

<body style="font-family:Arial;padding:20px;">

<h2>Bits & Bytes Assistência Técnica</h2>

<p><b>ORDEM DE SERVIÇO:</b> ${ticket.numeroOS}</p>

<p><b>Status:</b> ${ticket.status.toUpperCase()}</p>

<p><b>Cliente:</b> ${ticket.cliente}</p>
<p><b>CPF/CNPJ:</b> ${ticket.cpfcnpj || "Não informado"}</p>

<p><b>Equipamento:</b> ${ticket.equipamento || "Não informado"}</p>

<p><b>Problema:</b> ${ticket.problema || "Não informado"}</p>

<p><b>Diagnóstico:</b> ${ticket.diagnostico || ""}</p>

<p><b>Serviço:</b> ${ticket.servico || ""}</p>

<p><b>Conclusão:</b> ${ticket.conclusao || ""}</p>

<p><b>Técnico:</b> ${ticket.tecnico || ""}</p>

<p><b>Atualizado em:</b> ${data}</p>

</body>
</html>
    `);

  } catch(err){
    console.log(err);
    res.status(500).send("Erro ao gerar laudo");
  }

});

/* ===================== LAUDO ===================== */
app.get("/api/tickets/:id/laudo", auth, async (req, res) => {

  try {

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      companyId: req.session.user.companyId
    });

    if(!ticket){
      return res.status(404).json({
        error: "Laudo não encontrado"
      });
    }

    res.json(ticket);

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});


/* ===================== DELETE ===================== */
app.delete("/api/tickets/:id", auth, async (req, res) => {
  await Ticket.findOneAndDelete({
    _id: req.params.id,
    companyId: req.session.user.companyId
  });

  res.json({ ok: true });
});

/* ===================== LOGOUT ===================== */
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

/* ===================== START ===================== */
app.listen(PORT, "0.0.0.0", () => {
  console.log("Rodando na porta " + PORT);
});