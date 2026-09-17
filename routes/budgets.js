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
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const bcrypt = require("bcrypt");

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

        const companyId = req.session.user.companyId;

        const ultimo = await Budget.findOne({
            companyId
        }).sort({
            numero:-1
        });

        const numero =
            ultimo && ultimo.numero
            ? ultimo.numero + 1
            : 1;

        const ano = new Date().getFullYear();

        const codigo = `ORC-${ano}-${String(numero).padStart(6, "0")}`;

        const cliente = await Cliente.findOne({
            _id: req.body.clienteId,
            companyId
        });

        if(!cliente){
            return res.status(400).json({
                error: true,
                message: "Cliente não encontrado."
            });
        }

        let ticket = null;

        if(req.body.ticketId){

            if(!mongoose.Types.ObjectId.isValid(req.body.ticketId)){
                return res.status(400).json({
                    error: true,
                    message: "Chamado inválido."
                });
            }

            ticket = await Ticket.findOne({
                _id: req.body.ticketId,
                companyId
            });

            if(!ticket){
                return res.status(404).json({
                    error: true,
                    message: "Chamado não encontrado."
                });
            }
            const statusChamado =
                String(ticket.status || "").toLowerCase();

            if(statusChamado === "finalizado"){

                return res.status(400).json({
                    error: true,
                    message: "Chamados finalizados não podem receber vínculo de orçamento."
                });

            }


            if(ticket.clienteId){

                if(
                    String(ticket.clienteId) !==
                    String(cliente._id)
                ){

                    return res.status(400).json({
                        error: true,
                        message: "O chamado selecionado pertence a outro cliente."
                    });

                }

            }else{

                const nomeChamado =
                    String(ticket.cliente || "")
                        .trim()
                        .toLowerCase();

                const nomeCliente =
                    String(cliente.nome || "")
                        .trim()
                        .toLowerCase();

                const telefoneChamado =
                    String(ticket.telefone || "")
                        .replace(/\D/g, "");

                const telefoneCliente =
                    String(cliente.telefone || "")
                        .replace(/\D/g, "");


                const mesmoCliente =
                    (
                        telefoneChamado &&
                        telefoneCliente &&
                        telefoneChamado === telefoneCliente
                    ) ||
                    (
                        nomeChamado &&
                        nomeCliente &&
                        nomeChamado === nomeCliente
                    );


                if(!mesmoCliente){

                    return res.status(400).json({
                        error: true,
                        message: "O chamado selecionado não pertence a este cliente."
                    });

                }


                ticket.clienteId =
                    cliente._id;

            }


            if(ticket.budgetId){
                return res.status(400).json({
                    error: true,
                    message: "Este chamado já possui um orçamento vinculado."
                });
            }
        }

        const historico = [
            {
                acao:"Orçamento criado",
                usuario:req.session.user.username,
                data:new Date()
            }
        ];

        if(ticket){
            historico.push({
                acao:`Vinculado ao chamado OS ${ticket.numeroOS}`,
                usuario:req.session.user.username,
                data:new Date()
            });
        }

                /* ===== CÁLCULO SEGURO DOS ITENS E DESCONTOS ===== */

        const itensRecebidos =
            Array.isArray(req.body.itens)
            ? req.body.itens
            : [];

        if(itensRecebidos.length === 0){
            return res.status(400).json({
                error: true,
                message: "Adicione pelo menos um item ao orçamento."
            });
        }

        const itensCalculados = [];

        let subtotalCalculado = 0;
        let descontoCalculado = 0;
        let totalCalculado = 0;

        for(const item of itensRecebidos){

            const quantidade =
                Number(item.quantidade);

            const valor =
                Number(item.valor);

            let descontoItem =
                item.desconto === undefined ||
                item.desconto === null ||
                item.desconto === ""
                ? 0
                : Number(item.desconto);

            if(
                !Number.isFinite(quantidade) ||
                quantidade <= 0 ||
                !Number.isFinite(valor) ||
                valor < 0 ||
                !Number.isFinite(descontoItem) ||
                descontoItem < 0
            ){
                return res.status(400).json({
                    error: true,
                    message: "Existe um item com quantidade, valor ou desconto inválido."
                });
            }

            const totalBruto =
                Number(
                    (quantidade * valor).toFixed(2)
                );

            descontoItem =
                Number(
                    descontoItem.toFixed(2)
                );

            if(descontoItem > totalBruto){
                return res.status(400).json({
                    error: true,
                    message: `O desconto de "${item.descricao || "item"}" não pode ser maior que o valor bruto.`
                });
            }

            const totalLiquido =
                Number(
                    (totalBruto - descontoItem).toFixed(2)
                );

            itensCalculados.push({
                ...item,
                quantidade,
                valor,
                total: totalBruto,
                desconto: descontoItem,
                totalLiquido
            });

            subtotalCalculado += totalBruto;
            descontoCalculado += descontoItem;
            totalCalculado += totalLiquido;
        }

        subtotalCalculado =
            Number(subtotalCalculado.toFixed(2));

        descontoCalculado =
            Number(descontoCalculado.toFixed(2));

        totalCalculado =
            Number(totalCalculado.toFixed(2));

        const budget = await Budget.create({

            companyId,

            numero,

            codigo,

            validade:req.body.validade || 10,

            historico,

            clienteId:cliente._id,

            cliente:req.body.cliente || cliente.nome || "",

            telefone:cliente.telefone || "",

            observacoes:req.body.observacoes || "",

            dataAgendamento:req.body.dataAgendamento || null,

            horaAgendamento:req.body.horaAgendamento || null,

            itens:itensCalculados,

            subtotal:subtotalCalculado,

            desconto:descontoCalculado,

            total:totalCalculado,

            status:req.body.status || "pendente",

            ticketId:ticket ? ticket._id : null,

            numeroOS:ticket ? ticket.numeroOS : null

        });

        if(ticket){
            ticket.budgetId = budget._id;
            await ticket.save();
        }

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


        if(req.body.itens !== undefined){

            if(!Array.isArray(req.body.itens)){
                return res.status(400).json({
                    error: true,
                    message: "Itens do orçamento inválidos."
                });
            }

            const itensCalculados = [];

            let subtotalCalculado = 0;
            let descontoCalculado = 0;
            let totalCalculado = 0;

            for(const item of req.body.itens){

                const quantidade =
                    Number(item.quantidade);

                const valor =
                    Number(item.valor);

                let descontoItem =
                    item.desconto === undefined ||
                    item.desconto === null ||
                    item.desconto === ""
                    ? 0
                    : Number(item.desconto);

                if(
                    !Number.isFinite(quantidade) ||
                    quantidade <= 0 ||
                    !Number.isFinite(valor) ||
                    valor < 0 ||
                    !Number.isFinite(descontoItem) ||
                    descontoItem < 0
                ){
                    return res.status(400).json({
                        error: true,
                        message: "Existe um item com quantidade, valor ou desconto inválido."
                    });
                }

                const totalBruto =
                    Number(
                        (quantidade * valor).toFixed(2)
                    );

                descontoItem =
                    Number(
                        descontoItem.toFixed(2)
                    );

                if(descontoItem > totalBruto){
                    return res.status(400).json({
                        error: true,
                        message: `O desconto de "${item.descricao || "item"}" não pode ser maior que o valor bruto.`
                    });
                }

                const totalLiquido =
                    Number(
                        (totalBruto - descontoItem).toFixed(2)
                    );

                itensCalculados.push({
                    ...item,
                    quantidade,
                    valor,
                    total: totalBruto,
                    desconto: descontoItem,
                    totalLiquido
                });

                subtotalCalculado += totalBruto;
                descontoCalculado += descontoItem;
                totalCalculado += totalLiquido;
            }

            budget.itens =
                itensCalculados;

            budget.subtotal =
                Number(subtotalCalculado.toFixed(2));

            budget.desconto =
                Number(descontoCalculado.toFixed(2));

            budget.total =
                Number(totalCalculado.toFixed(2));
        }


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

