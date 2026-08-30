require("dotenv").config();


const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");

const fs = require("fs");
const path = require("path");


const {
  executarBackup
} = require("./services/backupService");
const puppeteer =
    process.env.RENDER
        ? require("puppeteer-core")
        : require("puppeteer");

const chromium = require("@sparticuz/chromium");

const Company = require("./models/Company");
const User = require("./models/User");
const Ticket = require("./models/Ticket");
const Cliente = require("./models/Cliente");
const Service = require("./models/Service");
const Budget = require("./models/Budget");
const Notification = require("./models/Notification");
const Lembrete = require("./models/Lembrete");
const Sale = require("./models/Sale");
const Product = require("./models/Product");
const StockMovement = require("./models/StockMovement");
const PaymentMachine = require("./models/PaymentMachine");
const BackupControl = require("./models/BackupControl");

const serviceRoutes = require("./routes/services");
const productRoutes = require("./routes/products");
const stockMovementRoutes = require("./routes/stockMovements");
const saleRoutes = require("./routes/sales");
const budgetRoutes = require("./routes/budgets");
const financeiroRoutes = require("./routes/financeiro");
const notificationRoutes = require("./routes/notifications");
const lembreteRoutes = require("./routes/lembretes");
const OneSignal = require("onesignal-node");

const paymentMachineRoutes =
  require("./routes/paymentMachines");

const alertasRoutes =
require("./routes/alertas");

const oneSignalClient = new OneSignal.Client(
  process.env.ONESIGNAL_APP_ID,
  process.env.ONESIGNAL_API_KEY
);

const app = express();
const PORT = process.env.PORT || 3000;

// ===================== ONE SIGNAL TAGS =====================

async function atualizarTagsOneSignal(user){

  try {

    await fetch(
      `https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/external_id/${user._id}`,
      {
        method:"PATCH",

        headers:{
          "Content-Type":"application/json",
          "Authorization":
          `Key ${process.env.ONESIGNAL_API_KEY}`
        },

        body:JSON.stringify({

          properties:{

            tags:{

              companyId:String(user.companyId),
              userId:String(user._id),
              role:String(user.role),
              username:String(user.username)

            }

          }

        })

      }
    );


    console.log(
      "✅ Tags OneSignal atualizadas"
    );


  } catch(err){

    console.log(
      "Erro OneSignal:",
      err
    );

  }

}


/* ===================== BACKUP AUTOMÁTICO ===================== */

let backupAutomaticoEmExecucao = false;

function obterDataRondonia(data = new Date()) {

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Porto_Velho",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(data);

}

function obterHoraRondonia(data = new Date()) {

  return Number(
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        timeZone: "America/Porto_Velho",
        hour: "2-digit",
        hour12: false
      }
    ).format(data)
  );

}

async function verificarBackupAutomatico() {

  if (backupAutomaticoEmExecucao) {
    return;
  }

  try {

    const agora = new Date();

    const horaAtual =
      obterHoraRondonia(agora);

    if (horaAtual < 3) {
      return;
    }

    const hoje =
      obterDataRondonia(agora);

    const controle =
      await BackupControl.findOne({
        chave: "backup-diario"
      });

    if (
      controle &&
      controle.ultimoBackupAutomatico
    ) {

      const dataUltimoBackup =
        obterDataRondonia(
          controle.ultimoBackupAutomatico
        );

      if (dataUltimoBackup === hoje) {
        return;
      }

    }

    backupAutomaticoEmExecucao = true;

    console.log(
      "Iniciando backup automático diário..."
    );

    await BackupControl.findOneAndUpdate(
      {
        chave: "backup-diario"
      },
      {
        $set: {
          ultimaTentativa: agora
        },
        $setOnInsert: {
          chave: "backup-diario"
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    await executarBackup();

    await BackupControl.updateOne(
      {
        chave: "backup-diario"
      },
      {
        $set: {
          ultimoBackupAutomatico:
            new Date(),

          ultimaTentativa:
            new Date(),

          ultimoStatus:
            "sucesso",

          ultimoErro:
            ""
        }
      }
    );

    console.log(
      "Backup automático diário concluído."
    );

  } catch (erro) {

    console.error(
      "Erro no backup automático:",
      erro
    );

    try {

      await BackupControl.findOneAndUpdate(
        {
          chave: "backup-diario"
        },
        {
          $set: {
            ultimaTentativa:
              new Date(),

            ultimoStatus:
              "erro",

            ultimoErro:
              String(
                erro.message || erro
              )
          },

          $setOnInsert: {
            chave: "backup-diario"
          }
        },
        {
          upsert: true
        }
      );

    } catch (erroRegistro) {

      console.error(
        "Erro ao registrar falha do backup:",
        erroRegistro
      );

    }

  } finally {

    backupAutomaticoEmExecucao = false;

  }

}

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
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 1000 * 60 * 60 * 24
}
  })
);

/* ===================== STATIC ===================== */
app.use(express.static(path.join(__dirname, "public")));

/* ===================== MONGO ===================== */
mongoose.connect(process.env.MONGO_URL)
  .then(() => {

    console.log("Mongo conectado");

    setTimeout(
      verificarBackupAutomatico,
      60 * 1000
    );

    setInterval(
      verificarBackupAutomatico,
      30 * 60 * 1000
    );

    console.log(
      "Verificador de backup automático ativado."
    );

  })
  .catch(err => console.log("Erro Mongo:", err));

/* ===================== MIGRAR CLIENTES ===================== */

