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


module.exports = router;
