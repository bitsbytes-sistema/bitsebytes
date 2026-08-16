const express = require("express");
const router = express.Router();
const Cliente = require("../models/Cliente");
const User = require("../models/User");
const alertasService = require("../services/alertasService");


/* ===================== IGNORAR ALERTA HOJE ===================== */

router.post("/ignorar", async (req,res)=>{

  try{

    const {
      tipo
    } = req.body;


if (!req.session.user) {
  return res.status(401).json({
    erro: "Usuário não autenticado"
  });
}

    const usuario = await User.findById(
      req.session.user._id
    );


    if(!usuario){

      return res.status(404).json({
        erro:"Usuário não encontrado"
      });

    }


    const hoje = new Date();

    hoje.setHours(0,0,0,0);


    // evita duplicar
    const jaExiste =
      usuario.alertasIgnorados.some(a =>

        a.tipo === tipo &&
        new Date(a.data).setHours(0,0,0,0)
        === hoje.getTime()

      );


    if(!jaExiste){

      usuario.alertasIgnorados.push({

        tipo,

        data:hoje

      });

    }


    await usuario.save();


    res.json({
      ok:true
    });


  }catch(err){

    console.log(err);

    res.status(500).json({
      erro:true
    });

  }

});

/* ===================== LISTAR ALERTAS ===================== */

router.get("/", async (req,res)=>{

  try{

if (!req.session.user) {
  return res.status(401).json({
    erro: "Usuário não autenticado"
  });
}

    const usuario = await User.findById(
      req.session.user._id
    );

    if(!usuario){

      return res.status(404).json({
        erro:"Usuário não encontrado"
      });

    }

    const hoje = new Date();

    hoje.setHours(0,0,0,0);


    // ===================== ANIVERSARIANTES =====================

    const clientes = await Cliente.find({
      companyId: req.session.user.companyId
    });

    const aniversariantes = clientes.filter(c => {

      if(!c.aniversario) return false;

      const data = new Date(c.aniversario);

      return (
        data.getUTCDate() === hoje.getUTCDate() &&
        data.getUTCMonth() === hoje.getUTCMonth()
      );

    });


    // ===================== CHAMADOS =====================

    const alertaChamados =
      await alertasService.chamados(
        req.session.user.companyId
      );


    // ===================== ALERTAS =====================

    const alertas = [

      {
        tipo:"aniversariantes",

        titulo:"🎂 Alerta de Aniversariantes",

        cor:"blue",

        quantidade:
          aniversariantes.length,

        mensagem:
          aniversariantes.length > 0
            ? `Hoje há ${aniversariantes.length} aniversariante(s).`
            : "Hoje não existem aniversariantes.",

        dados:
          aniversariantes.map(c => ({
            nome:c.nome
          }))

      },


      {
        tipo:"receber",

        titulo:"🟢 Contas a Receber",

        cor:"green",

        quantidade:0,

        mensagem:"Ainda não implementado.",

        dados:[]

      },


      {
        tipo:"pagar",

        titulo:"🔴 Contas a Pagar",

        cor:"red",

        quantidade:0,

        mensagem:"Ainda não implementado.",

        dados:[]

      },


      alertaChamados,


      {
        tipo:"orcamentos",

        titulo:"💰 Orçamentos",

        cor:"yellow",

        quantidade:0,

        mensagem:"Ainda não implementado.",

        dados:[]

      },


      {
        tipo:"estoque",

        titulo:"📦 Estoque",

        cor:"purple",

        quantidade:0,

        mensagem:"Ainda não implementado.",

        dados:[]

      }

    ];


    // ===================== IGNORADOS HOJE =====================

    const ignoradosHoje =
      usuario.alertasIgnorados
      ?.filter(a => {

        const data = new Date(a.data);

        data.setHours(0,0,0,0);

        return data.getTime() === hoje.getTime();

      })
      .map(a => a.tipo) || [];


    const alertasFiltrados =
      alertas.filter(a =>
        !ignoradosHoje.includes(a.tipo)
      );


    res.json(alertasFiltrados);


  }catch(err){

    console.log(err);

    res.status(500).json({
      erro:true
    });

  }

});


/* ===================== RESETAR ALERTAS (TESTE) ===================== */

router.post("/resetar", async (req,res)=>{

  try{

    const usuario = await User.findById(
      req.session.user._id
    );


    if(!usuario){

      return res.status(404).json({
        erro:"Usuário não encontrado"
      });

    }


    usuario.alertasIgnorados = [];


    await usuario.save();


    res.json({
      ok:true,
      mensagem:"Alertas resetados"
    });


  }catch(err){

    console.log(err);

    res.status(500).json({
      erro:true
    });

  }

});

module.exports = router;