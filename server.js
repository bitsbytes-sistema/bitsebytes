require("dotenv").config();


const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const multer = require("multer");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} = require("@aws-sdk/client-s3");

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
const AuditLog = require("./models/AuditLog");

const serviceRoutes = require("./routes/services");
const productRoutes = require("./routes/products");
const stockMovementRoutes = require("./routes/stockMovements");
const saleRoutes = require("./routes/sales");
const budgetRoutes = require("./routes/budgets");
const financeiroRoutes = require("./routes/financeiro");
const relatoriosRoutes = require("./routes/relatorios");
const auditoriaRoutes = require("./routes/auditoria");
const notificationRoutes = require("./routes/notifications");
const lembreteRoutes = require("./routes/lembretes");
const mensagensProgramadasRoutes = require("./routes/mensagensProgramadas");
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
      "? Tags OneSignal atualizadas"
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

/* ===================== FOTOS DOS CHAMADOS - R2 ===================== */

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const uploadFotoChamado = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 10
  },

  fileFilter: (req, file, cb) => {
    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif"
    ];

    if (!tiposPermitidos.includes(file.mimetype)) {
      return cb(
        new Error("Formato de imagem não permitido.")
      );
    }

    cb(null, true);
  }
});

/* ===================== MIDDLEWARE ===================== */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

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

/* ===================== PAGINAS PROTEGIDAS POR PERMISSAO ===================== */

const PAGINAS_PERMISSOES = {
  "/dashboard.html": "dashboard",

  "/clientes.html": "clientes",

  "/chamados.html": "chamados",
  "/diagnostico.html": "chamados",

  "/orcamentos.html": "orcamentos",
  "/orcamento.html": "orcamentos",
  "/novo-orcamento.html": "orcamentos",

  "/services.html": "servicos",

  "/laudos.html": "laudos",
  "/laudo.html": "laudos",

  "/estoque.html": "estoque",
  "/produto.html": "estoque",
  "/novo-produto.html": "estoque",

  "/vendas.html": "vendas",
  "/venda.html": "vendas",

  "/financeiro.html": "financeiro",

  "/lembretes.html": "lembretes",

  "/relatorios.html": "relatorios",



  "/configuracoes.html": "configuracoes"
};


for (
  const [pagina, modulo]
  of Object.entries(PAGINAS_PERMISSOES)
) {

  app.get(
    pagina,
    auth,
    requirePermissao(modulo),
    (req, res) => {

      res.sendFile(
        path.join(
          __dirname,
          "public",
          pagina.substring(1)
        )
      );

    }
  );

}


/* ===================== PROTECAO AUDITORIA ===================== */
app.get(
  "/auditoria.html",
  auth,
  adminEmpresaOnly,
  requirePermissao("auditoria"),
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "auditoria.html"
      )
    );

  }
);


/* ===================== PROTECAO PAINEL MASTER ===================== */
app.get("/master.html", auth, masterOnly, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "master.html"));
});

app.get("/admin.html", auth, masterOnly, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});


/* ===================== STATIC ===================== */
app.use(
  express.static(
    path.join(__dirname, "public"),
    {
      setHeaders: (res, filePath) => {

        if(filePath.toLowerCase().endsWith(".html")){

          res.setHeader(
            "Cache-Control",
            "no-cache, no-store, must-revalidate"
          );

          res.setHeader(
            "Pragma",
            "no-cache"
          );

          res.setHeader(
            "Expires",
            "0"
          );

        }

      }
    }
  )
);

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

