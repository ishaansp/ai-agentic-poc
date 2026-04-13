require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const cors = require("cors");

const connectDB = require("./db");
const Invoice = require("./models/Invoice");

connectDB();

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// ==========================
// 📦 FIXED UPLOAD PATH (RENDER SAFE)
// ==========================
const uploadPath = path.join(__dirname, "uploads");

// ✅ Create folder if not exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// ==========================
// 📂 SERVE UPLOADS
// ==========================
app.use("/uploads", express.static(uploadPath));

// ==========================
// 📦 MULTER CONFIG
// ==========================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ==========================
// 🧠 GST VALIDATION
// ==========================
function isValidGSTIN(gstin) {
  if (!gstin) return false;
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  return gstRegex.test(gstin.trim());
}

function tryFixGSTIN(gstin) {
  if (!gstin) return gstin;
  let fixed = gstin.trim();

  if (!isValidGSTIN(fixed)) {
    fixed = fixed.replace(/^O/, "0");
  }

  return fixed;
}

// ==========================
// 🧹 DATA CLEANING
// ==========================
function cleanData(data) {
  if (data.date) {
    const parsedDate = new Date(data.date);
    if (!isNaN(parsedDate)) {
      data.date = parsedDate.toISOString().split("T")[0];
    }
  }

  if (data.amount) data.amount = data.amount.replace(/[^\d.]/g, "");
  if (data.total) data.total = data.total.replace(/[^\d.]/g, "");

  Object.keys(data).forEach((k) => {
    if (typeof data[k] === "string") {
      data[k] = data[k].trim();
    }
  });

  return data;
}

// ==========================
// 🏠 HEALTH
// ==========================
app.get("/", (req, res) => {
  res.send("AI Invoice Backend Running 🚀");
});

// ==========================
// 🤖 UPLOAD + PROCESS
// ==========================
app.post("/upload-invoice", upload.single("file"), async (req, res) => {
  try {
    console.log("REQ FILE:", req.file);

    if (!req.file) {
      return res.status(400).json({ error: "File not received" });
    }

    // ✅ FIX: correct file path (IMPORTANT)
    const filePath = path.join(uploadPath, req.file.filename);

    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString("base64");

    const mimeType = req.file.mimetype;

    const prompt = `
Extract structured invoice data.

Return ONLY JSON:
{
  "vendor": "",
  "gstin": "",
  "invoice_no": "",
  "date": "",
  "amount": "",
  "total": ""
}
`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64File}`,
                },
              },
            ],
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let resultText = response.data.choices[0].message.content;

    resultText = resultText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let parsedData;

    try {
      parsedData = JSON.parse(resultText);
    } catch (err) {
      return res.status(500).json({
        error: "JSON parsing failed",
        raw: resultText,
      });
    }

    // ==========================
    // 🧹 CLEAN
    // ==========================
    parsedData = cleanData(parsedData);

    const totalAmount = parseFloat(
      parsedData.total || parsedData.amount || "0"
    );

    // ==========================
    // 🤖 AUTO APPROVAL
    // ==========================
    parsedData.status = totalAmount <= 10000 ? "approved" : "pending";

    // ==========================
    // 🔍 GST VALIDATION
    // ==========================
    let gst = parsedData.gstin;

    if (!isValidGSTIN(gst)) {
      const corrected = tryFixGSTIN(gst);

      if (isValidGSTIN(corrected)) {
        parsedData.gstin = corrected;
        parsedData.gstin_status = "corrected";
      } else {
        parsedData.gstin_status = "invalid";
      }
    } else {
      parsedData.gstin_status = "valid";
    }

    // ==========================
    // 🚀 ROUTING
    // ==========================
    if (parsedData.gstin_status === "invalid") {
      parsedData.department = "audit";
    } else if (totalAmount > 10000) {
      parsedData.department = "finance";
    } else if (
      parsedData.vendor &&
      parsedData.vendor.toLowerCase().includes("legal")
    ) {
      parsedData.department = "legal";
    } else {
      parsedData.department = "auto-approved";
    }

    // ==========================
    // 📂 SAVE FILE INFO
    // ==========================
    parsedData.image_url = req.file.filename;
    parsedData.file_type = req.file.mimetype;

    if (!parsedData.vendor) {
      return res.status(400).json({
        error: "Invalid extracted data",
        data: parsedData,
      });
    }

    const savedInvoice = await Invoice.create(parsedData);

    res.json({
      message: "Saved successfully",
      data: savedInvoice,
    });

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);

    res.status(500).json({
      error: "Processing failed",
      details: err.response?.data || err.message,
    });
  }
});

// ==========================
// 📥 GET ALL
// ==========================
app.get("/invoices", async (req, res) => {
  const invoices = await Invoice.find().sort({ createdAt: -1 });
  res.json({ data: invoices });
});

// ==========================
// 📄 GET ONE
// ==========================
app.get("/invoices/:id", async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  res.json({ data: invoice });
});

// ==========================
// 📊 FILTERS
// ==========================
app.get("/invoices/status/:status", async (req, res) => {
  const invoices = await Invoice.find({ status: req.params.status });
  res.json({ data: invoices });
});

app.get("/invoices/department/:dept", async (req, res) => {
  const invoices = await Invoice.find({ department: req.params.dept });
  res.json({ data: invoices });
});

// ==========================
// ✅ APPROVE
// ==========================
app.put("/invoices/:id/approve", async (req, res) => {
  const updated = await Invoice.findByIdAndUpdate(
    req.params.id,
    { status: "approved" },
    { returnDocument: "after" }
  );

  res.json({ data: updated });
});

// ==========================
// ❌ REJECT
// ==========================
app.put("/invoices/:id/reject", async (req, res) => {
  const updated = await Invoice.findByIdAndUpdate(
    req.params.id,
    { status: "rejected" },
    { returnDocument: "after" }
  );

  res.json({ data: updated });
});

// ==========================
// 🚀 START SERVER
// ==========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});