async function migrarClientes(){

  try{

    const tickets = await Ticket.find();

    for (const t of tickets) {

  if (!t.companyId) {
    continue;
  }

      const existe = await Cliente.findOne({

        companyId: t.companyId,

        cpfcnpj: t.cpfcnpj || "",

        telefone: t.telefone || ""

      });

      if(existe){
        continue;
      }

      const ultimo = await Cliente.findOne({

        companyId: t.companyId

      }).sort({

        codigo: -1

      });

      const codigo = ultimo ? ultimo.codigo + 1 : 1;

      await Cliente.create({

        companyId: t.companyId,

        codigo,

        nome: t.cliente || "",

        telefone: t.telefone || "",

        cpfcnpj: t.cpfcnpj || "",

        endereco: t.endereco || "",

        bairro: t.bairro || "",

        cidade: t.cidade || "",

        estado: t.estado || "",

        cep: t.cep || ""

      });

    }

  }catch(err){

    console.log("Erro na migração:", err);

  }

}

/* ===================== VINCULAR NOVOS CLIENTES ===================== */

async function vincularClienteNosChamados(){

  try{

    const chamados = await Ticket.find();

    let total = 0;

    for(const chamado of chamados){

      if(chamado.clienteId){
        continue;
      }

      const cliente = await Cliente.findOne({

        companyId: chamado.companyId,

        $or: [

          {
            cpfcnpj: chamado.cpfcnpj
          },

          {
            nome: chamado.cliente
          }

        ]

      });

      if(cliente){

        chamado.clienteId = cliente._id;

        await chamado.save();

        total++;

      }

    }

  }catch(err){

    console.log("Erro ao vincular clientes:", err);

  }

}

/* ===================== AUTH ===================== */
function auth(req, res, next){
  if(!req.session.user){
    return res.status(401).json({ error: "not_logged" });
  }
  next();
}

/* ===================== MASTER ===================== */
function masterOnly(req, res, next){

  console.log("========== MASTER CHECK ==========");
  console.log("SESSION USER:", req.session.user);
  console.log("ROLE:", req.session.user?.role);
  console.log("ROLE TYPE:", typeof req.session.user?.role);
  console.log("==================================");

  if(req.session.user?.role !== "master"){
    return res.status(403).json({
      error: "not_master",
      roleRecebida: req.session.user?.role
    });
  }

  next();
}