/* ===================== PERMISSAO DE MODULO ===================== */
function requirePermissao(modulo) {

  return async function(req, res, next) {

    try {

      if (!req.session.user) {
        return res.status(401).json({
          error: "not_logged"
        });
      }

      const user = await User.findById(
        req.session.user._id
      );

      if (!user) {
        return res.status(401).json({
          error: "user_not_found"
        });
      }

      const permissoes =
        permissoesCompletasUsuario(user);

      if (permissoes[modulo] !== true) {
        return res.status(403).json({
          error: "permission_denied",
          modulo
        });
      }

      req.usuarioAtual = user;
      req.permissoesUsuario = permissoes;

      next();

    } catch (err) {

      console.error(
        "ERRO AO VERIFICAR PERMISSAO:",
        err
      );

      return res.status(500).json({
        error: "permission_check_error"
      });

    }

  };

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

    if (user.ativo === false) {

      return res.status(403).json({
        success: false,
        error: "Usuário desativado. Entre em contato com o administrador."
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
      nome:user.nome || user.username,
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


/* ===================== ADMINISTRACAO DA EMPRESA ===================== */
function adminEmpresaOnly(req, res, next){

  const role =
    String(req.session.user?.role || "").toLowerCase();

  if(
    role !== "master" &&
    role !== "admin"
  ){
    return res.status(403).json({
      error: "Sem permissão para gerenciar usuários."
    });
  }

  next();
}


async function validarAutorizacaoAdministrativa(req){

  const companyId =
    String(req.session.user.companyId);

  const adminUsername =
    String(req.body.adminUsername || '').trim();

  const adminPassword =
    String(req.body.adminPassword || '');

  if(!adminUsername || !adminPassword){
    return {
      ok: false,
      status: 400,
      error: 'Informe o usuário e a senha do administrador.'
    };
  }

  const administrador = await User.findOne({
    username: adminUsername
  });

  if(
    !administrador ||
    String(administrador.companyId) !== companyId
  ){
    return {
      ok: false,
      status: 401,
      error: 'Administrador ou senha inválidos.'
    };
  }

  const perfil =
    String(administrador.role || '').toLowerCase();

  if(perfil !== 'admin' && perfil !== 'master'){
    return {
      ok: false,
      status: 403,
      error: 'O usuário informado não possui permissão administrativa.'
    };
  }

  const senhaCorreta =
    await bcrypt.compare(
      adminPassword,
      administrador.password
    );

  if(!senhaCorreta){
    return {
      ok: false,
      status: 401,
      error: 'Administrador ou senha inválidos.'
    };
  }

  return {
    ok: true,
    administrador
  };
}/* ===================== USUARIOS DA EMPRESA ===================== */
app.get(
  "/api/usuarios",
  auth,
  adminEmpresaOnly,
  async (req, res) => {

    try {

      const companyId =
        String(req.session.user.companyId);

      const usuariosBrutos =
        await User.collection.find(
          {},
          {
            projection: {
              password: 0,
              alertasIgnorados: 0
            }
          }
        ).toArray();

      const usuarios =
        usuariosBrutos
          .filter(usuario =>
            String(usuario.companyId) === companyId
          )
          .sort((a, b) => {

            const nomeA =
              String(
                a.nome ||
                a.username ||
                ""
              ).toLocaleLowerCase("pt-BR");

            const nomeB =
              String(
                b.nome ||
                b.username ||
                ""
              ).toLocaleLowerCase("pt-BR");

            return nomeA.localeCompare(
              nomeB,
              "pt-BR"
            );

          });

      const company =
        await Company.findById(
          req.session.user.companyId
        )
        .select("name plan userLimit")
        .lean();

      if (!company) {

        return res.status(404).json({
          ok: false,
          error: "Empresa não encontrada."
        });

      }

      res.json({
        ok: true,

        empresa: {
          _id: String(company._id),
          nome: company.name || "",
          plano: company.plan || "free",
          limiteUsuarios:
            Number(company.userLimit ?? 1)
        },

        total: usuarios.length,

        usuarios: usuarios.map(usuario => ({
          _id: String(usuario._id),
          nome:
            usuario.nome ||
            usuario.username ||
            "",
          username:
            usuario.username || "",
          role:
            usuario.role || "user",
          criadoEm:
            usuario.createdAt || null,
          atualizadoEm:
            usuario.updatedAt || null,
          ativo:
            usuario.ativo !== false,
          usuarioAtual:
            String(usuario._id) ===
            String(req.session.user._id)
        }))
      });

    } catch (err) {

      console.log(
        "ERRO AO LISTAR USUARIOS:",
        err
      );

      res.status(500).json({
        ok: false,
        error: "Erro ao carregar usuários."
      });

    }

  }
);


/* ===================== CRIAR USUARIO DA EMPRESA ===================== */
app.post(
  "/api/usuarios",
  auth,
  adminEmpresaOnly,
  async (req, res) => {

    try {

      const nome =
        String(req.body.nome || "").trim();

      const username =
        String(req.body.username || "")
          .trim()
          .toLowerCase();

      const password =
        String(req.body.password || "");

      const role =
        String(req.body.role || "")
          .trim()
          .toLowerCase();

      const companyId =
        String(req.session.user.companyId);

      /* ===================== VALIDACOES ===================== */

      if (!nome) {

        return res.status(400).json({
          ok: false,
          error: "Informe o nome do usuário."
        });

      }

      if (!username) {

        return res.status(400).json({
          ok: false,
          error: "Informe o usuário de login."
        });

      }

      if (username.length < 3) {

        return res.status(400).json({
          ok: false,
          error: "O usuário de login deve possuir pelo menos 3 caracteres."
        });

      }

      if (!/^[a-z0-9._-]+$/.test(username)) {

        return res.status(400).json({
          ok: false,
          error: "O usuário de login pode conter apenas letras, números, ponto, hífen e underline."
        });

      }

      if (password.length < 6) {

        return res.status(400).json({
          ok: false,
          error: "A senha deve possuir pelo menos 6 caracteres."
        });

      }

      if (
        role !== "admin" &&
        role !== "tech"
      ) {

        return res.status(400).json({
          ok: false,
          error: "Perfil de usuário inválido."
        });

      }

      /* ===================== EMPRESA ===================== */

      const company =
        await Company.findById(
          req.session.user.companyId
        );

      if (!company) {

        return res.status(404).json({
          ok: false,
          error: "Empresa não encontrada."
        });

      }

      if (company.active === false) {

        return res.status(403).json({
          ok: false,
          error: "Empresa bloqueada."
        });

      }

      /* ===================== USERNAME UNICO ===================== */

      const usuarioExistente =
        await User.findOne({
          username
        });

      if (usuarioExistente) {

        return res.status(409).json({
          ok: false,
          error: "Este usuário de login já está em uso."
        });

      }

      /* ===================== LIMITE DO PLANO ===================== */

      const usuariosBrutos =
        await User.collection.find(
          {},
          {
            projection: {
              companyId: 1,
              ativo: 1
            }
          }
        ).toArray();

      const totalUsuariosAtivos =
        usuariosBrutos.filter(usuario =>
          String(usuario.companyId) === companyId &&
          usuario.ativo !== false
        ).length;

      const limiteUsuarios =
        Number(company.userLimit ?? 1);

      if (
        limiteUsuarios !== -1 &&
        totalUsuariosAtivos >= limiteUsuarios
      ) {

        return res.status(403).json({
          ok: false,
          error:
            `Limite de usuários ativos do plano atingido (${limiteUsuarios}).`
        });

      }

      /* ===================== CRIAR USUARIO ===================== */

      const hash =
        await bcrypt.hash(
          password,
          10
        );

      const novoUsuario =
        await User.create({
          nome,
          username,
          password: hash,
          role,
          companyId:
            req.session.user.companyId
        });

      console.log(
        "USUARIO CRIADO:",
        username,
        "EMPRESA:",
        companyId,
        "POR:",
        req.session.user.username
      );

      res.status(201).json({
        ok: true,
        message: "Usuário criado com sucesso.",

        usuario: {
          _id:
            String(novoUsuario._id),

          nome:
            novoUsuario.nome,

          username:
            novoUsuario.username,

          role:
            novoUsuario.role
        }
      });

    } catch (err) {

      console.log(
        "ERRO AO CRIAR USUARIO:",
        err
      );

      if (err && err.code === 11000) {

        return res.status(409).json({
          ok: false,
          error: "Este usuário de login já está em uso."
        });

      }

      res.status(500).json({
        ok: false,
        error: "Erro ao criar usuário."
      });

    }

  }
);


/* ===================== EDITAR USUARIO DA EMPRESA ===================== */
app.put(
  "/api/usuarios/:id",
  auth,
  adminEmpresaOnly,
  async (req, res) => {

    try {

      const usuarioId =
        String(req.params.id || "").trim();

      const nome =
        String(req.body.nome || "").trim();

      const username =
        String(req.body.username || "")
          .trim()
          .toLowerCase();

      const role =
        String(req.body.role || "")
          .trim()
          .toLowerCase();

      const companyId =
        String(req.session.user.companyId);

      /* ===================== VALIDACOES ===================== */

      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {

        return res.status(400).json({
          ok: false,
          error: "Usuário inválido."
        });

      }

      if (!nome) {

        return res.status(400).json({
          ok: false,
          error: "Informe o nome do usuário."
        });

      }

      if (!username) {

        return res.status(400).json({
          ok: false,
          error: "Informe o usuário de login."
        });

      }

      if (username.length < 3) {

        return res.status(400).json({
          ok: false,
          error: "O usuário de login deve possuir pelo menos 3 caracteres."
        });

      }

      if (!/^[a-z0-9._-]+$/.test(username)) {

        return res.status(400).json({
          ok: false,
          error: "O usuário de login pode conter apenas letras, números, ponto, hífen e underline."
        });

      }

      /* ===================== LOCALIZAR USUARIO ===================== */

      const usuario =
        await User.findById(usuarioId);

      if (!usuario) {

        return res.status(404).json({
          ok: false,
          error: "Usuário não encontrado."
        });

      }

      if (
        String(usuario.companyId) !==
        companyId
      ) {

        return res.status(403).json({
          ok: false,
          error: "Usuário não pertence à sua empresa."
        });

      }

      /* ===================== PROTEGER MASTER ===================== */

      if (
        String(usuario.role || "").toLowerCase() ===
        "master"
      ) {

        if (
          role &&
          role !== "master"
        ) {

          return res.status(403).json({
            ok: false,
            error: "O perfil Master não pode ser alterado."
          });

        }

      }
      else {

        if (
          role !== "admin" &&
          role !== "tech"
        ) {

          return res.status(400).json({
            ok: false,
            error: "Perfil de usuário inválido."
          });

        }

      }

      /* ===================== USERNAME UNICO ===================== */

      const usuarioMesmoLogin =
        await User.findOne({
          username
        });

      if (
        usuarioMesmoLogin &&
        String(usuarioMesmoLogin._id) !==
        String(usuario._id)
      ) {

        return res.status(409).json({
          ok: false,
          error: "Este usuário de login já está em uso."
        });

      }

      /* ===================== ATUALIZAR ===================== */

      const dadosAnteriores = {
        nome:
          usuario.nome || "",
        username:
          usuario.username || "",
        role:
          usuario.role || ""
      };

      usuario.nome = nome;
      usuario.username = username;

      if (
        String(usuario.role || "").toLowerCase() !==
        "master"
      ) {
        usuario.role = role;
      }

      await usuario.save();

      /* Atualiza a sessao caso o administrador edite a si proprio */
      if (
        String(usuario._id) ===
        String(req.session.user._id)
      ) {

        req.session.user.nome =
          usuario.nome;

        req.session.user.username =
          usuario.username;

        req.session.user.role =
          usuario.role;

      }

      console.log(
        "USUARIO EDITADO:",
        usuario.username,
        "EMPRESA:",
        companyId,
        "POR:",
        req.session.user.username
      );

      res.json({
        ok: true,
        message: "Usuário atualizado com sucesso.",

        usuario: {
          _id:
            String(usuario._id),

          nome:
            usuario.nome,

          username:
            usuario.username,

          role:
            usuario.role
        },

        anterior:
          dadosAnteriores
      });

    } catch (err) {

      console.log(
        "ERRO AO EDITAR USUARIO:",
        err
      );

      if (err && err.code === 11000) {

        return res.status(409).json({
          ok: false,
          error: "Este usuário de login já está em uso."
        });

      }

      res.status(500).json({
        ok: false,
        error: "Erro ao atualizar usuário."
      });

    }

  }
);


/* ===================== ALTERAR SENHA DO USUARIO ===================== */
app.put(
  "/api/usuarios/:id/senha",
  auth,
  adminEmpresaOnly,
  async (req, res) => {

    try {

      const usuarioId =
        String(req.params.id || "").trim();

      const novaSenha =
        String(req.body.password || "");

      const companyId =
        String(req.session.user.companyId);

      /* ===================== VALIDACOES ===================== */

      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {

        return res.status(400).json({
          ok: false,
          error: "Usuário inválido."
        });

      }

      if (novaSenha.length < 6) {

        return res.status(400).json({
          ok: false,
          error: "A nova senha deve possuir pelo menos 6 caracteres."
        });

      }

      /* ===================== LOCALIZAR USUARIO ===================== */

      const usuario =
        await User.findById(usuarioId);

      if (!usuario) {

        return res.status(404).json({
          ok: false,
          error: "Usuário não encontrado."
        });

      }

      if (
        String(usuario.companyId) !==
        companyId
      ) {

        return res.status(403).json({
          ok: false,
          error: "Usuário não pertence à sua empresa."
        });

      }

      /* ===================== PROTEGER MASTER ===================== */

      if (
        String(usuario.role || "").toLowerCase() ===
        "master" &&
        String(usuario._id) !==
        String(req.session.user._id)
      ) {

        return res.status(403).json({
          ok: false,
          error: "A senha do usuário Master não pode ser alterada por outro usuário."
        });

      }

      /* ===================== NOVA SENHA ===================== */

      usuario.password =
        await bcrypt.hash(
          novaSenha,
          10
        );

      await usuario.save();

      console.log(
        "SENHA DE USUARIO ALTERADA:",
        usuario.username,
        "EMPRESA:",
        companyId,
        "POR:",
        req.session.user.username
      );

      res.json({
        ok: true,
        message: "Senha alterada com sucesso.",
        usuario: {
          _id:
            String(usuario._id),
          nome:
            usuario.nome || usuario.username,
          username:
            usuario.username,
          role:
            usuario.role
        }
      });

    } catch (err) {

      console.log(
        "ERRO AO ALTERAR SENHA DE USUARIO:",
        err
      );

      res.status(500).json({
        ok: false,
        error: "Erro ao alterar senha do usuário."
      });

    }

  }
);


/* ===================== ATIVAR OU DESATIVAR USUARIO ===================== */
app.put(
  "/api/usuarios/:id/status",
  auth,
  adminEmpresaOnly,
  async (req, res) => {

    try {

      const usuarioId =
        String(req.params.id || "").trim();

      const companyId =
        String(req.session.user.companyId);

      const ativo =
        req.body.ativo;

      /* ===================== VALIDACOES ===================== */

      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {

        return res.status(400).json({
          ok: false,
          error: "Usuário inválido."
        });

      }

      if (typeof ativo !== "boolean") {

        return res.status(400).json({
          ok: false,
          error: "Status do usuário inválido."
        });

      }

      /* ===================== LOCALIZAR USUARIO ===================== */

      const usuario =
        await User.findById(usuarioId);

      if (!usuario) {

        return res.status(404).json({
          ok: false,
          error: "Usuário não encontrado."
        });

      }

      if (
        String(usuario.companyId) !==
        companyId
      ) {

        return res.status(403).json({
          ok: false,
          error: "Usuário não pertence à sua empresa."
        });

      }

      /* ===================== PROTEGER MASTER ===================== */

      if (
        String(usuario.role || "").toLowerCase() ===
        "master" &&
        ativo === false
      ) {

        return res.status(403).json({
          ok: false,
          error: "O usuário Master não pode ser desativado."
        });

      }

      /* ===================== PROTEGER PROPRIA CONTA ===================== */

      if (
        String(usuario._id) ===
        String(req.session.user._id) &&
        ativo === false
      ) {

        return res.status(403).json({
          ok: false,
          error: "Você não pode desativar sua própria conta."
        });

      }

      /* ===================== REATIVACAO E LIMITE ===================== */

      if (
        ativo === true &&
        usuario.ativo === false
      ) {

        const company =
          await Company.findById(
            req.session.user.companyId
          );

        if (!company) {

          return res.status(404).json({
            ok: false,
            error: "Empresa não encontrada."
          });

        }

        const limiteUsuarios =
          Number(company.userLimit ?? 1);

        if (limiteUsuarios !== -1) {

          const usuariosBrutos =
            await User.collection.find(
              {},
              {
                projection: {
                  companyId: 1,
                  ativo: 1
                }
              }
            ).toArray();

          const totalAtivos =
            usuariosBrutos.filter(item =>
              String(item.companyId) === companyId &&
              item.ativo !== false
            ).length;

          if (totalAtivos >= limiteUsuarios) {

            return res.status(403).json({
              ok: false,
              error:
                `Limite de usuários ativos do plano atingido (${limiteUsuarios}).`
            });

          }

        }

      }

      /* ===================== ALTERAR STATUS ===================== */

      usuario.ativo = ativo;

      await usuario.save();

      console.log(
        ativo
          ? "USUARIO ATIVADO:"
          : "USUARIO DESATIVADO:",
        usuario.username,
        "EMPRESA:",
        companyId,
        "POR:",
        req.session.user.username
      );

      res.json({
        ok: true,
        message:
          ativo
            ? "Usuário ativado com sucesso."
            : "Usuário desativado com sucesso.",

        usuario: {
          _id:
            String(usuario._id),

          nome:
            usuario.nome ||
            usuario.username,

          username:
            usuario.username,

          role:
            usuario.role,

          ativo:
            usuario.ativo !== false
        }
      });

    } catch (err) {

      console.log(
        "ERRO AO ALTERAR STATUS DO USUARIO:",
        err
      );

      res.status(500).json({
        ok: false,
        error: "Erro ao alterar status do usuário."
      });

    }

  }
);


/* ===================== PERMISSOES DE USUARIO ===================== */

const MODULOS_PERMISSOES = [
  "dashboard",
  "clientes",
  "chamados",
  "orcamentos",
  "servicos",
  "laudos",
  "estoque",
  "vendas",
  "financeiro",
  "lembretes",
  "relatorios",
  "auditoria",
  "configuracoes"
];

function permissoesCompletasUsuario(usuario) {

  const resultado = {};

  const ehMaster =
    String(usuario?.role || "").toLowerCase() === "master";

  for (const modulo of MODULOS_PERMISSOES) {

    if (ehMaster) {
      resultado[modulo] = true;
      continue;
    }

    const valor =
      usuario?.permissoes?.[modulo];

    resultado[modulo] =
      valor === undefined
        ? true
        : valor !== false;
  }

  return resultado;
}


/* ===================== CONSULTAR PERMISSOES ===================== */

app.get(
  "/api/usuarios/:id/permissoes",
  auth,
  adminEmpresaOnly,
  async (req, res) => {

    try {

      const usuarioId =
        String(req.params.id || "").trim();

      const companyId =
        String(req.session.user.companyId);

      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {

        return res.status(400).json({
          ok: false,
          error: "Usuário inválido."
        });

      }

      const usuario =
        await User.findById(usuarioId);

      if (!usuario) {

        return res.status(404).json({
          ok: false,
          error: "Usuário não encontrado."
        });

      }

      if (String(usuario.companyId) !== companyId) {

        return res.status(403).json({
          ok: false,
          error: "Usuário não pertence à sua empresa."
        });

      }

      return res.json({
        ok: true,

        usuario: {
          _id: String(usuario._id),
          nome: usuario.nome || usuario.username,
          username: usuario.username,
          role: usuario.role
        },

        permissoes:
          permissoesCompletasUsuario(usuario)
      });

    } catch (err) {

      console.log(
        "ERRO AO CONSULTAR PERMISSOES DO USUARIO:",
        err
      );

      return res.status(500).json({
        ok: false,
        error: "Erro ao consultar permissões do usuário."
      });

    }

  }
);


/* ===================== SALVAR PERMISSOES ===================== */

app.put(
  "/api/usuarios/:id/permissoes",
  auth,
  adminEmpresaOnly,
  async (req, res) => {

    try {

      const usuarioId =
        String(req.params.id || "").trim();

      const companyId =
        String(req.session.user.companyId);

      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {

        return res.status(400).json({
          ok: false,
          error: "Usuário inválido."
        });

      }

      const usuario =
        await User.findById(usuarioId);

      if (!usuario) {

        return res.status(404).json({
          ok: false,
          error: "Usuário não encontrado."
        });

      }

      if (String(usuario.companyId) !== companyId) {

        return res.status(403).json({
          ok: false,
          error: "Usuário não pertence à sua empresa."
        });

      }

      /* MASTER SEMPRE TEM ACESSO TOTAL */

      if (
        String(usuario.role || "").toLowerCase() ===
        "master"
      ) {

        return res.status(403).json({
          ok: false,
          error:
            "As permissões do usuário Master são permanentes e não podem ser alteradas."
        });

      }

      const permissoesRecebidas =
        req.body?.permissoes;

      if (
        !permissoesRecebidas ||
        typeof permissoesRecebidas !== "object" ||
        Array.isArray(permissoesRecebidas)
      ) {

        return res.status(400).json({
          ok: false,
          error: "Permissões inválidas."
        });

      }

      const permissoesNovas = {};

      for (const modulo of MODULOS_PERMISSOES) {

        if (
          typeof permissoesRecebidas[modulo] !==
          "boolean"
        ) {

          return res.status(400).json({
            ok: false,
            error:
              `Permissão inválida para o módulo ${modulo}.`
          });

        }

        permissoesNovas[modulo] =
          permissoesRecebidas[modulo];

      }

      usuario.permissoes =
        permissoesNovas;

      usuario.markModified("permissoes");

      await usuario.save();

      console.log(
        "PERMISSOES DE USUARIO ALTERADAS:",
        usuario.username,
        "EMPRESA:",
        companyId,
        "POR:",
        req.session.user.username
      );

      return res.json({
        ok: true,
        message: "Permissões salvas com sucesso.",

        usuario: {
          _id: String(usuario._id),
          nome: usuario.nome || usuario.username,
          username: usuario.username,
          role: usuario.role
        },

        permissoes:
          permissoesCompletasUsuario(usuario)
      });

    } catch (err) {

      console.log(
        "ERRO AO SALVAR PERMISSOES DO USUARIO:",
        err
      );

      return res.status(500).json({
        ok: false,
        error: "Erro ao salvar permissões do usuário."
      });

    }

  }
);


/* ===================== EXCLUIR USUARIO ===================== */
app.delete(
  "/api/usuarios/:id",
  auth,
  adminEmpresaOnly,
  async (req, res) => {

    try {

      const usuarioId =
        String(req.params.id || "").trim();

      const usuarioAtualId =
        String(req.session.user._id || "");

      const companyId =
        String(req.session.user.companyId);

      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {

        return res.status(400).json({
          ok: false,
          error: "Usuário inválido."
        });

      }

      if (usuarioId === usuarioAtualId) {

        return res.status(403).json({
          ok: false,
          error: "Você não pode excluir a própria conta."
        });

      }

      const usuario =
        await User.findById(usuarioId);

      if (!usuario) {

        return res.status(404).json({
          ok: false,
          error: "Usuário não encontrado."
        });

      }

      if (String(usuario.companyId) !== companyId) {

        return res.status(403).json({
          ok: false,
          error: "Usuário não pertence à sua empresa."
        });

      }

      if (
        String(usuario.role || "").toLowerCase() ===
        "master"
      ) {

        return res.status(403).json({
          ok: false,
          error: "O usuário Master não pode ser excluído."
        });

      }

      /* ===================== AUTORIZACAO ADMINISTRATIVA ===================== */

      const autorizacaoExcluirUsuario =
        await validarAutorizacaoAdministrativa(req);

      if(!autorizacaoExcluirUsuario.ok){
        return res.status(autorizacaoExcluirUsuario.status).json({
          ok: false,
          error: autorizacaoExcluirUsuario.error
        });
      }

      const administrador =
        autorizacaoExcluirUsuario.administrador;


      /* ===================== EXCLUIR USUARIO ===================== */

      await User.deleteOne({
        _id: usuario._id,
        companyId: usuario.companyId
      });

      await AuditLog.create({
        companyId: String(usuario.companyId),
        acao: "excluir_usuario",
        entidade: "User",
        entidadeId: String(usuario._id),
        descricao: "Exclusão do usuário " + usuario.username,
        executadoPor: req.session.user.username,
        executadoPorId: req.session.user._id,
        autorizadoPor: administrador.username,
        autorizadoPorId: administrador._id,
        dados: {
          username: usuario.username,
          nome: usuario.nome || "",
          role: usuario.role || ""
        },
        data: new Date()
      });

      console.log(
        "USUARIO EXCLUIDO:",
        usuario.username,
        "EMPRESA:",
        companyId,
        "POR:",
        req.session.user.username
      );

      return res.json({
        ok: true,
        message: "Usuário excluído com sucesso."
      });

    } catch (err) {

      console.log(
        "ERRO AO EXCLUIR USUARIO:",
        err
      );

      return res.status(500).json({
        ok: false,
        error: "Erro ao excluir usuário."
      });

    }

  }
);

/* ===================== ME ===================== */
app.get("/me", auth, async (req, res) => {
  try {

    const user = await User.findById(
      req.session.user._id
    );

    if (!user) {
      return res.status(404).json({
        error: true,
        message: "Usuario nao encontrado."
      });
    }

    const company = await Company.findById(
      req.session.user.companyId
    );

    const userAtual = {
      _id: String(user._id),
      username: user.username,
      nome: user.nome || user.username,
      role: user.role,
      companyId: user.companyId,
      permissoes: permissoesCompletasUsuario(user)
    };

    res.json({
      user: userAtual,
      company
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: true
    });

  }
});


app.get(
  "/api/configuracoes/os",
  auth,
  requirePermissao("configuracoes"),
  async (req, res) => {

    try {

      const company =
        await Company.findById(
          req.session.user.companyId
        );

      if (!company) {

        return res.status(404).json({
          error: "Empresa não encontrada."
        });

      }

      res.json({
        ok: true,
        configuracao:
          company.ordemServicoConfig || {}
      });

    } catch (err) {

      console.log(
        "ERRO CONFIGURAÇÕES OS:",
        err
      );

      res.status(500).json({
        error:
          "Erro ao carregar configurações da Ordem de Serviço."
      });

    }

  }
);


app.put(
  "/api/configuracoes/os",
  auth,
  requirePermissao("configuracoes"),
  async (req, res) => {

    try {

      const company =
        await Company.findById(
          req.session.user.companyId
        );

      if (!company) {

        return res.status(404).json({
          error: "Empresa não encontrada."
        });

      }


      const texto = (valor, padrao = "") =>
        String(
          valor ?? padrao
        ).trim();


      const booleano = (valor, padrao = false) => {

        if (valor === undefined) {
          return padrao;
        }

        return valor === true;

      };


      const numero = (
        valor,
        padrao,
        minimo,
        maximo
      ) => {

        const convertido =
          Number(valor);

        if (!Number.isFinite(convertido)) {
          return padrao;
        }

        if (convertido < minimo) {
          return minimo;
        }

        if (convertido > maximo) {
          return maximo;
        }

        return convertido;

      };


      const valorPermitido = (
        valor,
        permitidos,
        padrao
      ) => {

        return permitidos.includes(valor)
          ? valor
          : padrao;

      };


      company.ordemServicoConfig = {

        titulo:
          texto(
            req.body.titulo,
            "ORDEM DE SERVIÇO - ENTRADA"
          ) ||
          "ORDEM DE SERVIÇO - ENTRADA",

        subtitulo:
          texto(req.body.subtitulo),

        mostrarLogo:
          booleano(
            req.body.mostrarLogo,
            true
          ),

        posicaoLogo:
          valorPermitido(
            req.body.posicaoLogo,
            [
              "esquerda",
              "centro",
              "direita"
            ],
            "esquerda"
          ),

        mostrarDadosEmpresa:
          booleano(
            req.body.mostrarDadosEmpresa,
            true
          ),

        layoutCabecalho:
          valorPermitido(
            req.body.layoutCabecalho,
            [
              "padrao",
              "compacto",
              "centralizado"
            ],
            "padrao"
          ),

        mostrarNomeCliente:
          booleano(
            req.body.mostrarNomeCliente,
            true
          ),

        mostrarDocumentoCliente:
          booleano(
            req.body.mostrarDocumentoCliente,
            true
          ),

        mostrarTelefoneCliente:
          booleano(
            req.body.mostrarTelefoneCliente,
            true
          ),

        mostrarEmailCliente:
          booleano(
            req.body.mostrarEmailCliente,
            true
          ),

        mostrarEnderecoCliente:
          booleano(
            req.body.mostrarEnderecoCliente,
            true
          ),

        mostrarLocalizacaoCliente:
          booleano(
            req.body.mostrarLocalizacaoCliente,
            true
          ),

        mostrarObservacoesCliente:
          booleano(
            req.body.mostrarObservacoesCliente,
            true
          ),

        mostrarEquipamento:
          booleano(
            req.body.mostrarEquipamento,
            true
          ),

        mostrarMarcaModelo:
          booleano(
            req.body.mostrarMarcaModelo,
            true
          ),

        mostrarNumeroSerie:
          booleano(
            req.body.mostrarNumeroSerie,
            true
          ),

        mostrarEstadoEquipamento:
          booleano(
            req.body.mostrarEstadoEquipamento,
            true
          ),

        mostrarAcessorios:
          booleano(
            req.body.mostrarAcessorios,
            true
          ),

        mostrarSenhaEquipamento:
          booleano(
            req.body.mostrarSenhaEquipamento,
            false
          ),

        mostrarDefeitoRelatado:
          booleano(
            req.body.mostrarDefeitoRelatado,
            true
          ),

        observacaoPadrao:
          texto(req.body.observacaoPadrao),

        observacaoInterna:
          texto(req.body.observacaoInterna),

        termosCondicoes:
          texto(req.body.termosCondicoes),

        garantiaPadrao:
          numero(
            req.body.garantiaPadrao,
            90,
            0,
            3650
          ),

        mostrarDiagnostico:
          booleano(
            req.body.mostrarDiagnostico,
            true
          ),

        mostrarServicos:
          booleano(
            req.body.mostrarServicos,
            true
          ),

        mostrarPecas:
          booleano(
            req.body.mostrarPecas,
            true
          ),

        mostrarValores:
          booleano(
            req.body.mostrarValores,
            true
          ),

        mostrarDesconto:
          booleano(
            req.body.mostrarDesconto,
            true
          ),

        mostrarFormaPagamento:
          booleano(
            req.body.mostrarFormaPagamento,
            true
          ),

        mostrarDataConclusao:
          booleano(
            req.body.mostrarDataConclusao,
            true
          ),

        mostrarObservacoesFinais:
          booleano(
            req.body.mostrarObservacoesFinais,
            true
          ),

        mostrarRetirada:
          booleano(
            req.body.mostrarRetirada,
            true
          ),

        responsavelRetirada:
          valorPermitido(
            req.body.responsavelRetirada,
            [
              "cliente",
              "responsavel",
              "ambos"
            ],
            "cliente"
          ),

        documentoRetirada:
          booleano(
            req.body.documentoRetirada,
            false
          ),

        mostrarRodape:
          booleano(
            req.body.mostrarRodape,
            true
          ),

        textoRodape:
          texto(req.body.textoRodape),

        mostrarQrCode:
          booleano(
            req.body.mostrarQrCode,
            false
          ),

        textoQrCode:
          texto(req.body.textoQrCode),

        tamanhoDocumento:
          valorPermitido(
            req.body.tamanhoDocumento,
            [
              "a4",
              "a5"
            ],
            "a4"
          ),

        fonteTitulo:
          valorPermitido(
            req.body.fonteTitulo,
            [
              "arial",
              "verdana",
              "tahoma"
            ],
            "arial"
          ),

        orientacao:
          valorPermitido(
            req.body.orientacao,
            [
              "retrato",
              "paisagem"
            ],
            "retrato"
          ),

        tamanhoFonte:
          valorPermitido(
            req.body.tamanhoFonte,
            [
              "pequena",
              "media",
              "grande"
            ],
            "media"
          ),

        esquemaCores:
          valorPermitido(
            req.body.esquemaCores,
            [
              "empresa",
              "preto-branco"
            ],
            "empresa"
          ),

        espacamento:
          valorPermitido(
            req.body.espacamento,
            [
              "compacto",
              "normal",
              "amplo"
            ],
            "normal"
          ),

        estiloTabela:
          valorPermitido(
            req.body.estiloTabela,
            [
              "simples",
              "linhas",
              "sem-bordas"
            ],
            "simples"
          ),

        quantidadeVias:
          valorPermitido(
            Number(req.body.quantidadeVias),
            [
              1,
              2,
              3
            ],
            1
          ),

        viaPadrao:
          valorPermitido(
            req.body.viaPadrao,
            [
              "cliente",
              "empresa"
            ],
            "cliente"
          ),

        imprimirObservacaoInterna:
          booleano(
            req.body.imprimirObservacaoInterna,
            false
          ),

        formatoNumero:
          valorPermitido(
            req.body.formatoNumero,
            [
              "sequencial",
              "ano-sequencial"
            ],
            "sequencial"
          ),

        prefixo:
          texto(
            req.body.prefixo,
            "OS"
          ).substring(
            0,
            10
          ),

        digitosNumero:
          valorPermitido(
            Number(req.body.digitosNumero),
            [
              4,
              5,
              6
            ],
            6
          ),

        reiniciarNumeroAno:
          booleano(
            req.body.reiniciarNumeroAno,
            false
          ),

        assinaturaCliente:
          booleano(
            req.body.assinaturaCliente,
            true
          ),

        assinaturaTecnico:
          booleano(
            req.body.assinaturaTecnico,
            true
          ),

        assinaturaData:
          booleano(
            req.body.assinaturaData,
            true
          )

      };


      await company.save();


      res.json({

        ok: true,

        mensagem:
          "Configurações da Ordem de Serviço salvas com sucesso.",

        configuracao:
          company.ordemServicoConfig

      });


    } catch (err) {

      console.log(
        "ERRO AO SALVAR CONFIGURAÇÕES OS:",
        err
      );

      res.status(500).json({
        error:
          "Erro ao salvar configurações da Ordem de Serviço."
      });

    }

  }
);
/* ===================== DASHBOARD ===================== */
app.get("/dashboard", auth, requirePermissao("dashboard"), (req, res) => {
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

      /* ===================== AUTORIZACAO ADMINISTRATIVA ===================== */

      const autorizacaoExcluirEmpresa =
        await validarAutorizacaoAdministrativa(req);

      if(!autorizacaoExcluirEmpresa.ok){
        return res.status(autorizacaoExcluirEmpresa.status).json({
          ok: false,
          error: autorizacaoExcluirEmpresa.error
        });
      }

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

app.post("/api/clientes", auth, requirePermissao("clientes"), async (req, res) => {

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

app.get("/api/clientes/historico/:id", auth, requirePermissao("clientes"), async (req, res) => {

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

app.put("/api/clientes/editar", auth, requirePermissao("clientes"), async (req, res) => {

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

app.post("/api/tickets", auth, requirePermissao("chamados"), async (req, res) => {

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

  let clienteDoChamado = null;

  const companyId =
    req.session.user.companyId;

  const cpfcnpj =
    String(req.body.cpfcnpj || "").trim();

  const telefone =
    String(req.body.telefone || "").trim();


  /* ===================== CLIENTE JÁ SELECIONADO ===================== */

  if(req.body.clienteId){

    try{

      clienteDoChamado = await Cliente.findOne({

        _id: req.body.clienteId,

        companyId

      });

    }catch(err){

      clienteDoChamado = null;

    }

  }


  /* ===================== PROCURAR CLIENTE EXISTENTE ===================== */

  if(!clienteDoChamado){

    const filtrosCliente = [];

    if(cpfcnpj){

      filtrosCliente.push({
        cpfcnpj
      });

    }

    if(telefone){

      filtrosCliente.push({
        telefone
      });

    }


    if(filtrosCliente.length){

      clienteDoChamado = await Cliente.findOne({

        companyId,

        $or: filtrosCliente

      });

    }

  }


  /* ===================== CRIAR NOVO CLIENTE ===================== */

  if(!clienteDoChamado && req.body.cadastrarCliente !== false){

    const ultimoCliente = await Cliente.findOne({

      companyId

    }).sort({

      codigo: -1

    });


    const codigoCliente =
      ultimoCliente && ultimoCliente.codigo
        ? ultimoCliente.codigo + 1
        : 1;


    clienteDoChamado = await Cliente.create({

      companyId,

      codigo: codigoCliente,

      nome: req.body.cliente || "",

      telefone,

      cpfcnpj,

      endereco: "",

      bairro: "",

      cidade: "",

      estado: "",

      cep: ""

    });

  }


  /* ===================== DADOS DO CLIENTE ===================== */

  if(clienteDoChamado){

    dadosCliente = {

      endereco: clienteDoChamado.endereco || "",

      bairro: clienteDoChamado.bairro || "",

      cidade: clienteDoChamado.cidade || "",

      estado: clienteDoChamado.estado || "",

      cep: clienteDoChamado.cep || ""

    };

  }





  /* ===================== CHECKLIST DE ENTRADA ===================== */

  const valoresChecklistPermitidos = [
    "ok",
    "defeito",
    "nao_testado",
    "nao_aplica"
  ];

  const checklistRecebido =
    req.body.checklistEntrada &&
    typeof req.body.checklistEntrada === "object"
      ? req.body.checklistEntrada
      : {};

  const normalizarChecklist = (valor) => {
    return valoresChecklistPermitidos.includes(valor)
      ? valor
      : "";
  };

  const checklistEntrada = {
    liga: normalizarChecklist(checklistRecebido.liga),
    tela: normalizarChecklist(checklistRecebido.tela),
    teclado: normalizarChecklist(checklistRecebido.teclado),
    touchpadMouse: normalizarChecklist(checklistRecebido.touchpadMouse),
    usbConectores: normalizarChecklist(checklistRecebido.usbConectores),
    carregadorFonte: normalizarChecklist(checklistRecebido.carregadorFonte),
    bateria: normalizarChecklist(checklistRecebido.bateria),
    wifi: normalizarChecklist(checklistRecebido.wifi),
    bluetooth: normalizarChecklist(checklistRecebido.bluetooth),
    camera: normalizarChecklist(checklistRecebido.camera),
    audio: normalizarChecklist(checklistRecebido.audio),
    microfone: normalizarChecklist(checklistRecebido.microfone),
    estadoFisico: normalizarChecklist(checklistRecebido.estadoFisico),

    acessorios: String(checklistRecebido.acessorios || "").trim(),
    observacoes: String(checklistRecebido.observacoes || "").trim(),

    dataVerificacao: new Date()
  };

  /* ===================== DESENHO / AVARIAS DO EQUIPAMENTO ===================== */

  const tiposEquipamentoDesenhoPermitidos = [
    "notebook",
    "desktop",
    "impressora",
    "celular",
    "playstation",
    "xbox",
    "monitor",
    "tablet",
    "tv",
    "roteador"
  ];

  const tiposAvariaPermitidos = [
    "trinca",
    "arranhao",
    "amassado",
    "quebrado",
    "outro"
  ];

  const desenhoEquipamentoRecebido =
    req.body.desenhoEquipamento &&
    typeof req.body.desenhoEquipamento === "object"
      ? req.body.desenhoEquipamento
      : {};

  const tipoDesenhoRecebido =
    String(desenhoEquipamentoRecebido.tipo || "").trim();

  const marcacoesRecebidas =
    Array.isArray(desenhoEquipamentoRecebido.marcacoes)
      ? desenhoEquipamentoRecebido.marcacoes
      : [];

  const marcacoesDesenhoEquipamento =
    marcacoesRecebidas
      .filter(marcacao => {

        if (!marcacao || typeof marcacao !== "object") {
          return false;
        }

        const tipo =
          String(marcacao.tipo || "").trim();

        const vista =
          String(marcacao.vista || "").trim();

        const x = Number(marcacao.x);
        const y = Number(marcacao.y);

        return (
          tiposAvariaPermitidos.includes(tipo) &&
          vista.length > 0 &&
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          x >= 0 &&
          x <= 100 &&
          y >= 0 &&
          y <= 100
        );

      })
      .map(marcacao => ({
        vista: String(marcacao.vista || "").trim(),
        tipo: String(marcacao.tipo || "").trim(),
        x: Number(marcacao.x),
        y: Number(marcacao.y)
      }));

  const desenhoEquipamento = {
    tipo: tiposEquipamentoDesenhoPermitidos.includes(
      tipoDesenhoRecebido
    )
      ? tipoDesenhoRecebido
      : "",

    observacoes:
      String(
        desenhoEquipamentoRecebido.observacoes || ""
      ).trim(),

    marcacoes:
      marcacoesDesenhoEquipamento
  };

  const ticket = await Ticket.create({

    companyId: req.session.user.companyId,

    numeroOS,


    clienteId: clienteDoChamado ? clienteDoChamado._id : null,


    cliente: req.body.cliente,

    telefone: req.body.telefone,

    cpfcnpj: req.body.cpfcnpj,


    ...dadosCliente,


    equipamento: req.body.equipamento,

    problema: req.body.problema,

    observacoes: req.body.observacoes || "",

    checklistEntrada,
    desenhoEquipamento,

    status:"aberto"

  });


  res.json(ticket);

});

  
/* ===================== ALTERAR CLIENTE COM AUTORIZAÇÃO ADMINISTRATIVA ===================== */

/* ===================== FOTOS DOS CHAMADOS ===================== */

app.post("/api/tickets/:id/fotos", auth, requirePermissao("chamados"), (req, res) => {

  uploadFotoChamado.array("fotos", 10)(req, res, async (erroUpload) => {

    try {

      if (erroUpload) {

        if (erroUpload instanceof multer.MulterError) {

          if (erroUpload.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              ok: false,
              error: "Cada foto pode ter no máximo 8 MB."
            });
          }

          return res.status(400).json({
            ok: false,
            error: erroUpload.message
          });
        }

        return res.status(400).json({
          ok: false,
          error: erroUpload.message || "Erro ao receber as fotos."
        });
      }

      const ticketId = String(req.params.id || "").trim();
      const companyId = String(req.session.user.companyId);

      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        return res.status(400).json({
          ok: false,
          error: "Chamado inválido."
        });
      }

      const ticket = await Ticket.findOne({
        _id: ticketId,
        companyId
      });

      if (!ticket) {
        return res.status(404).json({
          ok: false,
          error: "Chamado não encontrado."
        });
      }

      const arquivos = req.files || [];

      if (!arquivos.length) {
        return res.status(400).json({
          ok: false,
          error: "Selecione pelo menos uma foto."
        });
      }

      const fotosSalvas = [];

      for (const arquivoFoto of arquivos) {

        const extensao =
          path.extname(arquivoFoto.originalname || "").toLowerCase() || ".jpg";

        const nomeSeguro =
          `${Date.now()}-${new mongoose.Types.ObjectId().toString()}${extensao}`;

        const chave =
          `chamados/${companyId}/OS-${ticket.numeroOS}/${nomeSeguro}`;

        await r2.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: chave,
          Body: arquivoFoto.buffer,
          ContentType: arquivoFoto.mimetype
        }));

        const foto = {
          chave,
          nomeOriginal: arquivoFoto.originalname || "",
          tipo: arquivoFoto.mimetype || "",
          tamanho: arquivoFoto.size || 0,
          observacao: ""
        };

        ticket.fotos.push(foto);
        fotosSalvas.push(foto);
      }

      await ticket.save();

      return res.json({
        ok: true,
        message: "Fotos adicionadas com sucesso.",
        fotos: ticket.fotos
      });

    } catch (err) {

      console.log("ERRO AO ENVIAR FOTOS DO CHAMADO:", err);

      return res.status(500).json({
        ok: false,
        error: "Erro ao enviar fotos do chamado."
      });
    }

  });

});


/* ===================== VISUALIZAR FOTO DO CHAMADO ===================== */

app.get("/api/tickets/:id/fotos/:fotoId/arquivo", auth, requirePermissao("chamados"), async (req, res) => {

  try {

    const ticketId = String(req.params.id || "").trim();
    const fotoId = String(req.params.fotoId || "").trim();
    const companyId = String(req.session.user.companyId);

    if (
      !mongoose.Types.ObjectId.isValid(ticketId) ||
      !mongoose.Types.ObjectId.isValid(fotoId)
    ) {
      return res.status(400).json({
        ok: false,
        error: "Foto ou chamado inválido."
      });
    }

    const ticket = await Ticket.findOne({
      _id: ticketId,
      companyId
    });

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "Chamado não encontrado."
      });
    }

    const foto = ticket.fotos.id(fotoId);

    if (!foto) {
      return res.status(404).json({
        ok: false,
        error: "Foto não encontrada."
      });
    }

    const objeto = await r2.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: foto.chave
      })
    );

    if (!objeto.Body) {
      return res.status(404).json({
        ok: false,
        error: "Arquivo da foto não encontrado."
      });
    }

    res.setHeader(
      "Content-Type",
      objeto.ContentType || foto.tipo || "application/octet-stream"
    );

    res.setHeader(
      "Cache-Control",
      "private, max-age=300"
    );

    if (objeto.ContentLength) {
      res.setHeader(
        "Content-Length",
        String(objeto.ContentLength)
      );
    }

    objeto.Body.on("error", (err) => {
      console.log("ERRO AO TRANSMITIR FOTO DO CHAMADO:", err);

      if (!res.headersSent) {
        res.status(500).json({
          ok: false,
          error: "Erro ao carregar foto do chamado."
        });
      } else {
        res.destroy(err);
      }
    });

    objeto.Body.pipe(res);

  } catch (err) {

    console.log("ERRO AO VISUALIZAR FOTO DO CHAMADO:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        ok: false,
        error: "Erro ao carregar foto do chamado."
      });
    }

    res.destroy(err);
  }

});
/* ===================== EXCLUIR FOTO DO CHAMADO ===================== */

