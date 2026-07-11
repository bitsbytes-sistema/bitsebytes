const express = require("express");
const Service = require("../models/Service");

const router = express.Router();

function converterValor(valor) {

  if (valor === undefined || valor === null || valor === "") {
    return 0;
  }

  if (typeof valor === "number") {
    return valor;
  }

  return Number(
    String(valor)
      .trim()
      .replace(/\./g, "")
      .replace(",", ".")
  );

}

/* ===================== LISTAR ===================== */
router.get("/", async (req, res) => {

  try {

    const companyId = req.session?.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: "Sessão inválida" });
    }

    const services = await Service.find({
      companyId
    }).sort({
      codigo: 1
    });

    res.json(services);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Erro ao buscar serviços"
    });

  }

});

/* ===================== BUSCAR POR ID ===================== */
router.get("/:id", async (req, res) => {

  try {

    const companyId = req.session?.user?.companyId;

    const service = await Service.findOne({
      _id: req.params.id,
      companyId
    });

    if (!service) {
      return res.status(404).json({
        error: "Serviço não encontrado"
      });
    }

    res.json(service);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== CRIAR ===================== */
router.post("/", async (req, res) => {

  try {

    const companyId = req.session?.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        error: "Sessão inválida"
      });
    }

    const ultimo = await Service.findOne({
      companyId
    }).sort({
      codigo: -1
    });

    const codigo = ultimo
      ? ultimo.codigo + 1
      : 1;

    const service = await Service.create({

      codigo,

      nome: req.body.nome,

      categoria: req.body.categoria,

      descricao: req.body.descricao,

      valor: converterValor(req.body.valor),

      tempo: req.body.tempo,

      garantia: req.body.garantia,

      ativo: true,

      companyId

    });

    res.json(service);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Erro ao cadastrar serviço"
    });

  }

});

/* ===================== EDITAR ===================== */
router.put("/:id", async (req, res) => {

  try {

    const companyId = req.session?.user?.companyId;

    const service = await Service.findOneAndUpdate(

      {
        _id: req.params.id,
        companyId
      },

      {
        nome: req.body.nome,
        categoria: req.body.categoria,
        descricao: req.body.descricao,
        valor: converterValor(req.body.valor),
        tempo: req.body.tempo,
        garantia: req.body.garantia,
        ativo: req.body.ativo
      },

      {
        new: true
      }

    );

    if (!service) {

      return res.status(404).json({
        error: "Serviço não encontrado"
      });

    }

    res.json(service);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: true
    });

  }

});

/* ===================== EXCLUIR ===================== */
router.delete("/:id", async (req, res) => {

  try {

    const companyId = req.session?.user?.companyId;

    const deleted = await Service.findOneAndDelete({

      _id: req.params.id,

      companyId

    });

    if (!deleted) {

      return res.status(404).json({
        error: "Serviço não encontrado"
      });

    }

    res.json({
      ok: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: true
    });

  }

});

module.exports = router;