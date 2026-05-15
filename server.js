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
/* TRUST PROXY */
/* ===================== */

app.set("trust proxy", 1);

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
      secure: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use(express.static(path.join(__dirname, "public")));

/* ===================== */
/* MONGO */
/* ===================== */

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("Mongo conectado"))
  .catch((err) => console.log("ERRO MONGO:", err));

/* ===================== */
/* MODELS */
/* ===================== */

const Company = mongoose.model("Company", {
  name: String,
  plan: String,
});

const User = mongoose.model("User", {
  username: String,
  password: String,
  role: String,
  companyId: String,
});

const Ticket = mongoose.model("Ticket", {
  companyId: String,

  cliente: String,
  telefone: String,
  cpfcnpj: String,

  equipamento: String,
  problema: String,

  status: {
    type: String,
    default: "aberto",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: Date,
});

/* ===================== */
/* DATA */
/* ===================== */

function getDataHora() {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    hour12: false,
  });
}

/* ===================== */
/* AUTH */
/* ===================== */

function auth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: "not_logged",
    });
  }

  next();
}

/* ===================== */
/* LOGIN */
/* ===================== */

app.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.body.username,
    });

    if (!user) {
      return res.json({
        success: false,
      });
    }

    const ok = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if (!ok) {
      return res.json({
        success: false,
      });
    }

    req.session.user = {
      _id: user._id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
    };

    req.session.save(() => {
      res.json({
        success: true,
      });
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
    });

  }
});

/* ===================== */
/* USER */
/* ===================== */

app.get("/me", auth, async (req, res) => {

  const company =
    await Company.findById(
      req.session.user.companyId
    );

  res.json({
    user: req.session.user,
    company,
  });

});

/* ===================== */
/* DASHBOARD */
/* ===================== */

app.get("/dashboard", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "dashboard.html"
    )
  );
});

/* ===================== */
/* LISTAR CHAMADOS */
/* ===================== */

app.get(
  "/api/tickets",
  auth,
  async (req, res) => {

    const data =
      await Ticket.find({
        companyId:
          req.session.user.companyId,
      })
      .sort({
        createdAt: -1,
      });

    res.json(data);

  }
);

/* ===================== */
/* CRIAR CHAMADO */
/* ===================== */

app.post(
  "/api/tickets",
  auth,
  async (req, res) => {

    try {

      const company =
        await Company.findById(
          req.session.user.companyId
        );

      if (!company) {

        return res.status(404).json({
          ok: false,
          error: "Empresa não encontrada",
        });

      }

      const t =
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

          status: "aberto",

        });

      res.json(t);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        ok: false,
      });

    }

  }
);

/* ===================== */
/* UPDATE STATUS */
/* ===================== */

app.put(
  "/api/tickets/:id",
  auth,
  async (req, res) => {

    const t =
      await Ticket.findOneAndUpdate(
        {
          _id: req.params.id,

          companyId:
            req.session.user.companyId,
        },

        {
          ...req.body,
          updatedAt: new Date(),
        },

        {
          new: true,
        }
      );

    if (!t) {

      return res.status(404).json({
        error: true,
      });

    }

    const telefone =
      String(t.telefone || "")
      .replace(/\D/g, "");

    if (!telefone) {

      return res.json({
        ok: true,
        whatsapp: null,
      });

    }

    let tipoDoc = "Documento";

    const doc =
      String(t.cpfcnpj || "")
      .replace(/\D/g, "");

    if (doc.length === 11) {
      tipoDoc = "CPF";
    }

    if (doc.length === 14) {
      tipoDoc = "CNPJ";
    }

    let msgFinal = "";

    if (t.status === "finalizado") {

      msgFinal =
`Seu equipamento já está pronto para retirada!
Retire conosco ou entre em contato para mais informações.`;

    } else {

      msgFinal =
`Acompanhe seu atendimento em andamento com nossa equipe.
Qualquer atualização será informada por aqui.`;

    }

    const msg =
`
Bits & Bytes Assistência Técnica

Status do seu atendimento:
${String(t.status).toUpperCase()}

Cliente: ${t.cliente}

${tipoDoc}: ${t.cpfcnpj || "Não informado"}

Equipamento: ${t.equipamento}

Problema informado:
${t.problema || "Não informado"}

Atualizado em:
${getDataHora()}

${msgFinal}
`.trim();

    const whatsapp =
      `https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`;

    return res.json({
      ok: true,
      whatsapp,
    });

  }
);

/* ===================== */
/* DELETE */
/* ===================== */

app.delete(
  "/api/tickets/:id",
  auth,
  async (req, res) => {

    try {

      await Ticket.findOneAndDelete({

        _id: req.params.id,

        companyId:
          req.session.user.companyId,

      });

      res.json({
        ok: true,
      });

    } catch {

      res.status(500).json({
        ok: false,
      });

    }

  }
);

/* ===================== */
/* LOGOUT */
/* ===================== */

app.get("/logout", (req, res) => {

  req.session.destroy(() => {

    res.redirect("/");

  });

});

/* ===================== */
/* START */
/* ===================== */

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    "Rodando na porta " + PORT
  );

});