app.delete("/api/tickets/:id/fotos/:fotoId", auth, requirePermissao("chamados"), async (req, res) => {

  try {

    const ticketId = String(req.params.id || "").trim();
    const fotoId = String(req.params.fotoId || "").trim();
    const companyId = String(req.session.user.companyId);

    if (
      !mongoose.Types.ObjectId.isValid(ticketId) ||
      !mongoose.Types.ObjectId.isValid(fotoId)
    ) {
      return res.status(400).json({
        ok: false,
        error: "Foto ou chamado inválido."
      });
    }

    const ticket = await Ticket.findOne({
      _id: ticketId,
      companyId
    });

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "Chamado não encontrado."
      });
    }

    const foto = ticket.fotos.id(fotoId);

    if (!foto) {
      return res.status(404).json({
        ok: false,
        error: "Foto não encontrada."
      });
    }

    /* ===================== AUTORIZACAO ADMINISTRATIVA ===================== */

    const autorizacaoExcluirFoto =
      await validarAutorizacaoAdministrativa(req);

    if(!autorizacaoExcluirFoto.ok){
      return res.status(autorizacaoExcluirFoto.status).json({
        ok: false,
        error: autorizacaoExcluirFoto.error
      });
    }

    const chaveFoto = foto.chave;

    await r2.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: chaveFoto
      })
    );

    ticket.fotos.pull({
      _id: fotoId
    });

    await ticket.save();

    return res.json({
      ok: true,
      message: "Foto excluída com sucesso.",
      fotos: ticket.fotos
    });

  } catch (err) {

    console.log("ERRO AO EXCLUIR FOTO DO CHAMADO:", err);

    return res.status(500).json({
      ok: false,
      error: "Erro ao excluir foto do chamado."
    });

  }

});


