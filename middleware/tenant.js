module.exports = function(req,res,next){
  req.companyId = req.session.user.companyId;
  next();
};