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

// 🏠 Test route
app.get("/", (req, res) => {
  res.send("OpenRouter + MongoDB Backend Running 🚀");
});

// 🤖 Upload + Process route
app.post("/upload-invoice", upload.single("file"), async (req, res) => {
  try {
    console.log("REQ FILE:", req.file);

    if (!req.file) {
      return res.status(400).json({ error: "File not received" });
    }

    const filePath = path.resolve(req.file.path);

    // 📂 Read image
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");

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

    // ❌ Prevent saving invalid data
    if (!parsedData.vendor) {
      return res.status(400).json({
        error: "Invalid extracted data",
        data: parsedData,
      });
    }

    // 🔥 SAVE TO MONGODB
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

// 🚀 Start server
app.listen(3000, () => {
  console.log("Server running on port 3000");
});