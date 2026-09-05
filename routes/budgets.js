const express = require("express");
const router = express.Router();
const QRCode = require("qrcode");

const chromium = require("@sparticuz/chromium");

const puppeteer =
    process.env.RENDER
        ? require("puppeteer-core")
        : require("puppeteer");

const mongoose = require("mongoose");

const Budget = require("../models/Budget");
const Cliente = require("../models/Cliente");
const Company = require("../models/Company");
const Ticket = require("../models/Ticket");

const path = require("path");
const fs = require("fs");

/* ===================== CONSULTA PÚBLICA ===================== */

router.get("/consulta/:id", async (req, res) => {

    try {

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).send("Orçamento não encontrado.");
        }

        const budget = await Budget.findById(req.params.id)
.populate("clienteId");

        if (!budget) {
            return res.status(404).send("Orçamento não encontrado.");
        }

        const company = await Company.findById(budget.companyId);

const logoHTML = company?.logo
    ? `<img src="${company.logo}" class="logo">`
    : "";

const corPrimaria = company?.primaryColor || "#2563eb";
const corSecundaria = company?.secondaryColor || "#0f172a";


res.send(`
<!DOCTYPE html>
<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${budget.codigo}</title>


<style>

*{
box-sizing:border-box;
}


body{

margin:0;

padding:20px;

font-family:Arial,Helvetica,sans-serif;

background:#f1f5f9;

}


.container{

max-width:850px;

margin:auto;

background:white;

padding:30px;

border-radius:15px;

box-shadow:0 10px 30px rgba(0,0,0,.12);

}


.header{

display:flex;

align-items:center;

gap:20px;

border-bottom:3px solid ${corPrimaria};

padding-bottom:20px;

}


.logo{

max-width:90px;

max-height:90px;

object-fit:contain;

}


.empresa{

font-size:26px;

font-weight:bold;

color:${corSecundaria};

}


.titulo{

margin-top:25px;

font-size:22px;

color:${corSecundaria};

}


.info{

background:#f8fafc;

padding:15px;

border-radius:10px;

margin-top:20px;

}


.status{

display:inline-block;

padding:7px 18px;

border-radius:20px;

background:${corPrimaria};

color:white;

font-weight:bold;

}


table{

width:100%;

border-collapse:collapse;

margin-top:25px;

}


th{

background:${corSecundaria};

color:white;

padding:12px;

text-align:left;

}


td{

padding:12px;

border-bottom:1px solid #ddd;

}


.total{

margin-top:25px;

text-align:right;

font-size:28px;

font-weight:bold;

color:${corSecundaria};

}


.footer{

margin-top:30px;

text-align:center;

font-size:13px;

color:#64748b;

}


@media(max-width:600px){

.container{

padding:20px;

}


.header{

flex-direction:column;

text-align:center;

}

table{

font-size:13px;

}

}


</style>


</head>


<body>


<div class="container">


<div class="header">

${logoHTML}

<div class="empresa">

${company?.name || "Bits & Bytes Tecnology"}

</div>

</div>



<div class="titulo">

ORÇAMENTO ${budget.codigo}

</div>



<div class="info">


<p>
<strong>Cliente:</strong>
${budget.cliente || budget.clienteId?.nome || ""}
</p>


<p>

<strong>Status:</strong>

<span class="status">

${budget.status || "pendente"}

</span>

</p>


</div>



<table>


<tr>

<th>Descrição</th>

<th>Qtd</th>

<th>Valor</th>

<th>Total</th>

</tr>



${budget.itens.map(item=>`

<tr>

<td>${item.descricao}</td>

<td>${item.quantidade || 1}</td>

<td>
R$ ${Number(item.valor || 0)
.toFixed(2)
.replace(".",",")}
</td>

<td>
R$ ${Number(item.total || 0)
.toFixed(2)
.replace(".",",")}
</td>


</tr>

`).join("")}



</table>



<div class="total">

TOTAL:

R$ ${Number(budget.total || 0)
.toFixed(2)
.replace(".",",")}


</div>



<div class="footer">

Orçamento gerado digitalmente por ${company?.name || "Bits & Bytes Tecnology"}

</div>



</div>


</body>

</html>
`);

    } catch (err) {

        console.log(err);

        res.status(500).send("Erro interno.");

    }

});

