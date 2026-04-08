require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");

const connectDB = require("./db");
const Invoice = require("./models/Invoice");

connectDB();

const app = express();
app.use(express.json());

// 📦 Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "../uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* =========================
   🧠 DATA CLEANING FUNCTION
========================= */
function cleanData(data) {
  // 📅 Normalize date → YYYY-MM-DD
  if (data.date) {
    const parsedDate = new Date(data.date);
    if (!isNaN(parsedDate)) {
      data.date = parsedDate.toISOString().split("T")[0];
    }
  }

  // 💰 Remove commas
  if (data.amount) {
    data.amount = data.amount.replace(/,/g, "");
  }

  if (data.total) {
    data.total = data.total.replace(/,/g, "");
  }

  // 🔤 Trim strings
  Object.keys(data).forEach((key) => {
    if (typeof data[key] === "string") {
      data[key] = data[key].trim();
    }
  });

  return data;
}

/* =========================
   🏠 HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("AI Invoice Workflow Backend Running 🚀");
});

/* =========================
   🤖 UPLOAD + PROCESS
========================= */
app.post("/upload-invoice", upload.single("file"), async (req, res) => {
  try {
    console.log("REQ FILE:", req.file);

    if (!req.file) {
      return res.status(400).json({ error: "File not received" });
    }

    const filePath = path.resolve(req.file.path);

    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");

    const prompt = `
Extract structured invoice data.

Understand context even if labels vary.

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

    // 🔥 OpenRouter call
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
                  url: `data:image/png;base64,${base64Image}`,
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

    console.log("RAW AI OUTPUT:", resultText);

    // 🧹 Clean markdown
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

    // 🧠 Clean data
    parsedData = cleanData(parsedData);

    // 🔥 WORKFLOW RULE
    if (parsedData.amount && Number(parsedData.amount) <= 10000) {
      parsedData.status = "approved";
    } else {
      parsedData.status = "pending";
    }

    // ❌ Validate
    if (!parsedData.vendor) {
      return res.status(400).json({
        error: "Invalid extracted data",
        data: parsedData,
      });
    }

    // 💾 Save
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

/* =========================
   📥 GET ALL INVOICES
========================= */
app.get("/invoices", async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });

    res.json({
      message: "Invoices fetched",
      data: invoices,
    });

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

/* =========================
   📥 FILTER BY STATUS
========================= */
app.get("/invoices/status/:status", async (req, res) => {
  try {
    const { status } = req.params;

    const invoices = await Invoice.find({ status });

    res.json({
      message: `${status} invoices`,
      data: invoices,
    });

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

/* =========================
   ✅ APPROVE INVOICE
========================= */
app.put("/invoices/:id/approve", async (req, res) => {
  try {
    const updated = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );

    res.json({
      message: "Invoice approved",
      data: updated,
    });

  } catch (err) {
    res.status(500).json({ error: "Approval failed" });
  }
});

/* =========================
   ❌ REJECT INVOICE
========================= */
app.put("/invoices/:id/reject", async (req, res) => {
  try {
    const updated = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );

    res.json({
      message: "Invoice rejected",
      data: updated,
    });

  } catch (err) {
    res.status(500).json({ error: "Rejection failed" });
  }
});

/* =========================
   🚀 START SERVER
========================= */
app.listen(3000, () => {
  console.log("Server running on port 3000");
});