const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const MensagemProgramada = require("../models/MensagemProgramada");
const Lembrete = require("../models/Lembrete");


function auth(req, res, next){

  if(!req.session.user){
    return res.status(401).json({
      error:"not_logged"
    });
  }

  next();

}


/* ===================== LISTAR ===================== */

router.get("/", auth, async(req,res)=>{

  try{

    const mensagens = await MensagemProgramada.find({
      companyId:req.session.user.companyId
    })
    .sort({
      dataHoraProgramada:1
    });

    res.json(mensagens);

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

    const {
      lembreteId,
      tipo,
      mensagem,
      dataHoraProgramada
    } = req.body;


    if(!lembreteId || !mongoose.Types.ObjectId.isValid(lembreteId)){

      return res.status(400).json({
        error:"agendamento_invalido",
        message:"Selecione um agendamento valido."
      });

    }


    const tiposPermitidos = [
      "confirmacao",
      "lembrete",
      "retorno",
      "manutencao"
    ];

    if(!tiposPermitidos.includes(tipo)){

      return res.status(400).json({
        error:"tipo_invalido",
        message:"Tipo de mensagem invalido."
      });

    }


    if(!mensagem || !String(mensagem).trim()){

      return res.status(400).json({
        error:"mensagem_obrigatoria",
        message:"Informe a mensagem."
      });

    }


    const dataProgramada = new Date(dataHoraProgramada);

    if(
      !dataHoraProgramada ||
      Number.isNaN(dataProgramada.getTime())
    ){

      return res.status(400).json({
        error:"data_invalida",
        message:"Informe uma data e hora validas."
      });

    }


    const agendamento = await Lembrete.findOne({
      _id:lembreteId,
      companyId:req.session.user.companyId,
      categoria:"agendamento"
    });


    if(!agendamento){

      return res.status(404).json({
        error:"agendamento_nao_encontrado",
        message:"Agendamento nao encontrado."
      });

    }


    if(!agendamento.clienteId){

      return res.status(400).json({
        error:"cliente_invalido",
        message:"O agendamento nao possui cliente vinculado."
      });

    }


    const novaMensagem = await MensagemProgramada.create({

      companyId:req.session.user.companyId,

      lembreteId:agendamento._id,

      clienteId:agendamento.clienteId,

      cliente:agendamento.cliente || "",

      telefone:agendamento.telefone || "",

      tipo,

      mensagem:String(mensagem).trim(),

      dataHoraProgramada:dataProgramada,

      status:"programada",

      criadoPor:req.session.user._id

    });


    res.json(novaMensagem);


  }catch(err){

    console.log(err);

    res.status(500).json({
      error:true
    });

  }

});


/* ===================== CONFIRMAR ENVIO MANUAL ===================== */

router.patch("/:id/confirmar-envio", auth, async(req,res)=>{

  try{

    const id = req.params.id;

    if(!mongoose.Types.ObjectId.isValid(id)){
      return res.status(400).json({
        error:"id_invalido",
        message:"Identificador de mensagem invalido."
      });
    }

    const mensagem = await MensagemProgramada.findOneAndUpdate(
      {
        _id:id,
        companyId:req.session.user.companyId,
        status:"programada"
      },
      {
        $set:{
          status:"enviada",
          enviadaEm:new Date()
        }
      },
      {
        new:true,
        runValidators:true
      }
    );

    if(!mensagem){

      const existente = await MensagemProgramada.findOne({
        _id:id,
        companyId:req.session.user.companyId
      });

      if(!existente){
        return res.status(404).json({
          error:"mensagem_nao_encontrada",
          message:"Mensagem nao encontrada."
        });
      }

      return res.status(409).json({
        error:"status_invalido",
        message:"Esta mensagem nao esta pendente de envio."
      });

    }

    return res.json({
      success:true,
      message:"Envio manual confirmado com sucesso.",
      mensagem
    });

  }catch(err){

    console.error("Erro ao confirmar envio manual:",err);

    return res.status(500).json({
      error:true,
      message:"Erro ao confirmar envio."
    });

  }

});
/* ===================== EDITAR MENSAGEM PROGRAMADA ===================== */

router.put("/:id", auth, async(req,res)=>{

  try{

    const id = req.params.id;
    const { mensagem } = req.body || {};

    if(!mongoose.Types.ObjectId.isValid(id)){
      return res.status(400).json({
        error:"id_invalido",
        message:"Identificador invalido."
      });
    }

    if(typeof mensagem !== "string" || !mensagem.trim()){
      return res.status(400).json({
        error:"mensagem_invalida",
        message:"Informe o texto da mensagem."
      });
    }

    if(mensagem.trim().length > 5000){
      return res.status(400).json({
        error:"mensagem_muito_longa",
        message:"A mensagem deve ter no maximo 5000 caracteres."
      });
    }

    const atualizada = await MensagemProgramada.findOneAndUpdate(
      {
        _id:id,
        companyId:req.session.user.companyId,
        status:"programada"
      },
      {
        $set:{
          mensagem:mensagem.trim()
        }
      },
      {
        new:true,
        runValidators:true
      }
    );

    if(!atualizada){

      const existente = await MensagemProgramada.findOne({
        _id:id,
        companyId:req.session.user.companyId
      });

      if(!existente){
        return res.status(404).json({
          error:"mensagem_nao_encontrada",
          message:"Mensagem nao encontrada."
        });
      }

      return res.status(409).json({
        error:"mensagem_bloqueada",
        message:"Somente mensagens programadas podem ser editadas."
      });

    }

    return res.json({
      success:true,
      message:"Mensagem atualizada com sucesso.",
      mensagem:atualizada
    });

  }catch(err){

    console.error("Erro ao editar mensagem:",err);

    return res.status(500).json({
      error:true,
      message:"Erro ao atualizar mensagem."
    });

  }

});
module.exports = router;
