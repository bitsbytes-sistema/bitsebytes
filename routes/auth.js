function auth(req,res,next){
  if(!req.session.user) return res.status(401).json({error:"not_logged"});
  next();
}

function tenant(req,res,next){
  req.companyId = req.session.user.companyId;
  next();
}