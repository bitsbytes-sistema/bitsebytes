const express = require("express");
const router = express.Router();

const Notification = require("../models/Notification");
const Lembrete = require("../models/Lembrete");


/* ===================== GERAR ALERTAS DE AGENDAMENTOS ===================== */

async function gerarNotificacoesAgendamentos(companyId){

  const agora = new Date();
  const em24Horas = new Date(agora.getTime() + (24 * 60 * 60 * 1000));

  async function criarNotificacao(agendamento, momentoAgendamento, titulo){

    const existente = await Notification.findOne({
      companyId,
      tipo: "agendamento",
      lembreteId: agendamento._id,
      momentoAgendamento
    });

    if(existente){
      return;
    }

    const dataFormatada = agendamento.data
      ? agendamento.data.toLocaleDateString("pt-BR", {
          timeZone: "UTC"
        })
      : "";

    const mensagem =
      (agendamento.cliente
        ? "Cliente: " + agendamento.cliente + ". "
        : "") +
      (agendamento.assuntoServico
        ? "Servico: " + agendamento.assuntoServico + ". "
        : "") +
      "Horario agendado: " +
      (agendamento.hora || "") +
      (dataFormatada ? " - " + dataFormatada : "") +
      ".";

    await Notification.create({
      companyId,
      tipo: "agendamento",
      titulo,
      mensagem,
      lembreteId: agendamento._id,
      momentoAgendamento
    });
  }


  const avisosNoHorario = await Lembrete.find({
    companyId,
    categoria: "agendamento",
    status: {
      $in: ["agendado", "confirmado"]
    },
    avisoNoHorario: {
      $ne: false
    },
    dataHoraAgendamento: {
      $ne: null,
      $lte: agora
    }
  })
  .sort({
    dataHoraAgendamento: -1
  })
  .limit(50);


  for(const agendamento of avisosNoHorario){

    await criarNotificacao(
      agendamento,
      "horario",
      "Agendamento de cliente"
    );

  }


  const avisosUmDiaAntes = await Lembrete.find({
    companyId,
    categoria: "agendamento",
    status: {
      $in: ["agendado", "confirmado"]
    },
    avisoUmDiaAntes: true,
    dataHoraAgendamento: {
      $gt: agora,
      $lte: em24Horas
    }
  })
  .sort({
    dataHoraAgendamento: 1
  })
  .limit(50);


  for(const agendamento of avisosUmDiaAntes){

    await criarNotificacao(
      agendamento,
      "um_dia_antes",
      "Lembrete antecipado de agendamento"
    );

  }

}


/* ===================== LISTAR NOTIFICACOES ===================== */

router.get("/", async (req, res) => {

  try{

    const companyId = req.session.user.companyId;


    await gerarNotificacoesAgendamentos(companyId);


    const lista = await Notification
      .find({
        companyId
      })
      .sort({
        createdAt: -1
      })
      .limit(30);


    res.json(lista);


  }catch(err){

    console.log("Erro ao listar notificacoes:", err);

    res.status(500).json({
      error:true
    });

  }

});


/* ===================== MARCAR COMO LIDA ===================== */

router.put("/:id/read", async (req,res)=>{

  try{

    const notificacao = await Notification.findOneAndUpdate(

      {
        _id:req.params.id,
        companyId:req.session.user.companyId
      },

      {
        lida:true
      },

      {
        new:true
      }

    );


    if(!notificacao){

      return res.status(404).json({
        error:"not_found"
      });

    }


    res.json({
      ok:true
    });


  }catch(err){

    console.log("Erro ao marcar notificacao como lida:", err);

    res.status(500).json({
      error:true
    });

  }

});


module.exports = router;