/* ===================== LOGIN ===================== */
app.post("/login", async (req, res) => {

  try {

    const user = await User.findOne({
      username:req.body.username
    });


    if(!user){
      return res.json({
        success:false
      });
    }


    const ok = await bcrypt.compare(
      req.body.password,
      user.password
    );


    if(!ok){
      return res.json({
        success:false
      });
    }



    const company = await Company.findById(
      user.companyId
    );


    if(company && !company.active){

      return res.json({
        success:false,
        error:
        "Empresa bloqueada. Entre em contato com o suporte."
      });

    }



    req.session.user = {

      _id:String(user._id),
      username:user.username,
      role:user.role,
      companyId:user.companyId

    };


    // ATUALIZA TAGS ONE SIGNAL
    await atualizarTagsOneSignal(user);



    req.session.save(() => {

      res.json({
        success:true
      });

    });


  } catch(err){

    console.log(err);

    res.status(500).json({
      success:false
    });

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
  active: true,
  protected: false
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

/* ===================== ADMIN USERS ===================== */
app.get("/api/admin/users", auth, masterOnly, async (req, res) => {

  try {

    const users = await User.find().lean();

    const companies = await Company.find().lean();

    const companyMap = {};

    companies.forEach(c => {
      companyMap[String(c._id)] = c.name;
    });

    const resultado = users.map(u => ({
      _id: u._id,
      username: u.username,
      role: u.role,
      companyName:
        companyMap[String(u.companyId)] ||
        "Sem empresa"
    }));

    res.json(resultado);

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});


/* ===================== ALTERAR PLANO ===================== */
app.put(
  "/api/admin/company/:id/plan",
  auth,
  masterOnly,
  async (req, res) => {

    try {

      const { plan } = req.body;

      /* =========================
         VALIDAR PLANO
      ========================= */

      if(!["free", "basic", "pro"].includes(plan)){

        return res.status(400).json({
          error: "Plano inválido."
        });

      }


      /* =========================
         BUSCAR EMPRESA
      ========================= */

      const empresaAlvo =
        await Company.findById(req.params.id);


      if(!empresaAlvo){

        return res.status(404).json({
          error: "Empresa não encontrada"
        });

      }


      /* =========================
         EMPRESA PROTEGIDA
      ========================= */

      if(empresaAlvo.protected){

        return res.status(403).json({
          error:
            "Esta empresa é protegida e não pode ter o plano alterado."
        });

      }


      /* =========================
         LIMITES DO PLANO
      ========================= */

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


      /* =========================
         ATUALIZAR EMPRESA
      ========================= */

      const company =
        await Company.findByIdAndUpdate(

          req.params.id,

          {
            plan,
            ticketLimit,
            userLimit
          },

          {
            new: true
          }

        );


      res.json({
        ok: true,
        company
      });


    } catch(err){

      console.log(err);

      res.status(500).json({
        error: true
      });

    }

  }
);

/* ===================== ALTERAR STATUS ===================== */
app.put(
  "/api/admin/company/:id/status",
  auth,
  masterOnly,
  async (req, res) => {

    try {

      /* =========================
         VALIDAR STATUS
      ========================= */

      if(typeof req.body.active !== "boolean"){

        return res.status(400).json({
          error: "Status inválido."
        });

      }


      /* =========================
         BUSCAR EMPRESA
      ========================= */

      const empresaAlvo =
        await Company.findById(req.params.id);


      if(!empresaAlvo){

        return res.status(404).json({
          error: "Empresa não encontrada"
        });

      }


      /* =========================
         EMPRESA PROTEGIDA
      ========================= */

      if(empresaAlvo.protected){

        return res.status(403).json({
          error:
            "Esta empresa é protegida e não pode ser bloqueada ou desbloqueada."
        });

      }


      /* =========================
         ALTERAR STATUS
      ========================= */

      const company =
        await Company.findByIdAndUpdate(

          req.params.id,

          {
            active: req.body.active
          },

          {
            new: true
          }

        );


      res.json({
        ok: true,
        company
      });


    } catch(err){

      console.log(err);

      res.status(500).json({
        error: true
      });

    }

  }
);


/* ===================== EXCLUIR EMPRESA ===================== */
app.delete(
  "/api/admin/company/:id",
  auth,
  masterOnly,
  async (req, res) => {

    try {

      /* =========================
         BUSCAR EMPRESA
      ========================= */

      const empresa =
        await Company.findById(req.params.id);


      if(!empresa){

        return res.status(404).json({
          error: "Empresa não encontrada."
        });

      }


      /* =========================
         EMPRESA PROTEGIDA
      ========================= */

      if(empresa.protected){

        return res.status(403).json({
          error:
            "Esta empresa é protegida e não pode ser excluída."
        });

      }


      /* =========================
         EXCLUIR DADOS DA EMPRESA
      ========================= */

      await User.deleteMany({
        companyId: empresa._id
      });

      await Ticket.deleteMany({
        companyId: empresa._id
      });

      await Cliente.deleteMany({
        companyId: empresa._id
      });

      await Service.deleteMany({
        companyId: empresa._id
      });

      await Budget.deleteMany({
        companyId: empresa._id
      });

      await Notification.deleteMany({
        companyId: empresa._id
      });

      await Lembrete.deleteMany({
        companyId: empresa._id
      });

      await Sale.deleteMany({
        companyId: empresa._id
      });

      await Product.deleteMany({
        companyId: empresa._id
      });

      await StockMovement.deleteMany({
        companyId: empresa._id
      });

      await PaymentMachine.deleteMany({
        companyId: empresa._id
      });

      await Company.findByIdAndDelete(
        empresa._id
      );


      res.json({
        ok: true,
        message:
          "Empresa excluída com sucesso."
      });


    } catch(err){

      console.log(
        "Erro ao excluir empresa:",
        err
      );

      res.status(500).json({
        error:
          "Não foi possível excluir a empresa."
      });

    }

  }
);


/* ===================== CLIENTES (NOVA COLEÇÃO) ===================== */

app.get("/api/clientes", auth, async (req, res) => {

  try {

    const clientes = await Cliente.find({
      companyId: req.session.user.companyId
    }).sort({
      nome: 1
    });

    res.json(clientes);

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== NOVO CLIENTE ===================== */

app.post("/api/clientes", auth, async (req, res) => {

  try {

    const ultimo = await Cliente.findOne({
      companyId: req.session.user.companyId
    }).sort({
      codigo: -1
    });

    const codigo = ultimo ? ultimo.codigo + 1 : 1;

    const cliente = await Cliente.create({

      companyId: req.session.user.companyId,

      codigo,

      nome: req.body.nome || "",

      telefone: req.body.telefone || "",

      aniversario: req.body.aniversario || null,

      cpfcnpj: req.body.cpfcnpj || "",

      endereco: req.body.endereco || "",

      bairro: req.body.bairro || "",

      cidade: req.body.cidade || "",

      estado: req.body.estado || "",

      cep: req.body.cep || ""

    });

    res.json(cliente);

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== CLIENTES ===================== */

app.get("/api/clientes/list", auth, async (req, res) => {

  try {

    const tickets = await Ticket.find({
      companyId: req.session.user.companyId
    });

    const clientesMap = {};

    tickets.forEach(t => {

      const chave =
        String(t.cpfcnpj || "").trim() +
        String(t.telefone || "").trim() +
        String(t.cliente || "").trim();

      if (!clientesMap[chave]) {

        clientesMap[chave] = {
          nome: String(t.cliente || "").trim(),
          telefone: String(t.telefone || "").trim(),
          cpfcnpj: String(t.cpfcnpj || "").trim(),
          endereco: String(t.endereco || "").trim(),
          bairro: String(t.bairro || "").trim(),
          cidade: String(t.cidade || "").trim(),
          estado: String(t.estado || "").trim(),
          cep: String(t.cep || "").trim()
        };

      }

    });

    res.json(Object.values(clientesMap));

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== HISTÓRICO CLIENTE ===================== */

app.get("/api/clientes/historico/:id", auth, async (req, res) => {

  try {

    const companyId =
      req.session.user.companyId;


    /* =====================================================
       CLIENTE
    ===================================================== */

    const cliente = await Cliente.findOne({

      _id: req.params.id,

      companyId

    });


    if(!cliente){

      return res.status(404).json({

        error: "Cliente não encontrado"

      });

    }


    /* =====================================================
       CHAMADOS
    ===================================================== */

    const chamados = await Ticket.find({

      companyId,

      $or: [

        {
          clienteId: cliente._id
        },

        {
          cliente: cliente.nome
        }

      ]

    }).sort({

      createdAt: -1

    });


    /* =====================================================
       VENDAS
    ===================================================== */

    const vendas = await Sale.find({

      companyId,

      clienteId: cliente._id

    })

    .populate(
      "itens.productId",
      "nome codigo"
    )

    .sort({

      createdAt: -1

    });


    /* =====================================================
       RESPOSTA
    ===================================================== */

    res.json({

      chamados,

      vendas

    });


  } catch(err){

    console.error(
      "Erro ao carregar histórico do cliente:",
      err
    );


    res.status(500).json({

      error: true,

      message:
        "Erro ao carregar histórico do cliente."

    });

  }

});

/* ===================== EDITAR CLIENTE ===================== */

app.put("/api/clientes/editar", auth, async (req, res) => {

  try {

    const {

  nomeAntigo,
  nome,
  telefone,
  aniversario,
  cpfcnpj,
  endereco,
  bairro,
  cidade,
  estado,
  cep

} = req.body;

    // Atualiza o cadastro do cliente
    await Cliente.updateOne(

      {
        companyId: req.session.user.companyId,
        nome: nomeAntigo
      },

      {
        $set: {
          nome,
          telefone,
	  aniversario,
          cpfcnpj,
          endereco,
          bairro,
          cidade,
          estado,
          cep
        }
      }

    );

    // Atualiza também todos os chamados antigos
    await Ticket.updateMany(

      {
        companyId: req.session.user.companyId,
        cliente: nomeAntigo
      },

      {
        $set: {
          cliente: nome,
          telefone,
          cpfcnpj,
          endereco,
          bairro,
          cidade,
          estado,
          cep
        }
      }

    );

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

/* ===================== SERVIÇOS PARA ORÇAMENTO ===================== */
app.get("/api/services", auth, async (req, res) => {

  try {

    const services = await Service.find({
      companyId: req.session.user.companyId,
      ativo: true
    }).sort({
      nome: 1
    });

    res.json(services);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: true
    });

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

  const ultimoTicket = await Ticket.findOne({
    companyId: req.session.user.companyId
  }).sort({
    numeroOS: -1
  });


  const numeroOS =
    ultimoTicket && ultimoTicket.numeroOS
      ? ultimoTicket.numeroOS + 1
      : 1;


  let dadosCliente = {};


  if(req.body.clienteId){

    const cliente = await Cliente.findOne({

      _id:req.body.clienteId,

      companyId:req.session.user.companyId

    });


    if(cliente){

      dadosCliente = {

        endereco: cliente.endereco || "",

        bairro: cliente.bairro || "",

        cidade: cliente.cidade || "",

        estado: cliente.estado || "",

        cep: cliente.cep || ""

      };

    }

  }



  const ticket = await Ticket.create({

    companyId: req.session.user.companyId,

    numeroOS,


    clienteId: req.body.clienteId || null,


    cliente: req.body.cliente,

    telefone: req.body.telefone,

    cpfcnpj: req.body.cpfcnpj,


    ...dadosCliente,


    equipamento: req.body.equipamento,

    problema: req.body.problema,

    observacoes: req.body.observacoes || "",

    status:"aberto"

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
    textoStatus = "Seu equipamento está pronto, aguarde que em breve entraremos em contato.";
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

/* ===================== DIAGNÓSTICO PRÉ-SERVIÇO ===================== */

/* ===================== BUSCAR DIAGNÓSTICO ===================== */

app.get("/api/tickets/:id/diagnostico", auth, async (req, res) => {

  try {

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      companyId: req.session.user.companyId
    });

    if (!ticket) {

      return res.status(404).json({
        error: "Chamado não encontrado"
      });

    }

    res.json(ticket);

  } catch (err) {

    console.error(
      "Erro ao buscar diagnóstico:",
      err
    );

    res.status(500).json({
      error: "Erro ao buscar diagnóstico"
    });

  }

});


/* ===================== SALVAR DIAGNÓSTICO ===================== */

app.put("/api/tickets/:id/diagnostico", auth, async (req, res) => {

  try {

    const situacoesPermitidas = [
      "rascunho",
      "aguardando_aprovacao",
      "aprovado",
      "recusado"
    ];

    const situacaoDiagnostico =
      req.body.situacaoDiagnostico ||
      "rascunho";

    if (
      !situacoesPermitidas.includes(
        situacaoDiagnostico
      )
    ) {

      return res.status(400).json({
        error: "Situação do diagnóstico inválida"
      });

    }

    let valorDiagnostico =
      Number(
        req.body.valorDiagnostico || 0
      );

    if (
      !Number.isFinite(valorDiagnostico) ||
      valorDiagnostico < 0
    ) {

      valorDiagnostico = 0;

    }

    const agora = new Date();

    const atualizacao = {

      diagnosticoPreServico:
        req.body.diagnosticoPreServico || "",

      servicoRecomendado:
        req.body.servicoRecomendado || "",

      pecasRecomendadas:
        req.body.pecasRecomendadas || "",

      valorDiagnostico,

      prazoEstimado:
        req.body.prazoEstimado || "",

      observacoesDiagnostico:
        req.body.observacoesDiagnostico || "",

      tecnicoDiagnostico:
        req.body.tecnicoDiagnostico || "",

      situacaoDiagnostico

    };

if (situacaoDiagnostico === "aprovado") {

  atualizacao.status = "reparo";

}


    if (
      situacaoDiagnostico !== "rascunho"
    ) {

      atualizacao.dataDiagnostico =
        agora;

    }


    if (
      situacaoDiagnostico === "aprovado" ||
      situacaoDiagnostico === "recusado"
    ) {

      atualizacao.dataRespostaDiagnostico =
        agora;

    } else {

      atualizacao.dataRespostaDiagnostico =
        null;

    }


    const ticket =
      await Ticket.findOneAndUpdate(
        {
          _id: req.params.id,
          companyId: req.session.user.companyId
        },
        {
          $set: atualizacao
        },
        {
          new: true,
          runValidators: true
        }
      );


    if (!ticket) {

      return res.status(404).json({
        error: "Chamado não encontrado"
      });

    }


    res.json({
      ok: true,
      ticket
    });

  } catch (err) {

    console.error(
      "Erro ao salvar diagnóstico:",
      err
    );

    res.status(500).json({
      error: "Erro ao salvar diagnóstico"
    });

  }

});

/* ===================== PDF DIAGNÓSTICO ===================== */

app.get("/api/tickets/:id/diagnostico/pdf", auth, async (req, res) => {

  let browser = null;

  try {

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      companyId: req.session.user.companyId
    });

    if (!ticket) {

      return res.status(404).send(
        "Chamado não encontrado"
      );

    }

    const company = await Company.findById(
      req.session.user.companyId
    );

    const formatarValor = (valor) => {

      return Number(valor || 0)
        .toLocaleString(
          "pt-BR",
          {
            style: "currency",
            currency: "BRL"
          }
        );

    };

    const formatarSituacao = (situacao) => {

      switch (situacao) {

        case "aguardando_aprovacao":
          return "Aguardando aprovação";

        case "aprovado":
          return "Aprovado pelo cliente";

        case "recusado":
          return "Recusado pelo cliente";

        default:
          return "Rascunho";

      }

    };

    const html = `

<!DOCTYPE html>

<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<style>

*{
  box-sizing:border-box;
}

body{
  font-family:Arial,Helvetica,sans-serif;
  margin:0;
  padding:0;
  color:#0f172a;
  font-size:12px;
}

.header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  border-bottom:3px solid #0f172a;
  padding-bottom:10px;
  margin-bottom:12px;
}

.empresa h1{
  margin:0;
  font-size:24px;
}

.empresa p{
  margin:4px 0 0;
  color:#475569;
}

.documento{
  text-align:right;
}

.documento h2{
  margin:0;
  font-size:20px;
}

.documento div{
  margin-top:5px;
  font-weight:bold;
}

.box{
  border:1px solid #cbd5e1;
  border-radius:8px;
  padding:10px;
  margin-bottom:7px;

  break-inside:avoid;
  page-break-inside:avoid;
}

.box h3{
  margin:0 0 7px;
  font-size:14px;
  border-bottom:1px solid #e2e8f0;
  padding-bottom:5px;
}

.grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px 24px;
}

.item{
  margin-bottom:8px;
}

.label{
  font-weight:bold;
}

.texto{
  white-space:pre-wrap;
  line-height:1.5;
}

.status{
  font-weight:bold;
  padding:10px;
  border:1px solid #cbd5e1;
  border-radius:6px;
  margin-top:8px;
}

.footer{
  margin-top:35px;
  text-align:center;
  font-size:11px;
  color:#64748b;
}

.assinaturas{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:60px;
  margin-top:30px;

  break-inside:avoid;
  page-break-inside:avoid;
}

.assinatura{
  text-align:center;
  border-top:1px solid #000;
  padding-top:6px;
}

.assinaturas{
  break-inside:avoid;
  page-break-inside:avoid;
}

</style>

</head>

<body>

<div class="header">

  <div class="empresa">

    <h1>
      ${company?.name || "Bits & Bytes Tecnology"}
    </h1>

    <p>
      ${company?.phone || ""}
    </p>

    <p>
      ${company?.email || ""}
    </p>

    <p>
      ${company?.address || ""}
    </p>

  </div>

  <div class="documento">

    <h2>
      DIAGNÓSTICO TÉCNICO
    </h2>

    <div>
      OS #${ticket.numeroOS || ""}
    </div>

    <div>
      ${new Date().toLocaleDateString(
        "pt-BR",
        {
          timeZone:"America/Cuiaba"
        }
      )}
    </div>

  </div>

</div>


<div class="box">

  <h3>Dados do Cliente</h3>

  <div class="grid">

    <div class="item">
      <span class="label">Cliente:</span>
      ${ticket.cliente || ""}
    </div>

    <div class="item">
      <span class="label">Telefone:</span>
      ${ticket.telefone || ""}
    </div>

    <div class="item">
      <span class="label">CPF/CNPJ:</span>
      ${ticket.cpfcnpj || ""}
    </div>

    <div class="item">
      <span class="label">Equipamento:</span>
      ${ticket.equipamento || ""}
    </div>

  </div>

</div>


<div class="box">

  <h3>Problema Relatado pelo Cliente</h3>

  <div class="texto">
    ${ticket.problema || "Não informado"}
  </div>

</div>


<div class="box">

  <h3>Diagnóstico Técnico</h3>

  <div class="texto">
    ${ticket.diagnosticoPreServico || "Não informado"}
  </div>

</div>


<div class="box">

  <h3>Serviço Recomendado</h3>

  <div class="texto">
    ${ticket.servicoRecomendado || "Não informado"}
  </div>

</div>


<div class="box">

  <h3>Peças / Componentes Recomendados</h3>

  <div class="texto">
    ${ticket.pecasRecomendadas || "Não informado"}
  </div>

</div>


<div class="box">

  <h3>Condições do Serviço</h3>

  <div class="grid">

    <div class="item">
      <span class="label">Valor:</span>
      ${formatarValor(ticket.valorDiagnostico)}
    </div>

    <div class="item">
      <span class="label">Prazo estimado:</span>
      ${ticket.prazoEstimado || "Não informado"}
    </div>

    <div class="item">
      <span class="label">Técnico responsável:</span>
      ${ticket.tecnicoDiagnostico || "Não informado"}
    </div>

    <div class="item">
      <span class="label">Situação:</span>
      ${formatarSituacao(ticket.situacaoDiagnostico)}
    </div>

  </div>

</div>


<div class="box">

  <h3>Observações</h3>

  <div class="texto">
    ${ticket.observacoesDiagnostico || "Nenhuma observação"}
  </div>

</div>


<div class="assinaturas">

  <div class="assinatura">
    Técnico responsável
  </div>

  <div class="assinatura">
    Cliente
  </div>

</div>


<div class="footer">
  Documento de diagnóstico técnico pré-serviço
</div>

</body>

</html>

`;

    browser = await puppeteer.launch(

      process.env.RENDER

        ? {

            executablePath:
              await chromium.executablePath(),

            args:
              chromium.args,

            headless:true

          }

        : {

            headless:true

          }

    );

    const page =
      await browser.newPage();

    await page.setContent(
      html,
      {
        waitUntil:"networkidle0"
      }
    );

    const pdf =
      await page.pdf({

        format:"A4",

        printBackground:true,

        margin:{
  top:"10mm",
  right:"12mm",
  bottom:"10mm",
  left:"12mm"
}

      });

    await browser.close();

    browser = null;

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="Diagnostico-OS-${ticket.numeroOS}.pdf"`
    );

    res.end(pdf);

  } catch (err) {

    console.error(
      "Erro ao gerar PDF do diagnóstico:",
      err
    );

    if (browser) {

      try{
        await browser.close();
      }catch{}

    }

    res.status(500).send(
      "Erro ao gerar PDF do diagnóstico"
    );

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

/* ===================== SALVAR LAUDO ===================== */
app.put("/api/tickets/:id/laudo", auth, async (req, res) => {

  try {

    const ticket = await Ticket.findOneAndUpdate(

      {
        _id: req.params.id,
        companyId: req.session.user.companyId
      },

      {
  diagnostico: req.body.diagnostico || "",
  servico: req.body.servico || "",
  conclusao: req.body.conclusao || "",
  tecnico: req.body.tecnico || "",
  laudoGerado: true,
  updatedAt: new Date()
},

      {
        new: true
      }

    );

    if(!ticket){

      return res.status(404).json({
        error: "ticket_not_found"
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

/* ===================== LISTAR LAUDOS ===================== */
app.get("/api/laudos", auth, async (req, res) => {

  try {

    const laudos = await Ticket.find({

      companyId: req.session.user.companyId,
      status: "finalizado",
      laudoGerado: true

    }).sort({
      updatedAt: -1
    });


    res.json(laudos);


  } catch(err){

    console.log(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== SERVIÇOS ===================== */

/* LISTAR */
app.get("/api/services", auth, async (req, res) => {

  try {

    const services = await Service.find({
      companyId: req.session.user.companyId
    }).sort({
      codigo: 1
    });

    res.json(services);

  } catch(err){

    console.log(err);

    res.status(500).json({
      error:true
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

// ===================== LIMITE DE CHAMADOS POR CLIENTE =====================

const chamadosAbertos = await Ticket.countDocuments({

  companyId: company._id,

  $or:[
    {
      cpfcnpj: req.body.cpfcnpj
    },
    {
      telefone: req.body.telefone
    }
  ],

  status:{
    $in:[
      "aberto",
      "andamento",
      "reparo"
    ]
  }

});

if(chamadosAbertos >= 3){

  return res.status(400).json({

    error:
    "Você já possui 3 chamados em andamento. Aguarde a finalização de um chamado antes de abrir outro."

  });

}

    const ultimoOS = await Ticket.findOne({
      companyId: company._id
    }).sort({
      numeroOS: -1
    });

    const numeroOS =
      ultimoOS && ultimoOS.numeroOS
        ? ultimoOS.numeroOS + 1
        : 1;

    const ticket = await Ticket.create({

      companyId: company._id,

      numeroOS,

      cliente: req.body.cliente,

      telefone: req.body.telefone,

      cpfcnpj: req.body.cpfcnpj,

      equipamento: req.body.equipamento,

      problema: req.body.problema,

      diagnostico: "",

      servico: "",

      conclusao: "",

      tecnico: "",

      laudoGerado: false,

      status: "aberto"

    });


// ===================== NOTIFICAÇÃO SISTEMA =====================

const novaNotificacao = await Notification.create({

  companyId: company._id,

  tipo: "novo_chamado",

  titulo: "Novo chamado",

  mensagem:
    `${ticket.cliente} abriu um novo chamado para ${ticket.equipamento}.`,

  ticketId: ticket._id,

  lida: false

});


console.log(
  "NOTIFICAÇÃO CRIADA:",
  novaNotificacao._id
);

// Envia Push para o celular
try {

const response = await oneSignalClient.createNotification({

    app_id: process.env.ONESIGNAL_APP_ID,

    included_segments: ["All"],

    headings:{
      en:"🔧 Novo chamado recebido"
    },

    contents:{
      en:`${ticket.cliente} abriu um chamado para ${ticket.equipamento}.`
    },

    url: `${process.env.APP_URL}/chamados.html?id=${ticket._id}`

});

console.log("ONESIGNAL RESPONSE:", response);

} 

catch (err) {

    console.error("ERRO ONESIGNAL:");

    console.error(err);

    console.error(err.body);

}

    let numero =
      String(ticket.telefone || "")
      .replace(/\D/g, "");

    if(numero.startsWith("55")){
      numero = numero.substring(2);
    }

    let whatsapp = null;

    if(numero.length >= 10){

      const dataFormatada =
        new Date().toLocaleString(
          "pt-BR",
          {
            timeZone: "America/Cuiaba"
          }
        );

      const msg = encodeURIComponent(

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

/* ===================== DELETE ===================== */
app.delete("/api/tickets/:id", auth, async (req, res) => {
  await Ticket.findOneAndDelete({
    _id: req.params.id,
    companyId: req.session.user.companyId
  });

  res.json({ ok: true });
});

/* ===================== BUSCAR CHAMADO ===================== */

app.get("/api/tickets/:id", auth, async (req, res) => {

  try {

    const ticket = await Ticket.findOne({

      _id: req.params.id,

      companyId: req.session.user.companyId

    });

    if (!ticket) {

      return res.status(404).json({
        error: "Chamado não encontrado"
      });

    }

    res.json(ticket);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Erro ao buscar chamado"
    });

  }

});

/* ===================== GERAR OS PDF PROFISSIONAL ===================== */

app.get("/api/tickets/:id/pdf", auth, async (req,res)=>{

try{


const ticket = await Ticket.findOne({

_id:req.params.id,

companyId:req.session.user.companyId

});


if(!ticket){

return res.status(404).send(
"Chamado não encontrado"
);

}


const company = await Company.findById(
req.session.user.companyId
);

const logoPath = path.join(
  __dirname,
  "public",
  "logo.png"
);


let logoHTML = "";

if(fs.existsSync(logoPath)){

  const logoBase64 = fs.readFileSync(
    logoPath,
    "base64"
  );

  logoHTML = `

  <img 
  src="data:image/png;base64,${logoBase64}"
  style="
  width:80px;
  height:auto;
  "
  />

  `;

}



const html = `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">


<style>


body{

font-family:Arial, Helvetica, sans-serif;

padding:15px;

color:#333;

font-size:12px;

}

h3{

margin:0 0 5px 0;
font-size:14px;

}


.header{

display:flex;

align-items:center;

gap:15px;

border-bottom:2px solid ${company.primaryColor};

padding-bottom:10px;

}


.logo img{

width:80px;

height:auto;

}


.company{

display:flex;

flex-direction:column;

}


.company h1{

margin:0;

font-size:18px;

color:${company.secondaryColor};

}


.company p{

margin:2px 0;

font-size:11px;

}


.title{

text-align:center;

margin-top:25px;

background:${company.primaryColor};

color:white;

padding:10px;

border-radius:8px;

}


.box{

border:1px solid #ddd;

padding:8px;

margin-top:8px;

border-radius:5px;

}


.label{

font-weight:bold;

color:${company.secondaryColor};

}


.grid{

display:grid;

grid-template-columns:1fr 1fr;

gap:10px;

}


.footer{

margin-top:40px;

font-size:12px;

text-align:center;

}


</style>


</head>


<body>


<div class="header">

<div class="logo">

${logoHTML}

</div>


<div class="company">

<h1>
${company.name}
</h1>

<p>
CNPJ: ${company.cnpj || ""}
</p>

<p>
${company.phone || ""} | ${company.email || ""}
</p>

<p>
${company.address || ""}
</p>

</div>


</div>


<div class="title">

ORDEM DE SERVIÇO - ENTRADA

</div>



<div class="box">

<div class="grid">


<p>
<span class="label">
Número OS:
</span>

${ticket.numeroOS}

</p>


<p>

<span class="label">
Data:
</span>

${new Date(ticket.createdAt).toLocaleDateString("pt-BR", {
  timeZone: "America/Cuiaba"
})}

</p>


<p>

<span class="label">
Status:
</span>

${ticket.status.toUpperCase()}

</p>


</div>

</div>




<div class="box">

<h3>
Dados do Cliente
</h3>


<p>

<span class="label">
Nome:
</span>

${ticket.cliente}

</p>


<p>

<span class="label">
Telefone:
</span>

${ticket.telefone}

</p>


<p>

<span class="label">
CPF/CNPJ:
</span>

${ticket.cpfcnpj || ""}

</p>


<p>

<span class="label">
Endereço:
</span>

${ticket.endereco || ""}

</p>


<p>

<span class="label">
Cidade:
</span>

${ticket.cidade || ""}

-

${ticket.estado || ""}

</p>


</div>





<div class="box">

<h3>
Equipamento
</h3>


<p>

<span class="label">
Equipamento recebido:
</span>

${ticket.equipamento}

</p>


<p>

<span class="label">
Problema informado:
</span>

</p>


<p>
${ticket.problema}
</p>


</div>

<div class="box">

<h3>
Observações da Entrada
</h3>

<p>
${ticket.observacoes || "Nenhuma observação"}
</p>

</div>

<br><br>


<table width="100%">

<tr>

<td>
<b>OS:</b> ${ticket.numeroOS}
</td>

<td>
<b>Data:</b> ${new Date(ticket.createdAt).toLocaleDateString("pt-BR", {
  timeZone: "America/Cuiaba"
})}
</td>

<td>
<b>Status:</b> ${ticket.status.toUpperCase()}
</td>

</tr>

</table>


<div class="footer">


${company.reportFooter || ""}


</div>



</body>

</html>


`;

const browser = await puppeteer.launch(

process.env.RENDER

? {

executablePath:
await chromium.executablePath(),

args: chromium.args,

headless:true

}

: {

headless:true

}

);

const page = await browser.newPage();


await page.setContent(html, {

waitUntil:"networkidle0"

});

const pdf = await page.pdf({

format:"A4",

printBackground:true,

margin:{

top:"10mm",
right:"10mm",
bottom:"10mm",
left:"10mm"

}

});



await browser.close();



res.setHeader(
"Content-Type",
"application/pdf"
);



res.setHeader(
"Content-Disposition",
`inline; filename="OS-${ticket.numeroOS}.pdf"`
);



res.setHeader(
"Content-Length",
pdf.length
);



res.end(pdf);



}catch(err){


console.log("ERRO PDF:", err);


res.status(500).json({

erro: err.message

});


}


});


/* ===================== ROTAS ===================== */

app.use("/api/services", serviceRoutes);

app.use("/api/budgets", budgetRoutes);

app.use("/api/financeiro", financeiroRoutes);

app.use("/api/products", productRoutes);

app.use("/api/notifications", auth, notificationRoutes);

app.use("/api/lembretes", lembreteRoutes);

app.use("/api/alertas", require("./routes/alertas"));

app.use("/api/stock-movements", stockMovementRoutes);

app.use("/api/sales", saleRoutes);

app.use(
  "/api/payment-machines",
  auth,
  paymentMachineRoutes
);

/* ===================== ALTERAR SENHA ===================== */

app.put("/api/security/password", auth, async (req, res) => {

  try {

    const {
      senhaAtual,
      novaSenha,
      confirmarSenha
    } = req.body;


    /* =====================================================
       VALIDAÇÕES
    ===================================================== */

    if (
      !senhaAtual ||
      !novaSenha ||
      !confirmarSenha
    ) {

      return res.status(400).json({
        error: "Preencha todos os campos."
      });

    }


    if (novaSenha !== confirmarSenha) {

      return res.status(400).json({
        error: "A nova senha e a confirmação não coincidem."
      });

    }


    if (novaSenha.length < 6) {

      return res.status(400).json({
        error: "A nova senha deve ter pelo menos 6 caracteres."
      });

    }


    if (novaSenha === senhaAtual) {

      return res.status(400).json({
        error: "A nova senha deve ser diferente da senha atual."
      });

    }


    /* =====================================================
       BUSCAR USUÁRIO
    ===================================================== */

    const user = await User.findById(
      req.session.user._id
    );


    if (!user) {

      return res.status(404).json({
        error: "Usuário não encontrado."
      });

    }


    /* =====================================================
       VERIFICAR SENHA ATUAL
    ===================================================== */

    const senhaCorreta =
      await bcrypt.compare(
        senhaAtual,
        user.password
      );


    if (!senhaCorreta) {

      return res.status(401).json({
        error: "A senha atual está incorreta."
      });

    }


    /* =====================================================
       GERAR NOVA SENHA
    ===================================================== */

    const senhaHash =
      await bcrypt.hash(
        novaSenha,
        10
      );


    user.password =
      senhaHash;


    await user.save();


    /* =====================================================
       ENCERRAR SESSÃO
    ===================================================== */

    req.session.destroy(() => {

      return res.json({
        success: true,
        message:
          "Senha alterada com sucesso. Faça login novamente."
      });

    });


  } catch (err) {

    console.error(
      "Erro ao alterar senha:",
      err
    );


    res.status(500).json({
      error:
        "Erro interno ao alterar a senha."
    });

  }

});

/* ===================== BACKUP MANUAL ===================== */

app.post("/api/security/backup", auth, async (req, res) => {

  try {

    /* =====================================================
       PERMISSÃO
       Apenas MASTER e ADMIN podem executar backup manual.
    ===================================================== */

    const role = req.session.user.role;

    if (
      role !== "master" &&
      role !== "admin"
    ) {

      return res.status(403).json({
        error: "Sem permissão para executar backup."
      });

    }


    /* =====================================================
       EXECUTAR BACKUP
    ===================================================== */

    const resultado =
      await executarBackup();


    /* =====================================================
       SUCESSO
    ===================================================== */

    return res.json({

      success: true,

      message:
        "Backup realizado e enviado para o Google Drive com sucesso.",

      backup: {

        banco: {

          id:
            resultado.banco?.id || null,

          nome:
            resultado.banco?.name || null,

          tamanho:
            resultado.banco?.size || null

        },

        sistema: {

          id:
            resultado.sistema?.id || null,

          nome:
            resultado.sistema?.name || null,

          tamanho:
            resultado.sistema?.size || null

        }

      }

    });


  } catch (erro) {

    console.error(
      "Erro ao executar backup manual:",
      erro
    );


    return res.status(500).json({

      success: false,

      error:
        "Não foi possível realizar o backup.",

      details:
        erro.message

    });

  }

});

/* ===================== LOGOUT ===================== */

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});


/* ===================== START ===================== */

app.listen(PORT, "0.0.0.0", () => {
  console.log("Rodando na porta " + PORT);
});