app.put("/api/tickets/:id/alterar-cliente", auth, requirePermissao("chamados"), async (req, res) => {

  try {

    const companyId =
      String(req.session.user.companyId);

    const novoClienteId =
      String(req.body.novoClienteId || "").trim();

    const adminUsername =
      String(req.body.adminUsername || "").trim();

    const adminPassword =
      String(req.body.adminPassword || "");

    if(
      !novoClienteId ||
      !adminUsername ||
      !adminPassword
    ){
      return res.status(400).json({
        ok: false,
        error: "Informe o novo cliente e as credenciais do administrador."
      });
    }


    /* ===================== VALIDAR ADMINISTRADOR ===================== */

    const administrador = await User.findOne({
      username: adminUsername
    });

    if(
      administrador &&
      String(administrador.companyId) !== companyId
    ){
      return res.status(403).json({
        ok: false,
        error: "O administrador informado pertence a outra empresa."
      });
    }

    if(!administrador){
return res.status(401).json({
        ok: false,
        error: "Administrador ou senha inválidos."
      });
    }

    const perfilAdministrador =
      String(administrador.role || "").toLowerCase();

    if(
      perfilAdministrador !== "admin" &&
      perfilAdministrador !== "master"
    ){
      return res.status(403).json({
        ok: false,
        error: "O usuário informado não possui permissão administrativa."
      });
    }

    const senhaCorreta =
      await bcrypt.compare(
        adminPassword,
        administrador.password
      );

    if(!senhaCorreta){
return res.status(401).json({
        ok: false,
        error: "Administrador ou senha inválidos."
      });
    }
/* ===================== LOCALIZAR CHAMADO ===================== */

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      companyId
    });

    if(!ticket){
      return res.status(404).json({
        ok: false,
        error: "Chamado não encontrado."
      });
    }


    /* ===================== BLOQUEAR ALTERAÇÃO EM CHAMADO FINALIZADO ===================== */

    if(
      String(ticket.status || "").toLowerCase() === "finalizado"
    ){
      return res.status(403).json({
        ok: false,
        error: "Não é permitido trocar o cliente de um chamado finalizado."
      });
    }


    /* ===================== LOCALIZAR NOVO CLIENTE ===================== */

    const novoCliente = await Cliente.findOne({
      _id: novoClienteId,
      companyId
    });

    if(!novoCliente){
      return res.status(404).json({
        ok: false,
        error: "Novo cliente não encontrado."
      });
    }

    if(
      ticket.clienteId &&
      String(ticket.clienteId) === String(novoCliente._id)
    ){
      return res.status(400).json({
        ok: false,
        error: "Este cliente já está vinculado ao chamado."
      });
    }


    /* ===================== TROCAR CLIENTE ===================== */

    const clienteAnterior =
      String(ticket.cliente || "").trim();

    const clienteAnteriorId =
      ticket.clienteId || null;

    ticket.clienteId =
      novoCliente._id;

    ticket.cliente =
      novoCliente.nome || "";

    ticket.telefone =
      novoCliente.telefone || "";

    ticket.cpfcnpj =
      novoCliente.cpfcnpj || "";

    ticket.endereco =
      novoCliente.endereco || "";

    ticket.bairro =
      novoCliente.bairro || "";

    ticket.cidade =
      novoCliente.cidade || "";

    ticket.estado =
      novoCliente.estado || "";

    ticket.cep =
      novoCliente.cep || "";


    /* ===================== REGISTRAR AUDITORIA ===================== */

    ticket.auditoria.push({

      acao: "troca_cliente",

      executadoPor:
        req.session.user.username,

      executadoPorId:
        req.session.user._id || null,

      autorizadoPor:
        administrador.username,

      autorizadoPorId:
        administrador._id,

      clienteAnterior,

      clienteAnteriorId,

      clienteNovo:
        novoCliente.nome || "",

      clienteNovoId:
        novoCliente._id,

      data:
        new Date()

    });


    await ticket.save();


    res.json({
      ok: true,
      ticket,
      alteracao: {
        clienteAnterior,
        clienteNovo: novoCliente.nome || "",
        realizadoPor: req.session.user.username,
        autorizadoPor: administrador.username
      }
    });

  } catch(err){

    console.log(
      "ERRO AO ALTERAR CLIENTE DO CHAMADO:",
      err
    );

    res.status(500).json({
      ok: false,
      error: "Erro ao alterar cliente do chamado."
    });

  }

});

