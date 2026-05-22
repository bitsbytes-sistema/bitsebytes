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
app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/* ===================== MONGO ===================== */
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Mongo conectado");
  })
  .catch(err => {
    console.log("Erro Mongo:", err);
  });

/* ===================== AUTH ===================== */
function auth(req, res, next){

  if(!req.session.user){

    return res.status(401).json({
      error: "not_logged"
    });

  }

  next();

}

/* ===================== MASTER ===================== */
function masterOnly(req, res, next){

  if(req.session.user.role !== "master"){

    return res.status(403).json({
      error: "not_master"
    });

  }

  next();

}

/* ===================== LOGIN ===================== */
app.post("/login", async (req, res) => {

  try {

    const user = await User.findOne({
      username: req.body.username
    });

    if(!user){

      return res.json({
        success: false
      });

    }

    const ok = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if(!ok){

      return res.json({
        success: false
      });

    }

    req.session.user = {

      _id: String(user._id),

      username: user.username,

      role: user.role,

      companyId: user.companyId

    };

    req.session.save(() => {

      res.json({
        success: true
      });

    });

  } catch(err){

    console.log(err);

    res.status(500).json({
      success: false
    });

  }

});

/* ===================== ME ===================== */
app.get("/me", auth, async (req, res) => {

  try {

    const company =
      await Company.findById(
        req.session.user.companyId
      );

    res.json({
      user: req.session.user,
      company
    });

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== DASHBOARD ===================== */
app.get("/dashboard", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "dashboard.html"
    )
  );

});

/* ===================== ADMIN ===================== */
app.get("/admin", auth, masterOnly, (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "admin.html"
    )
  );

});

