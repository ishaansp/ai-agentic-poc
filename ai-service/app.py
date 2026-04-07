from fastapi import FastAPI
from pydantic import BaseModel
import pytesseract
from PIL import Image
import requests
import json
import re
import cv2
import numpy as np
import os

app = FastAPI()

# 📥 Request schema
class InvoiceRequest(BaseModel):
    filePath: str


# 🧠 AI Extraction Function
def extract_with_ai(text):
    prompt = f"""
You are an AI that extracts structured invoice data.

IMPORTANT RULES:
- Return ONLY JSON
- Do NOT explain anything
- If value not found, return empty string

Expected JSON format:
{{
  "vendor": "",
  "gstin": "",
  "invoice_no": "",
  "date": "",
  "amount": "",
  "total": ""
}}

Invoice text:
{text}
"""

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "mistral",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0
                }
            }
        )

        result = response.json()
        raw_output = result.get("response", "").strip()

        print("RAW AI OUTPUT:", raw_output)

        if not raw_output:
            return {"error": "Empty response from model"}

        # Extract JSON safely
        json_match = re.search(r"\{.*\}", raw_output, re.DOTALL)

        if json_match:
            return json.loads(json_match.group(0))
        else:
            return {
                "error": "No JSON found",
                "raw_output": raw_output
            }

    except Exception as e:
        return {"error": str(e)}


# 🧹 Cleanup Function
def clean_structured_data(data):
    if not isinstance(data, dict):
        return data

    # Fix GSTIN OCR issues
    if "gstin" in data and data["gstin"]:
        gstin = data["gstin"]
        gstin = gstin.replace("O", "0").replace("I", "1")
        data["gstin"] = gstin

    # Validate date
    if "date" in data and data["date"]:
        if len(data["date"]) < 10:
            data["date"] = ""

    # Validate invoice number
    if "invoice_no" in data and data["invoice_no"]:
        if len(data["invoice_no"]) <= 1:
            data["invoice_no"] = ""

    return data


# 🏠 Health check
@app.get("/")
def home():
    return {"message": "AI Service Running 🚀"}


# 🤖 OCR + AI Processing API
@app.post("/process")
def process_invoice(req: InvoiceRequest):
    try:
        absolute_path = os.path.abspath(req.filePath)

        # 📂 Load image
        img = cv2.imread(absolute_path)

        if img is None:
            raise Exception(f"Image not found: {absolute_path}")

        # 🧠 Preprocessing
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
        denoised = cv2.medianBlur(thresh, 3)

        processed_image = Image.fromarray(denoised)

        # 🔍 OCR (processed image)
        text = pytesseract.image_to_string(processed_image, config='--psm 6')

        # 🔁 Fallback to original image
        if not text.strip():
            print("Fallback to original image OCR")
            original_image = Image.open(absolute_path)
            text = pytesseract.image_to_string(original_image, config='--psm 6')

        # ❌ STOP if OCR fails
        if not text.strip():
            return {
                "error": "OCR failed - no text extracted",
                "raw_text": text,
                "structured_data": None
            }

        # 🧠 AI extraction
        structured_data = extract_with_ai(text)

        # 🧹 Cleanup
        structured_data = clean_structured_data(structured_data)

        return {
            "raw_text": text,
            "structured_data": structured_data
        }

    except Exception as e:
        return {"error": str(e)}