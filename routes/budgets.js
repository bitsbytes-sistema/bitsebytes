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

        res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>

<meta charset="UTF-8">

<title>${budget.codigo}</title>

<style>

body{

    margin:40px;

    font-family:Arial,Helvetica,sans-serif;

    background:#f4f6f9;

}

.container{

    max-width:900px;

    margin:auto;

    background:#fff;

    padding:40px;

    border-radius:12px;

    box-shadow:0 10px 30px rgba(0,0,0,.1);

}

h1{

    color:#0f172a;

}

table{

    width:100%;

    border-collapse:collapse;

    margin-top:20px;

}

th,td{

    border:1px solid #ddd;

    padding:10px;

}

th{

    background:#0f172a;

    color:white;

}

.status{

    display:inline-block;

    padding:6px 14px;

    border-radius:30px;

    background:#2563eb;

    color:white;

    font-weight:bold;

}

.total{

    margin-top:20px;

    text-align:right;

    font-size:26px;

    font-weight:bold;

}

</style>

</head>

<body>

<div class="container">

<h1>${company?.name || "Empresa"}</h1>

<h2>Orçamento ${budget.codigo}</h2>

<p><strong>Cliente:</strong> ${budget.cliente}</p>

<p><strong>Status:</strong> <span class="status">${budget.status}</span></p>

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

<td>${item.quantidade}</td>

<td>R$ ${Number(item.valor).toFixed(2).replace(".",",")}</td>

<td>R$ ${Number(item.total).toFixed(2).replace(".",",")}</td>

</tr>

`).join("")}

</table>

<div class="total">

R$ ${Number(budget.total).toFixed(2).replace(".",",")}

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

/* ===================== CONVERTER ORÇAMENTO EM CHAMADO ===================== */

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