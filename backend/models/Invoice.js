const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    vendor: String,
    invoice_no: String,
    date: String,
    amount: String,
    total: String,
    status: {
      type: String,
      default: "pending",
    },
    gstin_status: {
      type: String,
      default: "unknown",
    },
    department: {
      type: String,
      default: "none",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Invoice", invoiceSchema);
