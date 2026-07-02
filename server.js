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
const Cliente = require("./models/Cliente");
const Service = require("./models/Service");

const serviceRoutes = require("./routes/services");

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
  .then(async () => {

    console.log("Mongo conectado");

    await migrarClientes();

    await vincularClienteNosChamados();

  })
  .catch(err => console.log("Erro Mongo:", err));

/* ===================== MIGRAR CLIENTES ===================== */

async function migrarClientes(){

  try{

    const tickets = await Ticket.find();

    for (const t of tickets) {

  if (!t.companyId) {
    console.log("Ticket ignorado (sem companyId):", t.cliente);
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

    console.log("Migração de clientes concluída.");

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

    console.log(`Chamados vinculados: ${total}`);

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

// VERIFICA SE A EMPRESA ESTÁ ATIVA
const company = await Company.findById(user.companyId);

if(company && !company.active){

  return res.json({
    success:false,
    error:"Empresa bloqueada. Entre em contato com o suporte."
  });

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

      if(!company){

        return res.status(404).json({
          error: "Empresa não encontrada"
        });

      }

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

      if(!company){

        return res.status(404).json({
          error: "Empresa não encontrada"
        });

      }

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

    const cliente = await Cliente.findById(req.params.id);

    if(!cliente){

      return res.status(404).json({
        error:"Cliente não encontrado"
      });

    }


    const chamados = await Ticket.find({

      companyId: req.session.user.companyId,

      $or:[
        {
          clienteId: cliente._id
        },
        {
          cliente: cliente.nome
        }
      ]

    }).sort({

      createdAt:-1

    });


    res.json(chamados);


  } catch(err){

    console.log(err);

    res.status(500).json({
      error:true
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

/* ===================== TICKETS ===================== */
app.get("/api/tickets", auth, async (req, res) => {

console.log("EMPRESA LOGIN:");
console.log(req.session.user.companyId);


const tickets = await Ticket.find({
  companyId: req.session.user.companyId
}).sort({ createdAt: -1 });


console.log("TOTAL CHAMADOS:");
console.log(tickets.length);


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

  const ticket = await Ticket.create({

    companyId: req.session.user.companyId,

    numeroOS,

    clienteId: req.body.clienteId,

    cliente: req.body.cliente,

    telefone: req.body.telefone,

    cpfcnpj: req.body.cpfcnpj,

    equipamento: req.body.equipamento,

    problema: req.body.problema,

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

/* ===================== LOGOUT ===================== */
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

/* ===================== SERVICES ===================== */
app.use("/api/services", serviceRoutes);

/* ===================== START ===================== */

async function listarClientes(){

  const clientes = await Cliente.find();

  console.log("\n===== CLIENTES CADASTRADOS =====");

  clientes.forEach(c=>{

    console.log(
      c.nome,
      "|",
      c.cpfcnpj,
      "|",
      c.telefone
    );

  });

}

listarClientes();

app.listen(PORT, "0.0.0.0", () => {
  console.log("Rodando na porta " + PORT);
});