const mongoose = require("mongoose");

const laudoCounterSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true
  },
  ano: {
    type: Number,
    required: true
  },
  sequencia: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

laudoCounterSchema.index(
  { companyId: 1, ano: 1 },
  { unique: true }
);

module.exports = mongoose.model("LaudoCounter", laudoCounterSchema);