let subtotalPdf = 0;
let descontoPdf = 0;
let totalPdf = 0;

budget.itens.forEach(item=>{

    const quantidade =
        Number(item.quantidade || 0);

    const valor =
        Number(item.valor || 0);

    const totalBruto =
        Number.isFinite(Number(item.total))
            ? Number(item.total)
            : quantidade * valor;

    const descontoItem =
        Number(item.desconto || 0);

    const totalLiquido =
        Math.max(
            0,
            totalBruto - descontoItem
        );

    subtotalPdf += totalBruto;
    descontoPdf += descontoItem;
    totalPdf += totalLiquido;

    itensHTML += `

    <tr>

        <td>${item.descricao || ""}</td>

        <td>${quantidade || 1}</td>

        <td>
        R$ ${valor
        .toFixed(2)
        .replace(".",",")}
        </td>

        <td>
        R$ ${totalBruto
        .toFixed(2)
        .replace(".",",")}
        </td>

        <td>
        R$ ${descontoItem
        .toFixed(2)
        .replace(".",",")}
        </td>

        <td>
        R$ ${totalLiquido
        .toFixed(2)
        .replace(".",",")}
        </td>

    </tr>

    `;

});

subtotalPdf =
    Number(subtotalPdf.toFixed(2));

descontoPdf =
    Number(descontoPdf.toFixed(2));

