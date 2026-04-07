const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
  vendor: String,
  gstin: String,
  invoice_no: String,
  date: String,
  amount: String,
  total: String,
  status: {
    type: String,
    default: "pending"
  }
}, { timestamps: true });

module.exports = mongoose.model("Invoice", invoiceSchema);