/* ===================== CHECKLIST DE ENTREGA ===================== */

app.put("/api/tickets/:id/checklist-entrega", auth, requirePermissao("chamados"), async (req, res) => {

  try {

    const ticketId = String(req.params.id || "").trim();
    const companyId = String(req.session.user.companyId);

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        ok: false,
        error: "Chamado inválido."
      });
    }

    const ticket = await Ticket.findOne({
      _id: ticketId,
      companyId
    });

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "Chamado não encontrado."
      });
    }

    const valoresPermitidos = [
      "ok",
      "defeito",
      "nao_testado",
      "nao_aplica"
    ];

    const recebido =
      req.body &&
      typeof req.body === "object"
        ? req.body
        : {};

    const normalizar = (valor) => {
      return valoresPermitidos.includes(valor)
        ? valor
        : "";
    };

    const camposObrigatorios = [
      "liga",
      "tela",
      "teclado",
      "touchpadMouse",
      "usbConectores",
      "carregadorFonte",
      "bateria",
      "wifi",
      "bluetooth",
      "camera",
      "audio",
      "microfone",
      "estadoFisico"
    ];

    const possuiCampoPendente =
      camposObrigatorios.some(campo => !normalizar(recebido[campo]));

    if (possuiCampoPendente) {
      return res.status(400).json({
        ok: false,
        error: "checklist_entrega_incompleto",
        message: "Preencha todos os itens do Checklist de Entrega."
      });
    }

    ticket.checklistEntrega = {
      liga: normalizar(recebido.liga),
      tela: normalizar(recebido.tela),
      teclado: normalizar(recebido.teclado),
      touchpadMouse: normalizar(recebido.touchpadMouse),
      usbConectores: normalizar(recebido.usbConectores),
      carregadorFonte: normalizar(recebido.carregadorFonte),
      bateria: normalizar(recebido.bateria),
      wifi: normalizar(recebido.wifi),
      bluetooth: normalizar(recebido.bluetooth),
      camera: normalizar(recebido.camera),
      audio: normalizar(recebido.audio),
      microfone: normalizar(recebido.microfone),
      estadoFisico: normalizar(recebido.estadoFisico),

      acessorios: String(recebido.acessorios || "")
        .trim()
        .slice(0, 1000),

      observacoes: String(recebido.observacoes || "")
        .trim()
        .slice(0, 3000),

      dataVerificacao: new Date(),

      realizadoPor: String(
        req.session.user.username ||
        req.session.user.nome ||
        ""
      )
        .trim()
        .slice(0, 150),

      concluido: true
    };

    ticket.updatedAt = new Date();

    await ticket.save();

    return res.json({
      ok: true,
      checklistEntrega: ticket.checklistEntrega
    });

  } catch (err) {

    console.log(
      "ERRO AO SALVAR CHECKLIST DE ENTREGA:",
      err
    );

    return res.status(500).json({
      ok: false,
      error: "Erro ao salvar Checklist de Entrega."
    });
  }
});

