const express = require("express");
const router = express.Router();

const AuditLog = require("../models/AuditLog");


router.get("/", async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;

        let limite =
            Number(req.query.limite || 100);

        if(
            !Number.isInteger(limite) ||
            limite < 1
        ){
            limite = 100;
        }

        limite =
            Math.min(limite, 500);

        const registros =
            await AuditLog.find({
                companyId
            })
            .sort({
                data: -1,
                _id: -1
            })
            .limit(limite)
            .lean();

        return res.json({
            ok: true,
            total: registros.length,
            registros
        });

    } catch (err) {

        console.error(
            "ERRO AO LISTAR AUDITORIA:",
            err
        );

        return res.status(500).json({
            ok: false,
            error: "Erro ao carregar auditoria."
        });

    }

});


module.exports = router;
