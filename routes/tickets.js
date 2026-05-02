const express = require("express");
const Ticket = require("../models/Ticket");

const router = express.Router();

/* LISTAR */
router.get("/", async (req, res) => {
  const tickets = await Ticket.find().sort({ createdAt: -1 });
  res.json(tickets);
});

/* CRIAR */
router.post("/", async (req, res) => {
  const ticket = await Ticket.create({
    cliente: req.body.cliente,
    equipamento: req.body.equipamento,
    status: req.body.status
  });

  res.json(ticket);
});

/* ATUALIZAR */
router.put("/:id", async (req, res) => {
  const ticket = await Ticket.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true }
  );

  res.json(ticket);
});

/* DELETE */
router.delete("/:id", async (req, res) => {
  await Ticket.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;