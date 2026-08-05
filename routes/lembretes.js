const express = require("express");
const router = express.Router();

const Lembrete = require("../models/Lembrete");


function auth(req, res, next){

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

    const lembretes = await Lembrete.find({

      companyId:req.session.user.companyId

    })
    .sort({
      data:1
    });


    res.json(lembretes);


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

    const lembrete = await Lembrete.create({

      companyId:req.session.user.companyId,

      titulo:req.body.titulo,

      descricao:req.body.descricao,

      clienteId:req.body.clienteId || null,

      cliente:req.body.cliente || "",

      telefone:req.body.telefone || "",

      data:req.body.data,

      hora:req.body.hora || "",

      tipo:req.body.tipo || "outros",

      criadoPor:req.session.user._id

    });


    res.json(lembrete);


  }catch(err){

    console.log(err);

    res.status(500).json({
      error:true
    });

  }

});


/* ===================== ATUALIZAR ===================== */

router.put("/:id", auth, async(req,res)=>{

  try{

    const lembrete = await Lembrete.findOne({

      _id:req.params.id,

      companyId:req.session.user.companyId

    });


    if(!lembrete){

      return res.status(404).json({
        error:"not_found"
      });

    }


    Object.assign(lembrete, req.body);


    await lembrete.save();


    res.json(lembrete);


  }catch(err){

    console.log(err);

    res.status(500).json({
      error:true
    });

  }

});


/* ===================== EXCLUIR ===================== */

router.delete("/:id", auth, async(req,res)=>{

  try{

    await Lembrete.deleteOne({

      _id:req.params.id,

      companyId:req.session.user.companyId

    });


    res.json({
      success:true
    });


  }catch(err){

    console.log(err);

    res.status(500).json({
      error:true
    });

  }

});


module.exports = router;