/* ===================== GERAR LINK DE ASSINATURA REMOTA ===================== */
app.post("/api/tickets/:id/assinatura-remota/link", auth, requirePermissao("chamados"), async (req, res) => {

  try {

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      companyId: req.session.user.companyId
    });

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "Chamado não encontrado."
      });
    }

    if (ticket.assinaturaConfirmada) {
      return res.status(400).json({
        ok: false,
        error: "Este chamado já possui assinatura registrada."
      });
    }

    const token = crypto.randomBytes(32).toString("hex");

    const expiraEm = new Date(
      Date.now() + (24 * 60 * 60 * 1000)
    );

    ticket.assinaturaRemotaToken = token;
    ticket.assinaturaRemotaExpiraEm = expiraEm;
    ticket.assinaturaRemotaUtilizada = false;
    ticket.assinaturaRemotaUtilizadaEm = null;

    await ticket.save();

    const appUrl = String(process.env.APP_URL || "")
      .trim()
      .replace(/\/+$/, "");

    if (!appUrl) {
      return res.status(500).json({
        ok: false,
        error: "APP_URL não configurada."
      });
    }

    const url =
      `${appUrl}/assinatura-remota.html?token=${encodeURIComponent(token)}`;

    return res.json({
      ok: true,
      url,
      expiraEm
    });

  } catch (err) {

    console.error(
      "Erro ao gerar link de assinatura remota:",
      err
    );

    return res.status(500).json({
      ok: false,
      error: "Erro ao gerar link de assinatura remota."
    });
  }
});