function auth(req,res,next){

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

        const budgets = await Budget.find({

            companyId:req.session.user.companyId

        }).sort({

            createdAt:-1

        });


        res.json(budgets);


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


        const ultimo = await Budget.findOne({

            companyId:req.session.user.companyId

        }).sort({

            numero:-1

        });


        const numero =
            ultimo && ultimo.numero
            ? ultimo.numero + 1
            : 1;

const ano = new Date().getFullYear();

const codigo = `ORC-${ano}-${String(numero).padStart(6, "0")}`;


        const cliente =
            await Cliente.findById(req.body.clienteId);



const budget = await Budget.create({

    companyId:req.session.user.companyId,

    numero,

    codigo,

    validade:req.body.validade || 10,

    historico:[
        {
            acao:"Orçamento criado",
            usuario:req.session.user.username,
            data:new Date()
        }
    ],

    clienteId:req.body.clienteId || null,

    cliente:req.body.cliente || "",

        telefone:cliente?.telefone || "",

    observacoes:req.body.observacoes || "",

    dataAgendamento:req.body.dataAgendamento || null,

    horaAgendamento:req.body.horaAgendamento || null,

    itens:req.body.itens || [],

    total:req.body.total || 0,

    status:req.body.status || "pendente"

});

console.log(budget);

res.json(budget);

} catch (err) {

    console.log(err);

    res.status(500).json({
        error: true
    });

}

});


/* ===================== BUSCAR ===================== */

router.get("/:id", auth, async(req,res)=>{


    try{


        const budget =
            await Budget.findOne({

                _id:req.params.id,

                companyId:req.session.user.companyId

            });



        if(!budget){

            return res.status(404).json({
                error:true
            });

        }


        res.json(budget);



    }catch(err){

        console.log(err);

        res.status(500).json({
            error:true
        });

    }


});



/* ===================== EDITAR ===================== */


router.put("/:id", auth, async(req,res)=>{


    try{


        const budget =
            await Budget.findOne({

                _id:req.params.id,

                companyId:req.session.user.companyId

            });



        if(!budget){

            return res.status(404).json({

                error:"Orçamento não encontrado"

            });

        }



        if(req.body.clienteId !== undefined)
            budget.clienteId=req.body.clienteId;


        if(req.body.cliente !== undefined)
            budget.cliente=req.body.cliente;


        if(req.body.telefone !== undefined)
            budget.telefone=req.body.telefone;


        if(req.body.observacoes !== undefined)
            budget.observacoes=req.body.observacoes;


        if(req.body.itens !== undefined)
            budget.itens=req.body.itens;


        if(req.body.total !== undefined)
            budget.total=req.body.total;


        if(req.body.status !== undefined)
            budget.status=req.body.status;



        await budget.save();



        res.json({

            ok:true,

            budget

        });



    }catch(err){


        console.log(err);


        res.status(500).json({

            error:true

        });


    }


});

/* ===================== GERAR PDF ===================== */

