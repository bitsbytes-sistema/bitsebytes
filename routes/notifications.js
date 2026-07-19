const express = require("express");
const router = express.Router();

const Notification = require("../models/Notification");

// Listar notificações
router.get("/", async (req, res) => {

  try{

const lista = await Notification
  .find({
    companyId: req.session.user.companyId
  })
  .sort({
    createdAt: -1
  })
  .limit(30);

    res.json(lista);

  }catch(err){

    console.log(err);
    res.status(500).json({ error:true });

  }

});

// Marcar como lida
router.put("/:id/read", async (req,res)=>{

  try{

    await Notification.findByIdAndUpdate(
      req.params.id,
      { lida:true }
    );

    res.json({ ok:true });

  }catch(err){

    console.log(err);
    res.status(500).json({ error:true });

  }

});

module.exports = router;