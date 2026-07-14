const express = require("express");
const Ticket = require("../models/Ticket");

const router = express.Router();

const fs = require("fs");
const path = require("path");

const Company = require("../models/Company");

const puppeteer =
    process.env.RENDER
        ? require("puppeteer-core")
        : require("puppeteer");

const chromium = require("@sparticuz/chromium");

/* ===================== LISTAR ===================== */
router.get("/", async (req, res) => {
  try {
    const companyId = req.session?.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: "Sessão inválida" });
    }

    const tickets = await Ticket.find({ companyId })
      .sort({ createdAt: -1 });

    res.json(tickets);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar chamados" });
  }
});

/* ===================== CRIAR ===================== */
router.post("/", async (req, res) => {
  try {
    const companyId = req.session?.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: "Sessão inválida" });
    }

    const ticket = await Ticket.create({
      cliente: req.body.cliente,
      equipamento: req.body.equipamento,
      cpfcnpj: req.body.cpfcnpj,
      telefone: req.body.telefone,
      problema: req.body.problema,
      status: req.body.status || "aberto",
      companyId
    });

    res.json(ticket);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar chamado" });
  }
});

/* ===================== GERAR OS PDF ===================== */

router.get("/:id/pdf", async (req,res)=>{

    try{

        const companyId = req.session?.user?.companyId;

        if(!companyId){
            return res.status(401).send("Sessão inválida");
        }


        const ticket = await Ticket.findOne({
            _id:req.params.id,
            companyId
        });


        if(!ticket){
            return res.status(404).send("Chamado não encontrado");
        }


        const company = await Company.findById(companyId);


        const html = `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

body{

font-family:Arial;

padding:40px;

}


.header{

text-align:center;

border-bottom:2px solid #000;

padding-bottom:15px;

}


h1{

margin:0;

}


.box{

border:1px solid #ccc;

padding:15px;

margin-top:20px;

border-radius:8px;

}


.label{

font-weight:bold;

}


</style>


</head>


<body>


<div class="header">

<h1>${company?.name || "Bits & Bytes Tecnology"}</h1>

<h2>ORDEM DE SERVIÇO</h2>

</div>



<div class="box">

<p>
<span class="label">OS:</span>
${ticket.numeroOS}
</p>


<p>
<span class="label">Data:</span>
${new Date(ticket.createdAt).toLocaleDateString("pt-BR")}
</p>


<p>
<span class="label">Cliente:</span>
${ticket.cliente}
</p>


<p>
<span class="label">Telefone:</span>
${ticket.telefone}
</p>


<p>
<span class="label">CPF/CNPJ:</span>
${ticket.cpfcnpj || ""}
</p>


</div>



<div class="box">


<p>
<span class="label">Equipamento:</span>
${ticket.equipamento}
</p>


<p>
<span class="label">Problema informado:</span>
</p>


<p>
${ticket.problema}
</p>


</div>



<div class="box">


<p>
<span class="label">Observações:</span>
</p>


<p>
${ticket.observacoes || ""}
</p>


</div>


<br><br>


_________________________________

<br>

Assinatura do cliente


</body>

</html>


`;


const browser = await puppeteer.launch(

process.env.RENDER

? {

executablePath: await chromium.executablePath(),

args: chromium.args,

headless:true

}

: {

headless:true

}

);



const page = await browser.newPage();


await page.setContent(html,{
    waitUntil:"networkidle0"
});


const pdf = await page.pdf({

format:"A4",

printBackground:true

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


res.end(pdf);



    }catch(err){

        console.log(err);

        res.status(500).send(
            "Erro ao gerar OS"
        );

    }


});

/* ===================== BUSCAR POR ID ===================== */
router.get("/:id", async (req, res) => {
  try {
    const companyId = req.session?.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: "Sessão inválida" });
    }

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      companyId
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket não encontrado" });
    }

    res.json(ticket);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar ticket" });
  }
});


/* ===================== ATUALIZAR STATUS ===================== */
router.put("/:id", async (req, res) => {
  try {
    const companyId = req.session?.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: "Sessão inválida" });
    }

    const ticket = await Ticket.findOneAndUpdate(
      { _id: req.params.id, companyId },
      { $set: { status: req.body.status } },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({ error: "Ticket não encontrado" });
    }

    res.json(ticket);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar chamado" });
  }
});

/* ===================== DELETE ===================== */
router.delete("/:id", async (req, res) => {
  try {
    const companyId = req.session?.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: "Sessão inválida" });
    }

    const deleted = await Ticket.findOneAndDelete({
      _id: req.params.id,
      companyId
    });

    if (!deleted) {
      return res.status(404).json({ error: "Ticket não encontrado" });
    }

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar chamado" });
  }
});


module.exports = router;