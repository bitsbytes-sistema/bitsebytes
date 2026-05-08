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

/* ===================== */
/* MONGO */
/* ===================== */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✔ Mongo conectado"))
  .catch(err => console.log("❌ ERRO MONGO:", err));

/* ===================== */
/* SCHEMAS */
/* ===================== */
const companySchema = new mongoose.Schema({
  name: String,
  plan: String
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  companyId: String
});

const ticketSchema = new mongoose.Schema(
  {
    companyId: String,
    cliente: String,
    telefone: String,
    cpfcnpj: String,
    equipamento: String,
    problema: String,
    status: {
      type: String,
      default: "aberto"
    }
  },
  {
    timestamps: true
  }
);

/* ===================== */
/* MODELS */
/* ===================== */
const Company =
  mongoose.models.Company ||
  mongoose.model("Company", companySchema);

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

const Ticket =
  mongoose.models.Ticket ||
  mongoose.model("Ticket", ticketSchema);

/* ===================== */
/* AUTH */
/* ===================== */
function auth(req, res, next) {

  if (!req.session.user) {
    return res.status(401).json({
      error: "not_logged"
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
      username: req.body.username
    });

    if (!user) {
      return res.json({
        success: false
      });
    }

    if (user.password !== req.body.password) {
      return res.json({
        success: false
      });
    }

    req.session.user = {
      id: user._id,
      username: user.username,
      role: user.role,
      companyId: user.companyId
    };

    return res.json({
      success: true,
      user
    });

  } catch (err) {

    console.log("❌ LOGIN ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

/* ===================== */
/* LOGOUT */
/* ===================== */
app.get("/logout", (req, res) => {

  req.session.destroy(() => {
    res.redirect("/");
  });

});

/* ===================== */
/* LISTAR CHAMADOS */
/* ===================== */
app.get("/api/tickets", auth, async (req, res) => {

  try {

    const data = await Ticket
      .find({})
      .sort({ createdAt: -1 });

    return res.json(data);

  } catch (err) {

    console.log("❌ ERRO /api/tickets:", err);

    return res.status(500).json({
      error: true,
      message: err.message,
      stack: err.stack
    });
  }
});

/* ===================== */
/* ABRIR CHAMADO */
/* ===================== */
app.post("/abrir-chamado", async (req, res) => {

  try {

    const company = await Company.findOne({
      plan: "enterprise"
    });

    if (!company) {

      return res.status(400).json({
        ok: false,
        error: "Empresa não encontrada"
      });
    }

    const doc = String(
      req.body.cpfcnpj || ""
    ).replace(/\D/g, "");

    const count = await Ticket.countDocuments({
      companyId: company._id,
      cpfcnpj: doc,
      status: {
        $ne: "finalizado"
      }
    });

    if (count >= LIMITE_CLIENTE) {

      return res.status(403).json({
        ok: false,
        error: "Limite de chamados atingido"
      });
    }

    await Ticket.create({
      companyId: company._id,
      cliente: req.body.cliente || "",
      telefone: req.body.telefone || "",
      cpfcnpj: doc,
      equipamento: req.body.equipamento || "",
      problema: req.body.problema || "",
      status: "aberto"
    });

    return res.json({
      ok: true
    });

  } catch (err) {

    console.log("❌ ERRO /abrir-chamado:", err);

    return res.status(500).json({
      ok: false,
      message: err.message,
      stack: err.stack
    });
  }
});

/* ===================== */
/* UPDATE STATUS */
/* ===================== */
app.put("/api/tickets/:id", auth, async (req, res) => {

  try {

    const t = await Ticket.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body
      },
      {
        new: true
      }
    );

    if (!t) {

      return res.status(404).json({
        error: true
      });
    }

    return res.json({
      ok: true
    });

  } catch (err) {

    console.log("❌ UPDATE ERROR:", err);

    return res.status(500).json({
      error: true,
      message: err.message
    });
  }
});

/* ===================== */
/* DELETE */
/* ===================== */
app.delete("/api/tickets/:id", auth, async (req, res) => {

  try {

    await Ticket.findByIdAndDelete(
      req.params.id
    );

    return res.json({
      ok: true
    });

  } catch (err) {

    console.log("❌ DELETE ERROR:", err);

    return res.status(500).json({
      ok: false,
      message: err.message
    });
  }
});

/* ===================== */
/* START */
/* ===================== */
app.listen(PORT, "0.0.0.0", () => {

  console.log(
    "🚀 Rodando na porta " + PORT
  );

});