/* ===================== CONSULTAR ASSINATURA REMOTA ===================== */
app.get("/api/assinatura-remota/:token", async (req, res) => {

  try {

    const token = String(req.params.token || "").trim();

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        ok: false,
        error: "Link de assinatura inválido."
      });
    }

    const ticket = await Ticket.findOne({
      assinaturaRemotaToken: token
    });

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "Link de assinatura inválido ou não encontrado."
      });
    }

    if (ticket.assinaturaRemotaUtilizada) {
      return res.status(410).json({
        ok: false,
        error: "Este link de assinatura já foi utilizado."
      });
    }

    if (!ticket.assinaturaRemotaExpiraEm ||
        new Date(ticket.assinaturaRemotaExpiraEm).getTime() < Date.now()) {

      return res.status(410).json({
        ok: false,
        error: "Este link de assinatura expirou."
      });
    }
    return res.json({
      ok: true,
      chamado: {
        numeroOS: ticket.numeroOS || "",
        cliente: {
          nome: ticket.cliente || ""
        },
        equipamento: ticket.equipamento || "",
        problema: ticket.problema || "",
        servico: ticket.servico || "",
        status: ticket.status || "",
        checklistEntrega: ticket.checklistEntrega || {}
      },
      expiraEm: ticket.assinaturaRemotaExpiraEm
    });

  } catch (err) {

    console.error(
      "Erro ao consultar assinatura remota:",
      err
    );

    return res.status(500).json({
      ok: false,
      error: "Erro ao consultar assinatura remota."
    });
  }
});


/* ===================== SALVAR ASSINATURA REMOTA ===================== */
app.post("/api/assinatura-remota/:token", async (req, res) => {

  try {

    const token = String(req.params.token || "").trim();

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        ok: false,
        error: "Link de assinatura inválido."
      });
    }

    const assinaturaCliente =
      String(req.body.assinaturaCliente || "").trim();

    const nomeAssinante =
      String(req.body.nomeAssinante || "")
        .trim()
        .slice(0, 150);

    const documentoAssinante =
      String(req.body.documentoAssinante || "")
        .trim()
        .slice(0, 50);

    if (!nomeAssinante) {
      return res.status(400).json({
        ok: false,
        error: "Informe o nome do assinante."
      });
    }

    if (!assinaturaCliente) {
      return res.status(400).json({
        ok: false,
        error: "A assinatura é obrigatória."
      });
    }

    if (!assinaturaCliente.startsWith("data:image/png;base64,")) {
      return res.status(400).json({
        ok: false,
        error: "Formato de assinatura inválido."
      });
    }

    if (assinaturaCliente.length > 1500000) {
      return res.status(400).json({
        ok: false,
        error: "A assinatura excede o tamanho permitido."
      });
    }

    const agora = new Date();

    const ticket = await Ticket.findOneAndUpdate(
      {
        assinaturaRemotaToken: token,
        assinaturaRemotaUtilizada: false,
        assinaturaConfirmada: false,
        assinaturaRemotaExpiraEm: { $gte: agora }
      },
      {
        $set: {
          assinaturaCliente,
          nomeAssinante,
          documentoAssinante,
          dataAssinaturaCliente: agora,
          assinaturaConfirmada: true,
          assinaturaOrigem: "remota",
          assinaturaRemotaUtilizada: true,
          assinaturaRemotaUtilizadaEm: agora
        }
      },
      { new: true }
    );

    if (!ticket) {

      const existente = await Ticket.findOne({
        assinaturaRemotaToken: token
      }).select(
        "assinaturaRemotaUtilizada assinaturaConfirmada assinaturaRemotaExpiraEm"
      );

      if (!existente) {
        return res.status(404).json({
          ok: false,
          error: "Link de assinatura inválido ou não encontrado."
        });
      }

      if (existente.assinaturaRemotaUtilizada ||
          existente.assinaturaConfirmada) {
        return res.status(410).json({
          ok: false,
          error: "Este link de assinatura já foi utilizado."
        });
      }

      return res.status(410).json({
        ok: false,
        error: "Este link de assinatura expirou."
      });
    }

    return res.json({
      ok: true,
      message: "Assinatura registrada com sucesso.",
      dataAssinatura: agora
    });

  } catch (err) {

    console.error(
      "Erro ao salvar assinatura remota:",
      err
    );

    return res.status(500).json({
      ok: false,
      error: "Erro ao salvar assinatura remota."
    });
  }
});


/* ===================== STATUS UPDATE ===================== */
app.put("/api/tickets/:id", auth, requirePermissao("chamados"), async (req, res) => {

  try {

    const statusValidos = [
      "aberto",
      "andamento",
      "reparo",
      "finalizado"
    ];

    if(!statusValidos.includes(req.body.status)){
      return res.status(400).json({
        error: "status_invalido"
      });
    }

    const atualizacao = {
      status: req.body.status,
      updatedAt: new Date()
    };


    /* ===================== VALIDAÇÃO DO CHECKLIST DE ENTREGA ===================== */

    let ticketAtual = null;

    if(req.body.status === "finalizado"){

      ticketAtual = await Ticket.findOne({
        _id: req.params.id,
        companyId: req.session.user.companyId
      });

      if(!ticketAtual){
        return res.status(404).json({
          error: "chamado_nao_encontrado"
        });
      }

      if(
        !ticketAtual.checklistEntrega ||
        ticketAtual.checklistEntrega.concluido !== true
      ){
        return res.status(400).json({
          error: "checklist_entrega_obrigatorio",
          message: "Conclua o Checklist de Entrega antes de finalizar o chamado."
        });
      }
    }

    /* ===================== ASSINATURA DO CLIENTE ===================== */

    if(req.body.status === "finalizado"){

      const assinaturaCliente =
        String(req.body.assinaturaCliente || "").trim();

      const assinaturaJaRegistrada =
        ticketAtual &&
        ticketAtual.assinaturaConfirmada === true &&
        String(ticketAtual.assinaturaCliente || "").trim();

      if(!assinaturaCliente && !assinaturaJaRegistrada){
        return res.status(400).json({
          error: "assinatura_obrigatoria",
          message: "A assinatura do cliente é obrigatória para finalizar o chamado."
        });
      }

      if(assinaturaCliente){

        if(!assinaturaCliente.startsWith("data:image/png;base64,")){
          return res.status(400).json({
            error: "assinatura_invalida",
            message: "Formato de assinatura inválido."
          });
        }

        if(assinaturaCliente.length > 1500000){
          return res.status(400).json({
            error: "assinatura_muito_grande",
            message: "A assinatura excede o tamanho permitido."
          });
        }

        atualizacao.assinaturaCliente =
          assinaturaCliente;

        atualizacao.nomeAssinante =
          String(req.body.nomeAssinante || "")
            .trim()
            .slice(0, 150);

        atualizacao.documentoAssinante =
          String(req.body.documentoAssinante || "")
            .trim()
            .slice(0, 50);

        atualizacao.dataAssinaturaCliente =
          new Date();

        atualizacao.assinaturaConfirmada =
          true;
      }
    }


    const ticket = await Ticket.findOneAndUpdate(
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


    if(!ticket){
      return res.status(404).json({
        error: true
      });
    }


    const numero =
      String(ticket.telefone || "")
        .replace(/\D/g, "");


    let textoStatus = "";


    if(req.body.status === "aberto"){
      textoStatus =
        "Seu chamado foi aberto e aguarda análise.";
    }

    if(req.body.status === "andamento"){
      textoStatus =
        "Seu equipamento está em análise.";
    }

    if(req.body.status === "reparo"){
      textoStatus =
        "Seu equipamento está em manutenção na bancada.";
    }

    if(req.body.status === "finalizado"){
      textoStatus =
        "Seu equipamento está pronto, aguarde que em breve entraremos em contato.";
    }


    let whatsapp = null;


    if(numero.length >= 10){

      const data =
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


      whatsapp =
        `https://wa.me/55${numero}?text=${msg}`;
    }


    res.json({
      ok: true,
      whatsapp,
      assinaturaConfirmada:
        ticket.assinaturaConfirmada || false
    });

  }
  catch(err){

    console.error(
      "Erro ao atualizar status do chamado:",
      err
    );

    res.status(500).json({
      error: "erro_atualizar_chamado"
    });

  }

});

/* ===================== EXCLUIR ASSINATURA DO CLIENTE ===================== */

app.delete("/api/tickets/:id/assinatura", auth, requirePermissao("chamados"), async (req, res) => {

  try {

    const perfil =
      String(req.session.user.role || "").toLowerCase();

    if(
      perfil !== "admin" &&
      perfil !== "master"
    ){
      return res.status(403).json({
        ok: false,
        error: "Sem permissão para excluir assinatura."
      });
    }

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      companyId: req.session.user.companyId
    });

    if(!ticket){
      return res.status(404).json({
        ok: false,
        error: "Chamado não encontrado."
      });
    }

    if(
      !ticket.assinaturaConfirmada &&
      !ticket.assinaturaCliente
    ){
      return res.status(400).json({
        ok: false,
        error: "Este chamado não possui assinatura registrada."
      });
    }

    /* ===================== AUTORIZACAO ADMINISTRATIVA ===================== */

    const autorizacaoExcluirAssinatura =
      await validarAutorizacaoAdministrativa(req);

    if(!autorizacaoExcluirAssinatura.ok){
      return res.status(autorizacaoExcluirAssinatura.status).json({
        ok: false,
        error: autorizacaoExcluirAssinatura.error
      });
    }

    ticket.assinaturaCliente = "";
    ticket.nomeAssinante = "";
    ticket.documentoAssinante = "";
    ticket.dataAssinaturaCliente = null;
    ticket.assinaturaConfirmada = false;

    await ticket.save();

    res.json({
      ok: true,
      message: "Assinatura excluída com sucesso."
    });

  }
  catch(err){

    console.error(
      "Erro ao excluir assinatura do cliente:",
      err
    );

    res.status(500).json({
      ok: false,
      error: "Erro ao excluir assinatura."
    });

  }

});