router.get("/:id/pdf", auth, async (req,res)=>{

    try{


if(!mongoose.Types.ObjectId.isValid(req.params.id)){

    return res.status(400).json({
        error:"ID de orçamento inválido"
    });

}

        const budget = await Budget.findOne({

            _id:req.params.id,

            companyId:req.session.user.companyId

        });



        if(!budget){
            return res.status(404).json({

                error:"Orçamento não encontrado"

            });

        }



        const company =
            await Company.findById(
                req.session.user.companyId
            );



        let template = fs.readFileSync(

            path.join(
                __dirname,
                "../templates/orcamento.html"
            ),

            "utf8"

        );


        let itensHTML = "";



        budget.itens.forEach(item=>{


            itensHTML += `

            <tr>

                <td>${item.descricao || ""}</td>

                <td>${item.quantidade || 1}</td>

                <td>
                R$ ${Number(item.valor || 0)
                .toFixed(2)
                .replace(".",",")}
                </td>

                <td>
                R$ ${Number(item.total || 0)
                .toFixed(2)
                .replace(".",",")}
                </td>

            </tr>

            `;


        });

const logoPath = path.join(process.cwd(), "public", "logo.png");

let logoHTML = "";

if (fs.existsSync(logoPath)) {

    const logoBase64 = fs.readFileSync(logoPath, "base64");

    logoHTML = `<img src="data:image/png;base64,${logoBase64}" alt="Logo">`;

}

// ================= QR CODE =================

const urlConsulta =
`${process.env.APP_URL}/api/budgets/consulta/${budget._id}`;

const qrCodeBase64 = await QRCode.toDataURL(urlConsulta, {
    width: 180,
    margin: 1
});

const qrCodeHTML = `
<div class="qr-box">

    <img src="${qrCodeBase64}" alt="QR Code">

    <div class="qr-text">

        <strong>${budget.codigo}</strong><br>

        Escaneie para consultar
        este orçamento.

    </div>

</div>
`;

        template = template

	.replaceAll(
    	    "{{PRIMARY_COLOR}}",
    		company?.primaryColor || "#2563eb"
	)

	.replaceAll(
    	    "{{SECONDARY_COLOR}}",
   		 company?.secondaryColor || "#0f172a"
	)

	.replaceAll(
    	    "{{CNPJ}}",
   		 company?.cnpj || "39.706.762.0001-43"
	)

	.replaceAll(
    	    "{{ENDERECO}}",
    		company?.address || "R. Durval Bartolomeu T. Mendes"
	)

	.replaceAll(
    	    "{{SITE}}",
    		company?.website || "@bitsebytestecnology"
	)

	.replaceAll(
   	    "{{STATUS}}",
    		budget.status || "Pendente"
	)

	.replaceAll(
   	    "{{VALIDADE}}",
   		 "10 dias"
	)

        .replaceAll(
    	     "{{EMPRESA}}",
    	   company?.name || "Bits & Bytes Tecnology"
	)

        .replaceAll(
            "{{TELEFONE}}",
            company?.phone || "69981442610"
        )

        .replaceAll(
            "{{EMAIL}}",
            company?.email || "bitsebytestecnology@gmail.com"
        )

        .replaceAll(
    "{{NUMERO}}",
    budget.codigo || String(budget.numero).padStart(6, "0")
)

        .replaceAll(
            "{{DATA}}",
            new Date(
                budget.createdAt
            ).toLocaleDateString("pt-BR")
        )

        .replaceAll(
            "{{CLIENTE}}",
            budget.cliente || ""
        )

        .replaceAll(
            "{{TELEFONE_CLIENTE}}",
            budget.telefone || ""
        )

        .replaceAll(
            "{{ITENS}}",
            itensHTML
        )

        .replaceAll(
            "{{TOTAL}}",
            Number(budget.total || 0)
            .toFixed(2)
            .replace(".",",")
        )

        .replaceAll(
            "{{OBSERVACOES}}",
            budget.observacoes || ""
        )

.replaceAll(
    "{{LOGO}}",
    logoHTML
)

.replaceAll(
    "{{QRCODE}}",
    qrCodeHTML
)


const browser = await puppeteer.launch(

    process.env.RENDER
        ? {
            executablePath: await chromium.executablePath(),
            args: chromium.args,
            headless: true
        }
        : {
            headless: true
        }

);
               

        const page =
            await browser.newPage();



        await page.setContent(
            template,
            {
                waitUntil:"networkidle0"
            }
        );



const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm"
    }
});

console.log("PDF gerado. Tamanho:", pdf.length);



        await browser.close();


res.setHeader("Content-Type", "application/pdf");
res.setHeader(
    "Content-Disposition",
    `inline; filename="orcamento-${budget.numero}.pdf"`
);
res.setHeader("Content-Length", pdf.length);

res.end(pdf);


    }catch(err){

        console.log(err);


        res.status(500).json({

            error:true

        });

    }


});

/* ===================== APROVAR ORÇAMENTO ===================== */

router.put("/:id/aprovar", auth, async (req, res) => {

    try {

        const budget = await Budget.findOne({
            _id: req.params.id,
            companyId: req.session.user.companyId
        });

        if (!budget) {
            return res.status(404).json({
                error: "Orçamento não encontrado"
            });
        }

        budget.status = "aprovado";

        await budget.save();

        res.json({
            ok: true,
            budget
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            error: true
        });

    }

});

/* ===================== REPROVAR ORÇAMENTO ===================== */

router.put("/:id/reprovar", auth, async (req, res) => {

    try {

        const budget = await Budget.findOne({
            _id: req.params.id,
            companyId: req.session.user.companyId
        });

        if (!budget) {
            return res.status(404).json({
                error: "Orçamento não encontrado"
            });
        }

        budget.status = "reprovado";

        budget.historico.push({
            acao: "Orçamento reprovado",
            usuario: req.session.user.username,
            data: new Date()
        });

        await budget.save();

        res.json({
            ok: true,
            budget
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            error: true
        });

    }

});

/* ===================== MARCAR COMO PAGO ===================== */

router.put("/:id/pagar", auth, async (req, res) => {

    try {

        const budget = await Budget.findOne({
            _id: req.params.id,
            companyId: req.session.user.companyId
        });

        if (!budget) {
            return res.status(404).json({
                error: "Orçamento não encontrado"
            });
        }

        if (budget.pagamento === "pago") {
            return res.json({
                ok: false,
                error: "Este orçamento já está pago."
            });
        }

        budget.pagamento = "pago";
        budget.dataPagamento = new Date();
        budget.usuarioPagamento = req.session.user.username;

        budget.historico.push({
            acao: "Pagamento recebido",
            usuario: req.session.user.username,
            data: new Date()
        });

        await budget.save();

        res.json({
            ok: true,
            budget
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            error: true
        });

    }

});

/* ===================== MARCAR COMO CORTESIA ===================== */