/* ===================== ADMIN STATS ===================== */
app.get("/api/admin/stats", auth, masterOnly, async (req, res) => {

  try {

    const empresas =
      await Company.countDocuments();

    const usuarios =
      await User.countDocuments();

    const chamados =
      await Ticket.countDocuments();

    const companies =
      await Company.find();

    res.json({

      empresas,
      usuarios,
      chamados,
      companies

    });

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== CREATE COMPANY ===================== */
app.post("/api/admin/create-company", auth, masterOnly, async (req, res) => {

  try {

    const {
      name,
      username,
      password,
      plan
    } = req.body;

    if(
      !name ||
      !username ||
      !password
    ){

      return res.status(400).json({
        error: "Preencha todos os campos"
      });

    }

    const existe =
      await User.findOne({
        username
      });

    if(existe){

      return res.status(400).json({
        error: "Usuário já existe"
      });

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

    const company =
      await Company.create({

        name,

        plan: plan || "free",

        ticketLimit,

        userLimit,

        active: true

      });

    const hash =
      await bcrypt.hash(password, 10);

    await User.create({

      username,

      password: hash,

      role: "admin",

      companyId: company._id

    });

    res.json({
      ok: true
    });

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== ALTERAR PLANO ===================== */
app.put("/api/admin/company/:id/plan", auth, masterOnly, async (req, res) => {

  try {

    const planos = {

      free: {
        plan: "free",
        ticketLimit: 10,
        userLimit: 1
      },

      basic: {
        plan: "basic",
        ticketLimit: 30,
        userLimit: 3
      },

      pro: {
        plan: "pro",
        ticketLimit: -1,
        userLimit: -1
      }

    };

    const plano =
      planos[req.body.plan];

    if(!plano){

      return res.status(400).json({
        error: "Plano inválido"
      });

    }

    await Company.findByIdAndUpdate(
      req.params.id,
      plano
    );

    res.json({
      ok: true
    });

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== LISTAR TICKETS ===================== */
app.get("/api/tickets", auth, async (req, res) => {

  try {

    const tickets =
      await Ticket.find({

        companyId:
          req.session.user.companyId

      }).sort({
        createdAt: -1
      });

    res.json(tickets);

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: "erro_listar"
    });

  }

});

/* ===================== CRIAR TICKET ===================== */
app.post("/api/tickets", auth, async (req, res) => {

  try {

    const company =
      await Company.findById(
        req.session.user.companyId
      );

    const totalTickets =
      await Ticket.countDocuments({

        companyId:
          req.session.user.companyId

      });

    if(
      company.ticketLimit !== -1 &&
      totalTickets >= company.ticketLimit
    ){

      return res.status(400).json({
        error: "Limite do plano atingido."
      });

    }

    const ultimoOS =
      await Ticket.findOne({
        companyId:
          req.session.user.companyId
      }).sort({
        numeroOS: -1
      });

    const numeroOS =
      ultimoOS && ultimoOS.numeroOS
        ? ultimoOS.numeroOS + 1
        : 1;

    const ticket =
      await Ticket.create({

        companyId:
          req.session.user.companyId,

        numeroOS,

        cliente:
          req.body.cliente,

        telefone:
          req.body.telefone,

        cpfcnpj:
          req.body.cpfcnpj,

        equipamento:
          req.body.equipamento,

        problema:
          req.body.problema,

        diagnostico: "",

        servico: "",

        conclusao: "",

        tecnico: "",

        laudoGerado: false,

        status: "aberto"

      });

    res.json(ticket);

  } catch(err){

    console.log(err);

    res.status(500).json({
      ok: false
    });

  }

});

/* ===================== ABRIR CHAMADO PÚBLICO ===================== */
app.post("/abrir-chamado", async (req, res) => {

  try {

    const company = await Company.findOne();

    if(!company){

      return res.status(404).json({
        error: "Empresa não encontrada"
      });

    }

    const ultimoOS =
      await Ticket.findOne({
        companyId: company._id
      }).sort({
        numeroOS: -1
      });

    const numeroOS =
      ultimoOS && ultimoOS.numeroOS
        ? ultimoOS.numeroOS + 1
        : 1;

    const ticket =
      await Ticket.create({

        companyId: company._id,

        numeroOS,

        cliente:
          req.body.cliente,

        telefone:
          req.body.telefone,

        cpfcnpj:
          req.body.cpfcnpj,

        equipamento:
          req.body.equipamento,

        problema:
          req.body.problema,

        diagnostico: "",

        servico: "",

        conclusao: "",

        tecnico: "",

        laudoGerado: false,

        status: "aberto"

      });

    let numero =
      String(ticket.telefone || "")
      .replace(/\D/g, "");

    if(numero.startsWith("55")){

      numero =
        numero.substring(2);

    }

    let whatsapp = null;

    if(numero.length >= 10){

      const dataFormatada =
        new Date().toLocaleString(
          "pt-BR",
          {
            timeZone:
              "America/Cuiaba"
          }
        );

      const msg =
        encodeURIComponent(

`Bits & Bytes Assistência Técnica

ORDEM DE SERVIÇO:
${ticket.numeroOS}

Status do seu atendimento:
ABERTO

Cliente:
${ticket.cliente}

CPF/CNPJ:
${ticket.cpfcnpj || "Não informado"}

Equipamento:
${ticket.equipamento}

Problema informado:
${ticket.problema}

Atualizado em:
${dataFormatada}

Seu chamado foi aberto com sucesso e aguarda análise da nossa equipe técnica.`

        );

      whatsapp =
        `https://wa.me/55${numero}?text=${msg}`;

    }

    res.json({
      ok: true,
      whatsapp
    });

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== UPDATE STATUS ===================== */
app.put("/api/tickets/:id", auth, async (req, res) => {

  try {

    const ticket =
      await Ticket.findOneAndUpdate(

        {
          _id: req.params.id,
          companyId:
            req.session.user.companyId
        },

        {
          status: req.body.status,
          updatedAt: new Date()
        },

        {
          new: true
        }

      );

    if(!ticket){

      return res.status(404).json({
        error: true
      });

    }

    let whatsapp = null;

    let numero =
      String(ticket.telefone || "")
      .replace(/\D/g, "");

    if(numero.startsWith("55")){

      numero =
        numero.substring(2);

    }

    let textoStatus = "";

    if(req.body.status === "aberto"){

      textoStatus =
        "Seu chamado foi aberto com sucesso e aguarda análise da nossa equipe técnica.";

    }

    else if(req.body.status === "andamento"){

      textoStatus =
        "Seu equipamento está em análise pela nossa equipe.";

    }

     else if(req.body.status === "reparo"){

      textoStatus =
        "Seu equipamento está na bancada em manutenção.";

    }

    else if(req.body.status === "finalizado"){

      textoStatus =
        "Seu equipamento já está pronto para retirada!\n\nRetire conosco ou entre em contato para mais informações.";

    }

    if(numero.length >= 10){

      const dataFormatada =
        new Date().toLocaleString(
          "pt-BR",
          {
            timeZone:
              "America/Cuiaba"
          }
        );

      const msg =
        encodeURIComponent(

`Bits & Bytes Assistência Técnica

ORDEM DE SERVIÇO:
${ticket.numeroOS || ""}

Status do seu atendimento:
${req.body.status.toUpperCase()}

Cliente:
${ticket.cliente}

CPF/CNPJ:
${ticket.cpfcnpj || "Não informado"}

Equipamento:
${ticket.equipamento}

Problema informado:
${ticket.problema}

Atualizado em:
${dataFormatada}

${textoStatus}`

        );

      whatsapp =
        `https://wa.me/55${numero}?text=${msg}`;

    }

    res.json({

      ok: true,

      whatsapp

    });

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== SALVAR LAUDO ===================== */
app.put("/api/tickets/:id/laudo", auth, async (req, res) => {

  try {

    const ticket =
      await Ticket.findOneAndUpdate(

        {
          _id: req.params.id,
          companyId:
            req.session.user.companyId
        },

        {
          diagnostico:
            req.body.diagnostico || "",

          servico:
            req.body.servico || "",

          conclusao:
            req.body.conclusao || "",

          tecnico:
            req.body.tecnico || "",

          laudoGerado: true,

          updatedAt:
            new Date()
        },

        {
          new: true
        }

      );

    if(!ticket){

      return res.status(404).json({
        error: true
      });

    }

    res.json({
      ok: true,
      ticket
    });

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== GERAR LAUDO ===================== */
app.get("/api/tickets/:id/laudo", auth, async (req, res) => {

  try {

    const ticket =
      await Ticket.findOne({
        _id: req.params.id,
        companyId:
          req.session.user.companyId
      });

    if(!ticket){
      return res.status(404).send("Laudo não encontrado");
    }

    const dataAtual =
      new Date(ticket.updatedAt || ticket.createdAt)
      .toLocaleString("pt-BR", {
        timeZone: "America/Cuiaba"
      });

    // 🔥 ADICIONADO (CORREÇÃO IMPORTANTE)
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    res.send(`

<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">

<title>
Laudo Técnico OS ${ticket.numeroOS || ""}
</title>

<style>

body{
  font-family:Arial;
  background:#f2f2f2;
  margin:0;
  padding:20px;
}

.laudo{
  max-width:900px;
  margin:auto;
  background:white;
  padding:40px;
  border-radius:10px;
  box-shadow:0 2px 10px rgba(0,0,0,0.1);
}

.topo{
  display:flex;
  justify-content:space-between;
  align-items:center;
  border-bottom:3px solid #2c2c44;
  padding-bottom:20px;
  margin-bottom:30px;
}

.logo{
  font-size:32px;
  font-weight:bold;
  color:#2c2c44;
}

.os{
  text-align:right;
}

h2{
  color:#2c2c44;
  margin-top:30px;
}

.box{
  border:1px solid #ccc;
  border-radius:8px;
  padding:15px;
  margin-top:10px;
  background:#fafafa;
  white-space:pre-wrap;
}

.footer{
  margin-top:50px;
  text-align:center;
  color:#777;
  font-size:14px;
}

.print{
  margin-bottom:20px;
  text-align:center;
}

button{
  padding:12px 20px;
  background:#2c2c44;
  color:white;
  border:none;
  border-radius:6px;
  cursor:pointer;
}

@media print{

  .print{
    display:none;
  }

  body{
    background:white;
    padding:0;
  }

  .laudo{
    box-shadow:none;
  }

}

</style>
</head>

<body>

<div class="print">
  <button onclick="window.print()">
    Imprimir / Salvar PDF
  </button>
</div>

<div class="laudo">

  <div class="topo">

    <div class="logo">
      Bits & Bytes
      <br>
      <span style="font-size:16px;font-weight:normal;">
        Assistência Técnica Especializada
      </span>
    </div>

    <div class="os">

      <b>ORDEM DE SERVIÇO</b>

      <br><br>

      Nº:
      <b>${ticket.numeroOS || ""}</b>

      <br>

      Data:
      ${dataAtual}

    </div>

  </div>

  <h2>Dados do Cliente</h2>

  <div class="box">

    <b>Cliente:</b>
    ${ticket.cliente || "Não informado"}

    <br><br>

    <b>Telefone:</b>
    ${ticket.telefone || "Não informado"}

    <br><br>

    <b>CPF/CNPJ:</b>
    ${ticket.cpfcnpj || "Não informado"}

  </div>

  <h2>Equipamento</h2>

  <div class="box">
    ${ticket.equipamento || "Não informado"}
  </div>

  <h2>Problema Relatado</h2>

  <div class="box">
    ${ticket.problema || "Não informado"}
  </div>

  <h2>Diagnóstico Técnico</h2>

  <div class="box">
    ${ticket.diagnostico || "Não informado"}
  </div>

  <h2>Serviço Executado</h2>

  <div class="box">
    ${ticket.servico || "Não informado"}
  </div>

  <h2>Conclusão Técnica</h2>

  <div class="box">
    ${ticket.conclusao || "Não informado"}
  </div>

  <h2>Técnico Responsável</h2>

  <div class="box">
    ${ticket.tecnico || "Não informado"}
  </div>

  <div class="footer">

    Bits & Bytes Assistência Técnica
    <br>
    Documento gerado automaticamente pelo sistema

  </div>

</div>

</body>
</html>

    `);

  } catch(err){
    console.log(err);
    res.status(500).send("Erro ao gerar laudo");
  }

});

/* ===================== DELETE ===================== */
app.delete("/api/tickets/:id", auth, async (req, res) => {

  try {

    await Ticket.findOneAndDelete({

      _id: req.params.id,

      companyId:
        req.session.user.companyId

    });

    res.json({
      ok: true
    });

  } catch(err){

    console.log(err);

    res.status(500).json({
      ok: false
    });

  }

});

/* ===================== LOGOUT ===================== */
app.get("/logout", (req, res) => {

  req.session.destroy(() => {

    res.redirect("/");

  });

});

/* ===================== START ===================== */
app.listen(PORT, "0.0.0.0", () => {

  console.log(
    "Rodando na porta " + PORT
  );

});