/* ===================== DIAGNÓSTICO PRÉ-SERVIÇO ===================== */

/* ===================== BUSCAR DIAGNÓSTICO ===================== */

app.get("/api/tickets/:id/diagnostico", auth, requirePermissao("chamados"), async (req, res) => {

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

app.put("/api/tickets/:id/diagnostico", auth, requirePermissao("chamados"), async (req, res) => {

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

app.get("/api/tickets/:id/diagnostico/pdf", auth, requirePermissao("chamados"), async (req, res) => {

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
app.get("/api/tickets/:id/laudo", auth, requirePermissao("laudos"), async (req, res) => {

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
app.put("/api/tickets/:id/laudo", auth, requirePermissao("laudos"), async (req, res) => {

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
app.get("/api/laudos", auth, requirePermissao("laudos"), async (req, res) => {

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
      en:"?? Novo chamado recebido"
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

/* ===================== EXCLUIR CHAMADO COM AUTORIZAÇÃO ADMINISTRATIVA ===================== */

app.delete("/api/tickets/:id", auth, requirePermissao("chamados"), async (req, res) => {

  try {

    const companyId =
      String(req.session.user.companyId);

    const adminUsername =
      String(req.body.adminUsername || "").trim();

    const adminPassword =
      String(req.body.adminPassword || "");

    if(
      !adminUsername ||
      !adminPassword
    ){
      return res.status(400).json({
        ok: false,
        error: "Informe o usuário e a senha do administrador."
      });
    }


    /* ===================== VALIDAR ADMINISTRADOR ===================== */

    const administrador = await User.findOne({
      username: adminUsername
    });

    if(
      !administrador ||
      String(administrador.companyId) !== companyId
    ){
      return res.status(401).json({
        ok: false,
        error: "Administrador ou senha inválidos."
      });
    }

    const perfilAdministrador =
      String(administrador.role || "").toLowerCase();

    if(
      perfilAdministrador !== "admin" &&
      perfilAdministrador !== "master"
    ){
      return res.status(403).json({
        ok: false,
        error: "O usuário informado não possui permissão administrativa."
      });
    }

    const senhaCorreta =
      await bcrypt.compare(
        adminPassword,
        administrador.password
      );

    if(!senhaCorreta){
      return res.status(401).json({
        ok: false,
        error: "Administrador ou senha inválidos."
      });
    }


    /* ===================== LOCALIZAR CHAMADO ===================== */

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      companyId
    });

    if(!ticket){
      return res.status(404).json({
        ok: false,
        error: "Chamado não encontrado."
      });
    }


    /* ===================== REGISTRAR AUDITORIA ===================== */

    await AuditLog.create({

      companyId,

      acao: "excluir_chamado",

      entidade: "Ticket",

      entidadeId:
        String(ticket._id),

      descricao:
        `Exclusão do chamado OS ${ticket.numeroOS || ""}`,

      executadoPor:
        String(req.session.user.username || ""),

      executadoPorId:
        req.session.user._id || null,

      autorizadoPor:
        String(administrador.username || ""),

      autorizadoPorId:
        administrador._id,

      dados: {
        numeroOS: ticket.numeroOS || null,
        cliente: ticket.cliente || "",
        clienteId: ticket.clienteId || null,
        telefone: ticket.telefone || "",
        cpfcnpj: ticket.cpfcnpj || "",
        equipamento: ticket.equipamento || "",
        problema: ticket.problema || "",
        status: ticket.status || "",
        origem: ticket.origem || "",
        budgetId: ticket.budgetId || null
      },

      data: new Date()

    });


    /* ===================== EXCLUIR CHAMADO ===================== */

    await Ticket.deleteOne({
      _id: ticket._id,
      companyId
    });


    res.json({
      ok: true,
      message: "Chamado excluído com autorização administrativa."
    });

  }
  catch(err){

    console.error(
      "Erro ao excluir chamado:",
      err
    );

    res.status(500).json({
      ok: false,
      error: "Erro ao excluir chamado."
    });

  }

});

/* ===================== BUSCAR CHAMADO ===================== */

app.get("/api/tickets/:id", auth, requirePermissao("chamados"), async (req, res) => {

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

app.get("/api/tickets/:id/pdf", auth, requirePermissao("chamados"), async (req,res)=>{

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



/* ===================== FOTOS DA OS ===================== */

let fotosOSHTML = "";

if (Array.isArray(ticket.fotos) && ticket.fotos.length) {

  const fotosCarregadas = [];

  for (const foto of ticket.fotos) {

    try {

      if (!foto || !foto.chave) {
        continue;
      }

      const objeto = await r2.send(
        new GetObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: foto.chave
        })
      );

      const chunks = [];

      for await (const chunk of objeto.Body) {
        chunks.push(chunk);
      }

      const bufferFoto = Buffer.concat(chunks);

      const tipoFoto =
        foto.tipo ||
        objeto.ContentType ||
        "image/jpeg";

      const base64Foto =
        bufferFoto.toString("base64");

      fotosCarregadas.push(`
        <div
          style="
            width:48%;
            display:inline-block;
            vertical-align:top;
            margin:0 1% 15px 0;
            text-align:center;
            page-break-inside:avoid;
          "
        >
          <img
            src="data:${tipoFoto};base64,${base64Foto}"
            style="
              max-width:100%;
              max-height:260px;
              object-fit:contain;
              border:1px solid #ddd;
              border-radius:4px;
            "
          >

          ${
            foto.nomeOriginal
              ? `<div style="font-size:10px;color:#666;margin-top:4px;">
                   ${foto.nomeOriginal}
                 </div>`
              : ""
          }

        </div>
      `);

    } catch (erroFoto) {

      console.error(
        "Erro ao carregar foto da OS:",
        foto?.chave,
        erroFoto
      );

    }

  }

  if (fotosCarregadas.length) {

    fotosOSHTML = `
      <div
        class="box"
        style="
          margin-top:15px;
          page-break-inside:auto;
        "
      >

        <h3>
          Fotos do Equipamento
        </h3>

        <div
          style="
            margin-top:12px;
            width:100%;
          "
        >

          ${fotosCarregadas.join("")}

        </div>

      </div>
    `;

  }

}


/* ===================== ASSINATURA ===================== */

const assinaturaOSHTML =
  ticket.assinaturaConfirmada &&
  ticket.assinaturaCliente
    ? `

<div
  class="box"
  style="
    margin-top:15px;
    page-break-inside:avoid;
  "
>

  <h3>
    Confirmação e Assinatura do Cliente
  </h3>

  <div
    style="
      margin-top:12px;
      text-align:center;
    "
  >

    <img
      src="${ticket.assinaturaCliente}"
      alt="Assinatura do cliente"
      style="
        display:block;
        margin:0 auto;
        max-width:360px;
        width:100%;
        max-height:130px;
        object-fit:contain;
      "
    >

    <div
      style="
        width:360px;
        max-width:90%;
        margin:4px auto 8px auto;
        border-top:1px solid #555;
      "
    ></div>

    <strong>
      ${ticket.nomeAssinante || ticket.cliente || ""}
    </strong>

    ${
      ticket.documentoAssinante
        ? `
          <div style="margin-top:4px;">
            Documento:
            ${ticket.documentoAssinante}
          </div>
        `
        : ""
    }

    ${
      ticket.dataAssinaturaCliente
        ? `
          <div style="margin-top:4px;">
            Assinado em:
            ${new Date(
              ticket.dataAssinaturaCliente
            ).toLocaleString(
              "pt-BR",
              {
                timeZone: "America/Cuiaba"
              }
            )}
          </div>
        `
        : ""
    }

  </div>

</div>

`
    : "";

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


${fotosOSHTML}

${assinaturaOSHTML}
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

app.use("/api/financeiro", requirePermissao("financeiro"), financeiroRoutes);
app.use("/api/relatorios", requirePermissao("relatorios"), relatoriosRoutes);
app.use("/api/auditoria", adminEmpresaOnly, requirePermissao("auditoria"), auditoriaRoutes);

app.use("/api/products", productRoutes);

app.use("/api/notifications", auth, notificationRoutes);

app.use("/api/lembretes", requirePermissao("lembretes"), lembreteRoutes);
app.use("/api/mensagens-programadas", requirePermissao("lembretes"), mensagensProgramadasRoutes);

app.use("/api/alertas", require("./routes/alertas"));

app.use(
  "/api/stock-movements",
  requirePermissao("estoque"),
  stockMovementRoutes
);

app.use(
  "/api/sales",
  requirePermissao("vendas"),
  saleRoutes
);

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