router.put("/:id/cortesia", auth, async (req, res) => {

    try {

        const budget = await Budget.findOne({
            _id: req.params.id,
            companyId: req.session.user.companyId
        });

        if (!budget) {
            return res.status(404).json({
                error: "Orçamento não encontrado"
            });
        }

        if (budget.pagamento === "cortesia") {
            return res.json({
                ok: false,
                error: "Este orçamento já está marcado como cortesia."
            });
        }

        budget.pagamento = "cortesia";
        budget.dataPagamento = new Date();
        budget.usuarioPagamento = req.session.user.username;

        budget.historico.push({
            acao: "Orçamento marcado como cortesia",
            usuario: req.session.user.username,
            data: new Date()
        });

        await budget.save();

        res.json({
            ok: true,
            budget
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            error: true
        });

    }

});

/* ===================== MARCAR COMO PERMUTA ===================== */

router.put("/:id/permuta", auth, async (req, res) => {

    try {

        const budget = await Budget.findOne({
            _id: req.params.id,
            companyId: req.session.user.companyId
        });

        if (!budget) {
            return res.status(404).json({
                error: "Orçamento não encontrado"
            });
        }

        if (budget.pagamento === "permuta") {
            return res.json({
                ok: false,
                error: "Este orçamento já está marcado como permuta."
            });
        }

        budget.pagamento = "permuta";
        budget.dataPagamento = new Date();
        budget.usuarioPagamento = req.session.user.username;

        budget.historico.push({
            acao: "Orçamento marcado como permuta",
            usuario: req.session.user.username,
            data: new Date()
        });

        await budget.save();

        res.json({
            ok: true,
            budget
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            error: true
        });

    }

});

/* ===================== CANCELAR PAGAMENTO ===================== */

router.put("/:id/cancelar-pagamento", auth, async (req, res) => {

    try {

        const budget = await Budget.findOne({
            _id: req.params.id,
            companyId: req.session.user.companyId
        });

        if (!budget) {
            return res.status(404).json({
                error: "Orçamento não encontrado"
            });
        }

        budget.pagamento = "pendente";
        budget.dataPagamento = null;
        budget.usuarioPagamento = null;

        budget.historico.push({
            acao: "Pagamento cancelado",
            usuario: req.session.user.username,
            data: new Date()
        });

        await budget.save();

        res.json({
            ok: true,
            budget
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            error: true
        });

    }

});

/* ===================== CONVERTER ORÇAMENTO EM CHAMADO ===================== */

/* ===================== EXCLUIR ORÇAMENTO ===================== */

router.delete("/:id", auth, async (req, res) => {

    try {

        const budget = await Budget.findOne({
            _id: req.params.id,
            companyId: req.session.user.companyId
        });

        if (!budget) {
            return res.status(404).json({
                ok: false,
                error: "Orçamento não encontrado."
            });
        }

        if (budget.status === "convertido" || budget.ticketId) {
            return res.status(400).json({
                ok: false,
                error: "Este orçamento já foi convertido em Ordem de Serviço e não pode ser excluído."
            });
        }

        await Budget.deleteOne({
            _id: budget._id,
            companyId: req.session.user.companyId
        });

        res.json({
            ok: true
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            ok: false,
            error: "Erro ao excluir orçamento."
        });

    }

});

router.post("/:id/converter", auth, async(req,res)=>{

    try{

        const budget = await Budget.findOne({

            _id:req.params.id,

            companyId:req.session.user.companyId

        });


        if(!budget){

            return res.status(404).json({
                error:"Orçamento não encontrado"
            });

        }


        // impede duplicar chamado
        if(budget.ticketId){

            return res.json({

                ok:false,

                error:"Este orçamento já foi convertido em chamado."

            });

        }

const ultimoTicket = await Ticket.findOne({

    companyId:req.session.user.companyId

}).sort({

    numeroOS:-1

});


const proximaOS =
    ultimoTicket && ultimoTicket.numeroOS
    ? ultimoTicket.numeroOS + 1
    : 1;

        const ticket = await Ticket.create({

    companyId:req.session.user.companyId,

    numeroOS: proximaOS,

    cliente:budget.cliente,

    telefone:budget.telefone,

    equipamento:"",

    problema:"Orçamento aprovado",

    observacoes:budget.observacoes,

    status:"aberto",

    origem:"orcamento",

    budgetId:budget._id

});



        budget.ticketId = ticket._id;

budget.numeroOS = ticket.numeroOS;

budget.status = "convertido";

await budget.save();



        res.json({

            ok:true,

            ticketId:ticket._id

        });


}catch(err){

    console.log("ERRO AO CONVERTER ORÇAMENTO:");
    console.log(err);

    res.status(500).json({

        error: err.message

    });

}


});

module.exports = router;