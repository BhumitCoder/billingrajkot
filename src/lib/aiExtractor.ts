import { PurchaseBillItem, AIExtractionError } from "@/types";

interface ExtractedBillData {
  vendorName: string;
  vendorAddress?: string;
  billNumber?: string;
  billDate?: string;
  dueDate?: string;
  paymentTerms?: number;
  items: PurchaseBillItem[];
  subtotal: number;
  totalTax: number;
  total: number;
  rawText: string;
  errors: AIExtractionError[];
}


// Validate date format
const isValidDate = (dateStr: string): boolean => {
  if (!dateStr) return true;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

// Validate numeric values
const isValidAmount = (amount: number): boolean => {
  return !isNaN(amount) && amount >= 0;
};

export const extractBillFromImage = async (
  imageBase64: string,
): Promise<ExtractedBillData> => {
  const prompt = `Analyze this bill/invoice image carefully and extract the following information in JSON format:

CRITICAL - Look for - Near vendor company name/address (usually labeled ", ", "GST No:", "UIN:")
- In vendor details section at top
- Below company address
- Format: 2 digits (state code) + 10 alphanumeric (PAN) + 1 digit + 1 letter + 1 alphanumeric
- Example formats: "24AAXFM9362Q1Z3", "27AABCU9603R1ZX"
- May also be labeled as "State Name: Gujarat, Code: 24" followed by - NEVER return null for vendor


  IMPORTANT INSTRUCTIONS:
1. Look for GST information in ALL possible locations:
   - Item-wise GST columns (CGST, SGST, IGST)
   - Tax summary sections at the bottom
   - GST rate mentioned in item description
   - Separate tax breakup tables
   - Round-off amounts

2. For GST extraction:
   - CGST + SGST = Total GST (for intra-state)
   - IGST = Total GST (for inter-state)
   - If only "GST" is mentioned, treat it as total GST
   - If you see "@ 0.75%" or similar, that's the GST rate
   - Look for terms like: GST, CGST, SGST, IGST, Tax, VAT

3. Handle different invoice formats:
   - Some invoices show GST per item
   - Some show total GST at bottom only
   - Some show GST rate but not amount
   - Calculate missing values if possible

Extract the following in JSON format:
{
  "vendorName": "Name of the vendor/seller",
  "vendorAddress": "Full address of vendor",
  ",
  "billNumber": "Invoice/Bill number",
  "billDate": "Date of the bill in YYYY-MM-DD format",
  "dueDate": "Due date if mentioned in YYYY-MM-DD format",
  "paymentTerms": "Payment terms in days if mentioned (number only)",
  "items": [
    {
      "description": "Item name/description",
      ",
      "quantity": 1,
      "unit": "Unit of measurement (pcs, kg, etc.)",
      "rate": 100.00,
      "amount": 100.00,
      ",
      "gstAmount": 18.00,
      "hasError": false,
      "errorMessage": null
    }
  ],
  "subtotal": 0,
  "totalTax": 0,
  "total": 0,
  "errors": [
    {
      "field": "field name with issue",
      "message": "description of the issue",
      "severity": "warning or error",
      "suggestion": "how to fix this"
    }
  ]
}

IMPORTANT VALIDATION:
- Verify all amounts are correctly extracted (quantity × rate = amount)
- Check if GST calculations are correct (amount × 
- Verify subtotal + totalTax = total
- If any values seem incorrect or inconsistent, add them to the "errors" array
- Mark items with "hasError": true if there's a calculation mismatch
- If a field is not visible or unclear, use null and add a warning to errors
- For amounts, use numbers without currency symbols
- Parse dates in YYYY-MM-DD format
- Be as accurate as possible with the amounts

Return ONLY the JSON object, no other text.`;

  try {
    const response = await fetch(
      "https://gen.pollinations.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer sk_IuvTH1QJXu0iZG5FNyfmF7eHwscf9oHj`,
        },
        body: JSON.stringify({
          model: "openai",
          messages: [
            {
              role: "system",
              content: "You are a professional invoice data extractor. Extract data accurately into JSON format.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageBase64,
                  },
                },
              ],
            },
          ],
          max_tokens: 3000,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to process image");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response
    let jsonStr = content;

    // Handle markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Clean up the string
    jsonStr = jsonStr.trim();

    try {
      const parsed = JSON.parse(jsonStr);
      const errors: AIExtractionError[] = parsed.errors || [];

      // Validate and flag items with issues
      const items: PurchaseBillItem[] = (parsed.items || []).map(
        (item: any, index: number) => {
          const quantity = Number(item.quantity) || 0;
          const rate = Number(item.rate) || 0;
          const amount = Number(item.amount) || 0;
          const gstAmount = Number(item.gstAmount) || 0;

          // Calculate expected values
          const expectedAmount = quantity * rate;

          let hasError = false;
          let errorMessage = "";

          // Check for calculation errors
          if (Math.abs(expectedAmount - amount) > 1) {
            hasError = true;
            errorMessage = `Amount mismatch: ${quantity} × ₹${rate} = ₹${expectedAmount.toFixed(2)}, but bill shows ₹${amount.toFixed(2)}`;
            errors.push({
              field: `items[${index}].amount`,
              message: errorMessage,
              severity: "warning",
              suggestion: `Expected amount: ₹${expectedAmount.toFixed(2)}`,
            });
          }


          return {
            description: item.description || "Unknown Item",
            quantity,
            unit: item.unit || "pcs",
            rate,
            amount: amount || expectedAmount,
            gstAmount: gstAmount || expectedGstAmount,
            hasError,
            errorMessage: hasError ? errorMessage : undefined,
          };
        },
      );

      // Calculate totals if not provided
      const subtotal =
        Number(parsed.subtotal) ||
        items.reduce((sum, item) => sum + item.amount, 0);
      const totalTax =
        Number(parsed.totalTax) ||
        items.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
      const total = Number(parsed.total) || subtotal + totalTax;

      // Validate totals
      const expectedTotal = subtotal + totalTax;
      if (Math.abs(expectedTotal - total) > 1) {
        errors.push({
          field: "total",
          message: `Total mismatch: Subtotal (₹${subtotal.toFixed(2)}) + Tax (₹${totalTax.toFixed(2)}) = ₹${expectedTotal.toFixed(2)}, but bill shows ₹${total.toFixed(2)}`,
          severity: "warning",
          suggestion: `Expected total: ₹${expectedTotal.toFixed(2)}`,
        });
      }


      // Validate date
      if (parsed.billDate && !isValidDate(parsed.billDate)) {
        errors.push({
          field: "billDate",
          message: "Invalid date format",
          severity: "warning",
          suggestion: "Date should be in YYYY-MM-DD format",
        });
      }

      return {
        vendorName: parsed.vendorName || "Unknown Vendor",
        vendorAddress: parsed.vendorAddress || "",
        billNumber: parsed.billNumber || "",
        billDate: parsed.billDate || new Date().toISOString(),
        dueDate: parsed.dueDate || "",
        paymentTerms: Number(parsed.paymentTerms) || 0,
        items,
        subtotal,
        totalTax,
        total,
        rawText: content,
        errors,
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return default structure with raw text
      return {
        vendorName: "Unknown Vendor",
        items: [],
        subtotal: 0,
        totalTax: 0,
        total: 0,
        rawText: content,
        errors: [
          {
            field: "parsing",
            message:
              "Failed to parse bill data. Please review and enter details manually.",
            severity: "error",
            suggestion:
              "Try uploading a clearer image or enter details manually",
          },
        ],
      };
    }
  } catch (error) {
    console.error("AI extraction error:", error);
    throw new Error("Failed to extract bill information. Please try again.");
  }
};
