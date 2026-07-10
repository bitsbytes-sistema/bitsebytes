const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");

const Budget = require("../models/Budget");
const Cliente = require("../models/Cliente");
const Company = require("../models/Company");
const Ticket = require("../models/Ticket");

const path = require("path");
const fs = require("fs");

let puppeteer;



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



        const cliente =
            await Cliente.findById(req.body.clienteId);



        const budget = await Budget.create({

            companyId:req.session.user.companyId,

            numero,

            clienteId:req.body.clienteId || null,

            cliente:req.body.cliente || "",

            telefone:cliente?.telefone || "",

            observacoes:req.body.observacoes || "",

            itens:req.body.itens || [],

            total:req.body.total || 0,

            status:req.body.status || "pendente"

        });



        res.json(budget);



    }catch(err){

        console.log(err);

        res.status(500).json({
            error:true
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

if(!puppeteer){
    puppeteer = await import("puppeteer");
    puppeteer = puppeteer.default;
}

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



        template = template

        .replace(
            "{{EMPRESA}}",
            company?.name || "Bits & Bytes Tecnology"
        )

        .replace(
            "{{TELEFONE}}",
            company?.phone || ""
        )

        .replace(
            "{{EMAIL}}",
            company?.email || ""
        )

        .replace(
            "{{NUMERO}}",
            budget.numero
        )

        .replace(
            "{{DATA}}",
            new Date(
                budget.createdAt
            ).toLocaleDateString("pt-BR")
        )

        .replace(
            "{{CLIENTE}}",
            budget.cliente || ""
        )

        .replace(
            "{{TELEFONE_CLIENTE}}",
            budget.telefone || ""
        )

        .replace(
            "{{ITENS}}",
            itensHTML
        )

        .replace(
            "{{TOTAL}}",
            Number(budget.total || 0)
            .toFixed(2)
            .replace(".",",")
        )

        .replace(
            "{{OBSERVACOES}}",
            budget.observacoes || ""
        )

        .replace(
            "{{LOGO}}",
            ""
        );



        const browser =
            await puppeteer.launch({

                headless:true,

                args:[
                    "--no-sandbox",
                    "--disable-setuid-sandbox"
                ]

            });



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