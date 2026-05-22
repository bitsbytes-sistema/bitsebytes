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

  const company =
    await Company.findById(
      req.session.user.companyId
    );

  res.json({
    user: req.session.user,
    company
  });

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

    const ticket =
      await Ticket.create({

        companyId:
          req.session.user.companyId,

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

    // remove 55 duplicado
    if(numero.startsWith("55")){

      numero =
        numero.substring(2);

    }

    let textoStatus = "";

    if(req.body.status === "aberto"){

      textoStatus =
        "Seu chamado foi aberto com sucesso e aguarda análise técnica.";

    }

    else if(req.body.status === "andamento"){

      textoStatus =
        "Seu equipamento está em análise técnica no laboratório.";

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