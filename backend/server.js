const express = require('express');
const multer = require('multer');
const path = require('path');
const axios=require('axios')
const app = express();

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '../uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Test route
app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

// Upload route
app.post('/upload-invoice', upload.single('file'), async (req, res) => {
  try {
    console.log("REQ FILE:", req.file);  // 🔥 debug

    if (!req.file) {
      return res.status(400).json({
        error: "File not received"
      });
    }

    const filePath = req.file.path;

    const response = await axios.post('http://localhost:5000/process', {
      filePath
    });

    res.json({
      message: 'Processed successfully',
      ocrData: response.data
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Processing failed');
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});