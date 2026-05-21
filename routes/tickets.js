const express = require("express");
const Ticket = require("../models/Ticket");

const router = express.Router();

/* ===================== LISTAR ===================== */
router.get("/", async (req, res) => {
  try {
    const companyId = req.session.user.companyId;

    const tickets = await Ticket.find({
      companyId
    }).sort({ createdAt: -1 });

    res.json(tickets);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar chamados" });
  }
});

/* ===================== CRIAR ===================== */
router.post("/", async (req, res) => {
  try {
    const companyId = req.session.user.companyId;

    const ticket = await Ticket.create({
      cliente: req.body.cliente,
      equipamento: req.body.equipamento,
      cpfcnpj: req.body.cpfcnpj,
      telefone: req.body.telefone,
      problema: req.body.problema,
      status: req.body.status || "aberto",

      diagnostico: req.body.diagnostico || "",
      servico: req.body.servico || "",
      conclusao: req.body.conclusao || "",

      companyId
    });

    res.json(ticket);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar chamado" });
  }
});

/* ===================== ATUALIZAR STATUS ===================== */
router.put("/:id", async (req, res) => {
  try {
    const companyId = req.session.user.companyId;

    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId
      },
      { status: req.body.status },
      { new: true }
    );

    res.json(ticket);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar chamado" });
  }
});

/* ===================== SALVAR LAUDO (CORRIGIDO DEFINITIVO) ===================== */
router.put("/:id/laudo", async (req, res) => {
  try {

    const companyId = req.session?.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        error: "Sessão inválida"
      });
    }

    const update = {
      ...(req.body.diagnostico !== undefined && {
        diagnostico: req.body.diagnostico
      }),
      ...(req.body.servico !== undefined && {
        servico: req.body.servico
      }),
      ...(req.body.conclusao !== undefined && {
        conclusao: req.body.conclusao
      })
    };

    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId
      },
      {
        $set: update
      },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({ error: "Ticket não encontrado" });
    }

    res.json(ticket);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar laudo" });
  }
});

/* ===================== DELETE ===================== */
router.delete("/:id", async (req, res) => {
  try {
    const companyId = req.session.user.companyId;

    await Ticket.findOneAndDelete({
      _id: req.params.id,
      companyId
    });

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar chamado" });
  }
});

module.exports = router;