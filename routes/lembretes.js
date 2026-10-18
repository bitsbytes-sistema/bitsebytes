const express = require("express");
const router = express.Router();

const Lembrete = require("../models/Lembrete");
const Cliente = require("../models/Cliente");
const User = require("../models/User");
const bcrypt = require("bcrypt");


function auth(req, res, next){

  if(!req.session.user){
    return res.status(401).json({
      error:"not_logged"
    });
  }

  next();

}


/* ===================== LISTAR ===================== */

router.get("/", auth, async (req,res)=>{

  try{

    const lembretes = await Lembrete.find({

      companyId:req.session.user.companyId

    })
    .sort({
      data:1
    });


    res.json(lembretes);


  }catch(err){

    console.log(err);

    res.status(500).json({
      error:true
    });

  }

});


/* ===================== CRIAR ===================== */

router.post("/", auth, async(req,res)=>{

  try{

    let clienteAgendamento = null;

    if(req.body.categoria === "agendamento"){

      if(!req.body.clienteId){

        return res.status(400).json({
          error:"cliente_obrigatorio",
          message:"Selecione um cliente cadastrado para o agendamento."
        });

      }

      if(!Cliente.db.base.Types.ObjectId.isValid(req.body.clienteId)){

        return res.status(400).json({
          error:"cliente_invalido",
          message:"Cliente invalido."
        });

      }

      clienteAgendamento = await Cliente.findOne({
        _id:req.body.clienteId,
        companyId:req.session.user.companyId
      });

      if(!clienteAgendamento){

        return res.status(404).json({
          error:"cliente_nao_encontrado",
          message:"Cliente nao encontrado para esta empresa."
        });

      }

    }


    const lembrete = await Lembrete.create({

      companyId:req.session.user.companyId,

      titulo:req.body.titulo,

      descricao:req.body.descricao,

      clienteId:req.body.clienteId || null,

      cliente:clienteAgendamento ? clienteAgendamento.nome : (req.body.cliente || ""),

      telefone:clienteAgendamento ? clienteAgendamento.telefone : (req.body.telefone || ""),

      data:req.body.data,

      hora:req.body.hora || "",

      dataHoraAgendamento:req.body.categoria === "agendamento"
        ? (req.body.dataHoraAgendamento || null)
        : null,

      avisoNoHorario:req.body.categoria === "agendamento"
        ? req.body.avisoNoHorario !== false
        : true,

      avisoUmDiaAntes:req.body.categoria === "agendamento"
        ? req.body.avisoUmDiaAntes === true
        : false,

      categoria:req.body.categoria || "lembrete",

      assuntoServico:req.body.assuntoServico || "",

      observacaoAgendamento:req.body.observacaoAgendamento || "",

      status:req.body.categoria === "agendamento"
        ? "agendado"
        : "pendente",

      tipo:req.body.tipo || "outros",

      criadoPor:req.session.user._id

    });


    res.json(lembrete);


  }catch(err){

    console.log(err);

    res.status(500).json({
      error:true
    });

  }

});


/* ===================== ATUALIZAR ===================== */

router.put("/:id", auth, async (req, res) => {
  try {
    const lembrete = await Lembrete.findOne({
      _id: req.params.id,
      companyId: req.session.user.companyId,
      categoria: "agendamento"
    });

    if (!lembrete) {
      return res.status(404).json({
        error: "not_found",
        message: "Agendamento nao encontrado."
      });
    }

    const {
      clienteId,
      assuntoServico,
      observacaoAgendamento,
      data,
      hora,
      dataHoraAgendamento,
      avisoNoHorario,
      avisoUmDiaAntes,
      status
    } = req.body;

    if (!clienteId || !Cliente.db.base.Types.ObjectId.isValid(clienteId)) {
      return res.status(400).json({
        message: "Selecione um cliente valido."
      });
    }

    const cliente = await Cliente.findOne({
      _id: clienteId,
      companyId: req.session.user.companyId
    });

    if (!cliente) {
      return res.status(404).json({
        message: "Cliente nao encontrado nesta empresa."
      });
    }

    if (
      typeof assuntoServico !== "string" ||
      !assuntoServico.trim() ||
      typeof data !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
      typeof hora !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
    ) {
      return res.status(400).json({
        message: "Informe servico, data e hora validos."
      });
    }

    const dataValida = new Date(data + "T12:00:00Z");

    if (
      Number.isNaN(dataValida.getTime()) ||
      dataValida.toISOString().slice(0, 10) !== data
    ) {
      return res.status(400).json({
        message: "Data invalida."
      });
    }

    const momento = new Date(dataHoraAgendamento);

    if (
      !dataHoraAgendamento ||
      Number.isNaN(momento.getTime())
    ) {
      return res.status(400).json({
        message: "Data e hora do aviso invalidas."
      });
    }

    const statusPermitidos = [
      "agendado",
      "confirmado",
      "concluido",
      "cancelado"
    ];

    if (status !== undefined && !statusPermitidos.includes(status)) {
      return res.status(400).json({
        message: "Status invalido."
      });
    }

    lembrete.clienteId = cliente._id;
    lembrete.cliente = cliente.nome;
    lembrete.telefone = cliente.telefone || "";
    lembrete.titulo = assuntoServico.trim();
    lembrete.assuntoServico = assuntoServico.trim();
    lembrete.descricao = String(observacaoAgendamento || "");
    lembrete.observacaoAgendamento = String(observacaoAgendamento || "");
    lembrete.data = data;
    lembrete.hora = hora;
    lembrete.dataHoraAgendamento = momento;
    lembrete.avisoNoHorario = avisoNoHorario === true;
    lembrete.avisoUmDiaAntes = avisoUmDiaAntes === true;

    if (status !== undefined) {
      lembrete.status = status;
    }

    await lembrete.save();

    res.json(lembrete);

  } catch (err) {
    console.error("Erro ao atualizar agendamento:", err);
    res.status(500).json({
      error: true,
      message: "Erro ao atualizar agendamento."
    });
  }
});

/* ===================== EXCLUIR ===================== */

router.delete("/:id", auth, async(req,res)=>{

  try{

    const companyId =
      String(req.session.user.companyId);

    const adminUsername =
      String(req.body.adminUsername || "").trim();

    const adminPassword =
      String(req.body.adminPassword || "");

    if(!adminUsername || !adminPassword){
      return res.status(400).json({
        error:"Informe o usuario e a senha do administrador."
      });
    }

    const administrador = await User.findOne({
      username:adminUsername
    });

    if(
      !administrador ||
      String(administrador.companyId) !== companyId
    ){
      return res.status(401).json({
        error:"Administrador ou senha invalidos."
      });
    }

    const perfil =
      String(administrador.role || "").toLowerCase();

    if(perfil !== "admin" && perfil !== "master"){
      return res.status(403).json({
        error:"O usuario informado nao possui permissao administrativa."
      });
    }

    const senhaCorreta =
      await bcrypt.compare(
        adminPassword,
        administrador.password
      );

    if(!senhaCorreta){
      return res.status(401).json({
        error:"Administrador ou senha invalidos."
      });
    }

    await Lembrete.deleteOne({

      _id:req.params.id,

      companyId:req.session.user.companyId

    });


    res.json({
      success:true
    });


  }catch(err){

    console.log(err);

    res.status(500).json({
      error:true
    });

  }

});


module.exports = router;