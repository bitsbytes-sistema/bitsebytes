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
      status: req.body.status || "aberto",

      // 🔥 ESSENCIAL
      companyId: companyId
    });

    res.json(ticket);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar chamado" });
  }
});

/* ===================== ATUALIZAR ===================== */
router.put("/:id", async (req, res) => {
  try {

    const companyId = req.session.user.companyId;

    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: companyId // 🔥 impede mexer em outra empresa
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

/* ===================== DELETE ===================== */
router.delete("/:id", async (req, res) => {
  try {

    const companyId = req.session.user.companyId;

    await Ticket.findOneAndDelete({
      _id: req.params.id,
      companyId: companyId // 🔥 segurança total
    });

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar chamado" });
  }
});

module.exports = router;