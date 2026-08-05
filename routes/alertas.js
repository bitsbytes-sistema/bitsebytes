const express = require("express");
const router = express.Router();

const alertasService = require("../services/alertasService");

function auth(req, res, next){

    if(!req.session.user){
        return res.status(401).json({
            error:"not_logged"
        });
    }

    next();

}

router.get("/", auth, async (req,res)=>{

    try{

        const companyId =
            req.session.user.companyId;

        const alertas = [];

        alertas.push(
            await alertasService.aniversariantes(companyId)
        );

        alertas.push(
            await alertasService.contasReceber(companyId)
        );

        alertas.push(
            await alertasService.contasPagar(companyId)
        );

        alertas.push(
            await alertasService.chamados(companyId)
        );

        alertas.push(
            await alertasService.orcamentos(companyId)
        );

        alertas.push(
            await alertasService.estoque(companyId)
        );

        res.json(alertas);

    }catch(err){

        console.log(err);

        res.status(500).json({
            error:true
        });

    }

});

module.exports = router;