totalPdf =
    Number(totalPdf.toFixed(2));

const valorPermutaPdf =
    Number(budget.valorPermuta || 0);

const descricaoPermutaPdf =
    String(
        budget.descricaoPermuta || ""
    ).trim();

const saldoPermutaPdf =
    Math.max(
        0,
        totalPdf - valorPermutaPdf
    );

const permutaResumoPdf =
    valorPermutaPdf > 0
        ? `
        <div style="
            margin-top:14px;
            padding-top:12px;
            border-top:1px solid rgba(255,255,255,.35);
            font-size:13px;
            line-height:1.55;
        ">
            <div>
                PERMUTA:
                R$ ${valorPermutaPdf
                    .toFixed(2)
                    .replace(".", ",")}
            </div>

            ${
                descricaoPermutaPdf
                    ? `<div>
                        Equipamento recebido:
                        ${descricaoPermutaPdf}
                       </div>`
                    : ""
            }

            <div style="
                margin-top:6px;
                font-weight:bold;
                font-size:15px;
            ">
                SALDO A PAGAR:
                R$ ${saldoPermutaPdf
                    .toFixed(2)
                    .replace(".", ",")}
            </div>
        </div>
        `
        : "";

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
            "{{SUBTOTAL}}",
            subtotalPdf
            .toFixed(2)
            .replace(".",",")
        )

        .replaceAll(
            "{{DESCONTO}}",
            descontoPdf
            .toFixed(2)
            .replace(".",",")
        )

        .replaceAll(
            "{{TOTAL}}",
            totalPdf
            .toFixed(2)
            .replace(".",",")
        )

        .replaceAll(
            "{{PERMUTA_RESUMO}}",
            permutaResumoPdf
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


        /* ===================== LOCALIZAR ORÇAMENTO ===================== */

        const budget = await Budget.findOne({
            _id: req.params.id,
            companyId
        });

        if(!budget){
            return res.status(404).json({
                ok: false,
                error: "Orçamento não encontrado."
            });
        }


        /* ===================== REGISTRAR ESTADO ANTERIOR ===================== */

        const statusAnterior =
            String(budget.status || "");


        /* ===================== REPROVAR ORÇAMENTO ===================== */

        budget.status = "reprovado";

        budget.historico.push({
            acao: "Orçamento reprovado",
            usuario: req.session.user.username,
            data: new Date()
        });

        await budget.save();


        /* ===================== REGISTRAR AUDITORIA ===================== */

        await AuditLog.create({

            companyId,

            acao: "reprovar_orcamento",

            entidade: "Budget",

            entidadeId:
                String(budget._id),

            descricao:
                `Reprovação do orçamento ${budget.codigo || budget.numero || ""}`,

            executadoPor:
                String(req.session.user.username || ""),

            executadoPorId:
                req.session.user._id || null,

            autorizadoPor:
                String(administrador.username || ""),

            autorizadoPorId:
                administrador._id,

            dados: {
                codigo: budget.codigo || "",
                numero: budget.numero || null,
                cliente: budget.cliente || "",
                clienteId: budget.clienteId || null,
                statusAnterior,
                statusNovo: "reprovado",
                total: Number(budget.total || 0)
            },

            data: new Date()

        });


        res.json({
            ok: true,
            message: "Orçamento reprovado com autorização administrativa.",
            budget
        });

    }
    catch(err){

        console.error(
            "Erro ao reprovar orçamento:",
            err
        );

        res.status(500).json({
            ok: false,
            error: "Erro ao reprovar orçamento."
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

        const formasPermitidas = [
            "Dinheiro",
            "PIX",
            "Cartão de Débito",
            "Cartão de Crédito",
            "Transferência"
        ];

        const formaPagamento =
            String(req.body.formaPagamento || "").trim();

        if (!formasPermitidas.includes(formaPagamento)) {

            return res.status(400).json({
                ok: false,
                error: "Selecione uma forma de pagamento válida."
            });

        }

        budget.pagamento = "pago";
        budget.formaPagamento = formaPagamento;
        budget.dataPagamento = new Date();
        budget.usuarioPagamento = req.session.user.username;

        budget.historico.push({
            acao: `Pagamento recebido - ${formaPagamento}`,
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

/* ===================== PERMUTA / TROCA ===================== */

router.put("/:id/permuta", auth, async (req, res) => {

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

        if (budget.status === "reprovado") {
            return res.status(400).json({
                ok: false,
                error: "Não é possível aplicar permuta em orçamento reprovado."
            });
        }

        if (
            budget.pagamento === "pago" ||
            budget.pagamento === "cortesia"
        ) {
            return res.status(400).json({
                ok: false,
                error: "Este orçamento já está quitado."
            });
        }

        const total = Number(budget.total || 0);

        const valorPermuta =
            Number(req.body.valorPermuta);

        const descricaoPermuta =
            String(
                req.body.descricaoPermuta || ""
            ).trim();

        if (
            !Number.isFinite(valorPermuta) ||
            valorPermuta <= 0
        ) {
            return res.status(400).json({
                ok: false,
                error: "Informe um valor válido para a troca."
            });
        }

        if (valorPermuta > total) {
            return res.status(400).json({
                ok: false,
                error: "O valor da troca não pode ser maior que o total do orçamento."
            });
        }

        budget.valorPermuta = valorPermuta;
        budget.descricaoPermuta = descricaoPermuta;

        const saldoRestante =
            Math.max(
                0,
                total - valorPermuta
            );

        if (saldoRestante === 0) {

            budget.pagamento = "permuta";
            budget.dataPagamento = new Date();
            budget.usuarioPagamento =
                req.session.user.username;
            budget.formaPagamento = "";

        } else {

            budget.pagamento = "pendente";
            budget.dataPagamento = null;
            budget.usuarioPagamento = null;
            budget.formaPagamento = "";

        }

        budget.historico.push({
            acao:
                `Permuta registrada - R$ ${valorPermuta.toFixed(2)} - Saldo restante R$ ${saldoRestante.toFixed(2)}`,
            usuario: req.session.user.username,
            data: new Date()
        });

        await budget.save();

        res.json({
            ok: true,
            saldoRestante,
            budget
        });

    } catch (err) {

        console.log(
            "ERRO AO REGISTRAR PERMUTA:",
            err
        );

        res.status(500).json({
            ok: false,
            error: "Erro ao registrar permuta."
        });

    }

});
/* ===================== CANCELAR PAGAMENTO ===================== */

router.put("/:id/cancelar-pagamento", auth, async (req, res) => {

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


        /* ===================== LOCALIZAR ORÇAMENTO ===================== */

        const budget = await Budget.findOne({
            _id: req.params.id,
            companyId
        });

        if(!budget){
            return res.status(404).json({
                ok: false,
                error: "Orçamento não encontrado."
            });
        }


        /* ===================== REGISTRAR ESTADO ANTERIOR ===================== */

        const pagamentoAnterior =
            String(budget.pagamento || "");

        const formaPagamentoAnterior =
            String(budget.formaPagamento || "");

        const dataPagamentoAnterior =
            budget.dataPagamento || null;

        const usuarioPagamentoAnterior =
            budget.usuarioPagamento || null;

        const valorPermutaAnterior =
            Number(budget.valorPermuta || 0);

        const descricaoPermutaAnterior =
            String(budget.descricaoPermuta || "");

        const eraPermutaTotal =
            budget.pagamento === "permuta";


        /* ===================== CANCELAR PAGAMENTO ===================== */

        budget.pagamento = "pendente";
        budget.dataPagamento = null;
        budget.usuarioPagamento = null;
        budget.formaPagamento = "";

        if(eraPermutaTotal){

            budget.valorPermuta = 0;
            budget.descricaoPermuta = "";

        }

        budget.historico.push({
            acao: eraPermutaTotal
                ? "Permuta cancelada"
                : "Pagamento cancelado",
            usuario: req.session.user.username,
            data: new Date()
        });

        await budget.save();


        /* ===================== REGISTRAR AUDITORIA ===================== */

        await AuditLog.create({

            companyId,

            acao: eraPermutaTotal
                ? "cancelar_permuta_orcamento"
                : "cancelar_pagamento_orcamento",

            entidade: "Budget",

            entidadeId:
                String(budget._id),

            descricao: eraPermutaTotal
                ? `Cancelamento da permuta do orçamento ${budget.codigo || budget.numero || ""}`
                : `Cancelamento do pagamento do orçamento ${budget.codigo || budget.numero || ""}`,

            executadoPor:
                String(req.session.user.username || ""),

            executadoPorId:
                req.session.user._id || null,

            autorizadoPor:
                String(administrador.username || ""),

            autorizadoPorId:
                administrador._id,

            dados: {
                codigo: budget.codigo || "",
                numero: budget.numero || null,
                cliente: budget.cliente || "",
                clienteId: budget.clienteId || null,
                pagamentoAnterior,
                pagamentoNovo: "pendente",
                formaPagamentoAnterior,
                dataPagamentoAnterior,
                usuarioPagamentoAnterior,
                eraPermutaTotal,
                valorPermutaAnterior,
                descricaoPermutaAnterior,
                total: Number(budget.total || 0)
            },

            data: new Date()

        });


        res.json({
            ok: true,
            message: eraPermutaTotal
                ? "Permuta cancelada com autorização administrativa."
                : "Pagamento cancelado com autorização administrativa.",
            budget
        });

    }
    catch(err){

        console.error(
            "Erro ao cancelar pagamento do orçamento:",
            err
        );

        res.status(500).json({
            ok: false,
            error: "Erro ao cancelar pagamento."
        });

    }

});
/* ===================== CONVERTER ORÇAMENTO EM CHAMADO ===================== */

/* ===================== EXCLUIR ORÇAMENTO COM AUTORIZAÇÃO ADMINISTRATIVA ===================== */

router.delete("/:id", auth, async (req, res) => {

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


        /* ===================== LOCALIZAR ORÇAMENTO ===================== */

        const budget = await Budget.findOne({
            _id: req.params.id,
            companyId
        });

        if(!budget){
            return res.status(404).json({
                ok: false,
                error: "Orçamento não encontrado."
            });
        }


        /* ===================== PRESERVAR REGRA DE OS ===================== */

        if(
            budget.status === "convertido" ||
            budget.ticketId
        ){
            return res.status(400).json({
                ok: false,
                error: "Este orçamento já foi convertido em Ordem de Serviço e não pode ser excluído."
            });
        }


        /* ===================== REGISTRAR AUDITORIA ===================== */

        await AuditLog.create({

            companyId,

            acao: "excluir_orcamento",

            entidade: "Budget",

            entidadeId:
                String(budget._id),

            descricao:
                `Exclusão do orçamento ${budget.codigo || budget.numero || ""}`,

            executadoPor:
                String(req.session.user.username || ""),

            executadoPorId:
                req.session.user._id || null,

            autorizadoPor:
                String(administrador.username || ""),

            autorizadoPorId:
                administrador._id,

            dados: {
                codigo: budget.codigo || "",
                numero: budget.numero || null,
                cliente: budget.cliente || "",
                clienteId: budget.clienteId || null,
                status: budget.status || "",
                pagamento: budget.pagamento || "",
                subtotal: Number(budget.subtotal || 0),
                desconto: Number(budget.desconto || 0),
                total: Number(budget.total || 0),
                valorPermuta: Number(budget.valorPermuta || 0),
                descricaoPermuta: budget.descricaoPermuta || "",
                ticketId: budget.ticketId || null
            },

            data: new Date()

        });


        /* ===================== EXCLUIR ORÇAMENTO ===================== */

        await Budget.deleteOne({
            _id: budget._id,
            companyId
        });


        res.json({
            ok: true,
            message: "Orçamento excluído com autorização administrativa."
        });

    }
    catch(err){

        console.error(
            "Erro ao excluir orçamento:",
            err
        );

        res.status(500).json({
            ok: false,
            error: "Erro ao excluir orçamento."
        });

    }

});
/* ===================== VINCULAR ORÇAMENTO A CHAMADO EXISTENTE ===================== */

router.put("/:id/vincular-chamado", auth, async (req, res) => {

    try {

        const companyId = req.session.user.companyId;
        const ticketId = req.body.ticketId;

        if(!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)){

            return res.status(400).json({
                ok:false,
                error:"Chamado inválido."
            });

        }


        const budget = await Budget.findOne({
            _id:req.params.id,
            companyId
        });

        if(!budget){

            return res.status(404).json({
                ok:false,
                error:"Orçamento não encontrado."
            });

        }


        const ticket = await Ticket.findOne({
            _id:ticketId,
            companyId
        });

        if(!ticket){

            return res.status(404).json({
                ok:false,
                error:"Chamado não encontrado."
            });

        }
        const statusChamado =
            String(ticket.status || "").toLowerCase();

        if(statusChamado === "finalizado"){

            return res.status(400).json({
                ok:false,
                error:"Chamados finalizados não podem receber vínculo de orçamento."
            });

        }
        if(!budget.clienteId){

            return res.status(400).json({
                ok:false,
                error:"Este orçamento não possui cliente vinculado corretamente."
            });

        }


        if(ticket.clienteId){

            if(
                String(budget.clienteId) !==
                String(ticket.clienteId)
            ){

                return res.status(400).json({
                    ok:false,
                    error:"O orçamento e o chamado pertencem a clientes diferentes."
                });

            }

        }else{

            const nomeOrcamento =
                String(budget.cliente || "")
                    .trim()
                    .toLowerCase();

            const nomeChamado =
                String(ticket.cliente || "")
                    .trim()
                    .toLowerCase();

            const telefoneOrcamento =
                String(budget.telefone || "")
                    .replace(/\D/g, "");

            const telefoneChamado =
                String(ticket.telefone || "")
                    .replace(/\D/g, "");


            const mesmoCliente =
                (
                    telefoneOrcamento &&
                    telefoneChamado &&
                    telefoneOrcamento === telefoneChamado
                ) ||
                (
                    nomeOrcamento &&
                    nomeChamado &&
                    nomeOrcamento === nomeChamado
                );


            if(!mesmoCliente){

                return res.status(400).json({
                    ok:false,
                    error:"Este chamado não está vinculado ao cliente deste orçamento."
                });

            }


            ticket.clienteId =
                budget.clienteId;

        }


        if(
            budget.ticketId &&
            String(budget.ticketId) !== String(ticket._id)
        ){

            return res.status(400).json({
                ok:false,
                error:"Este orçamento já está vinculado a outro chamado."
            });

        }


        if(
            ticket.budgetId &&
            String(ticket.budgetId) !== String(budget._id)
        ){

            return res.status(400).json({
                ok:false,
                error:"Este chamado já está vinculado a outro orçamento."
            });

        }


        if(
            budget.ticketId &&
            String(budget.ticketId) === String(ticket._id) &&
            ticket.budgetId &&
            String(ticket.budgetId) === String(budget._id)
        ){

            return res.json({
                ok:true,
                message:"Orçamento e chamado já estão vinculados.",
                numeroOS:ticket.numeroOS
            });

        }


        budget.ticketId = ticket._id;
        budget.numeroOS = ticket.numeroOS;

        if(!Array.isArray(budget.historico)){
            budget.historico = [];
        }

        budget.historico.push({
            acao:`Vinculado ao chamado OS ${ticket.numeroOS}`,
            usuario:
                req.session.user.username ||
                req.session.user.nome ||
                "Usuário",
            data:new Date()
        });


        ticket.budgetId = budget._id;


        await budget.save();
        await ticket.save();


        return res.json({
            ok:true,
            message:"Chamado vinculado com sucesso.",
            ticketId:ticket._id,
            numeroOS:ticket.numeroOS
        });


    } catch(err) {

        console.log("ERRO AO VINCULAR ORÇAMENTO AO CHAMADO:");
        console.log(err);

        return res.status(500).json({
            ok:false,
            error:err.message
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