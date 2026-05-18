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

/* ===================== */
/* TRUST PROXY */
/* ===================== */
app.set("trust proxy", 1);

/* ===================== */
/* MIDDLEWARE */
/* ===================== */
app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

/* ===================== */
/* SESSION */
/* ===================== */
app.use(
  session({

    secret:
      process.env.SESSION_SECRET ||
      "segredo_forte",

    resave: false,

    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl:
        process.env.MONGO_URL
    }),

    cookie: {

      httpOnly: true,

      secure: false,

      sameSite: "lax",

      maxAge:
        1000 * 60 * 60 * 24

    }

  })
);

/* ===================== */
/* STATIC */
/* ===================== */
app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

/* ===================== */
/* MONGO */
/* ===================== */
mongoose
.connect(process.env.MONGO_URL)
.then(() => {

  console.log(
    "Mongo conectado"
  );

})
.catch((err) => {

  console.log(
    "Erro Mongo:",
    err
  );

});

/* ===================== */
/* AUTH */
/* ===================== */
function auth(
  req,
  res,
  next
){

  if(
    !req.session.user
  ){

    return res
    .status(401)
    .json({
      error: "not_logged"
    });

  }

  next();

}

/* ===================== */
/* LOGIN */
/* ===================== */
app.post(
  "/login",
  async (
    req,
    res
  ) => {

    try {

      const user =
        await User.findOne({

          username:
            req.body.username

        });

      if(!user){

        return res.json({
          success: false
        });

      }

      const ok =
        await bcrypt.compare(
          req.body.password,
          user.password
        );

      if(!ok){

        return res.json({
          success: false
        });

      }

      req.session.user = {

        _id:
          String(user._id),

        username:
          user.username,

        role:
          user.role,

        companyId:
          user.companyId

      };

      req.session.save((err) => {

        if(err){
          console.log(err);
        }

        res.json({
          success: true
        });

      });

    } catch(err){

      console.log(err);

      res.status(500)
      .json({
        success: false
      });

    }

  }
);

/* ===================== */
/* ME */
/* ===================== */
app.get(
  "/me",
  auth,
  async (
    req,
    res
  ) => {

    const company =
      await Company.findById(
        req.session.user.companyId
      );

    res.json({

      user:
        req.session.user,

      company

    });

  }
);

/* ===================== */
/* DASHBOARD */
/* ===================== */
app.get(
  "/dashboard",
  (
    req,
    res
  ) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "dashboard.html"
      )
    );

  }
);

/* ===================== */
/* LISTAR TICKETS */
/* ===================== */
app.get(
  "/api/tickets",
  auth,
  async (
    req,
    res
  ) => {

    try {

      const tickets =
        await Ticket.find({

          companyId:
            req.session.user.companyId

        })
        .sort({
          createdAt: -1
        });

      res.json(
        tickets
      );

    } catch(err){

      console.log(err);

      res.status(500)
      .json({
        error: "erro_listar"
      });

    }

  }
);

/* ===================== */
/* CRIAR TICKET */
/* ===================== */
app.post(
  "/api/tickets",
  auth,
  async (
    req,
    res
  ) => {

    try {

      const ticket =

const ativos =
  await Ticket.countDocuments({

    cpfcnpj:
      req.body.cpfcnpj,

    status: {
      $in: [
        "aberto",
        "andamento"
      ]
    }

  });

if(ativos >= 3){

  return res.status(400).json({

    error:
      "Você já possui 3 chamados em aberto."

  });

}

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

          status:
            "aberto"

        });

      res.json(
        ticket
      );

    } catch(err){

      console.log(err);

      res.status(500)
      .json({
        ok: false
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
  async (
    req,
    res
  ) => {

    try {

      const ticket =
        await Ticket.findOneAndUpdate(

          {
            _id:
              req.params.id,

            companyId:
              req.session.user.companyId
          },

          {
            status:
              req.body.status,

            updatedAt:
              new Date()
          },

          {
            new: true
          }

        );

      if(!ticket){

        return res
        .status(404)
        .json({
          error: true
        });

      }

      const telefone =
        String(
          ticket.telefone || ""
        )
        .replace(/\D/g, "");

      const dataAtual =
        new Date()
        .toLocaleString(
          "pt-BR",
          {
            timeZone:
              "America/Cuiaba"
          }
        );

      let mensagemFinal = "";

      if(
        ticket.status ===
        "finalizado"
      ){

        mensagemFinal =
`Seu equipamento já está pronto para retirada!

Retire conosco ou entre em contato para mais informações.`;

      }

      else if(
        ticket.status ===
        "andamento"
      ){

        mensagemFinal =
`Seu equipamento está em manutenção pela nossa equipe técnica.

Em breve teremos novas atualizações.`;

      }

      else {

        mensagemFinal =
`Seu chamado foi aberto com sucesso e aguarda análise técnica.`;

      }

      const mensagem =
`Bits & Bytes Assistência Técnica

Status do seu atendimento:
${String(ticket.status).toUpperCase()}

Cliente:
${ticket.cliente}

CPF/CNPJ:
${ticket.cpfcnpj || "Não informado"}

Equipamento:
${ticket.equipamento}

Problema informado:
${ticket.problema || "Não informado"}

Atualizado em:
${dataAtual}

${mensagemFinal}`;

      let whatsapp = null;

      if(telefone){

        whatsapp =
`https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;

      }

      res.json({

        ok: true,

        whatsapp

      });

    } catch(err){

      console.log(err);

      res.status(500)
      .json({
        error: true
      });

    }

  }
);

/* ===================== */
/* DELETE */
/* ===================== */
app.delete(
  "/api/tickets/:id",
  auth,
  async (
    req,
    res
  ) => {

    try {

      await Ticket.findOneAndDelete({

        _id:
          req.params.id,

        companyId:
          req.session.user.companyId

      });

      res.json({
        ok: true
      });

    } catch(err){

      console.log(err);

      res.status(500)
      .json({
        ok: false
      });

    }

  }
);

/* ===================== */
/* LOGOUT */
/* ===================== */
app.get(
  "/logout",
  (
    req,
    res
  ) => {

    req.session.destroy(() => {

      res.redirect("/");

    });

  }
);

/* ===================== */
/* START */
/* ===================== */
app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "Rodando na porta " +
      PORT
    );

  }
);