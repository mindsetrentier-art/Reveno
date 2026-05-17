import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/insights", async (req, res) => {
  try {
    const { revenues, goals, companyName } = req.body;

    if (!revenues || !Array.isArray(revenues)) {
       return res.status(400).json({ error: "Missing or invalid revenues data" });
    }

    const prompt = `
      As a senior financial analyst for "Reveno", analyze this enterprise revenue data for the entity "${companyName || 'Unknown Entity'}" and provide institutional-grade insights.
      
      Current Data:
      Revenues: ${JSON.stringify(revenues)}
      Goals: ${JSON.stringify(goals)}

      Focus on:
      1. Growth velocity and trends.
      2. Performance against goals.
      3. Anomaly detection (churn risk, spikes, market shifts).
      4. Strategic recommendations (pricing, headcount, expansion).

      Keep the tone sophisticated, authoritative, and data-driven.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A high-level institutional summary of the current state." },
            metrics: {
              type: Type.OBJECT,
              properties: {
                growthVelocity: { type: Type.STRING, description: "The calculated growth rate/velocity." },
                predictedARR: { type: Type.STRING, description: "Projected annual recurring revenue." },
                modelConfidence: { type: Type.STRING, description: "Confidence score of the projection." }
              }
            },
            alerts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "Type of alert (CHURN_RISK, SPIKE, MARKET_SHIFT, etc.)" },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  impact: { type: Type.STRING }
                }
              }
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  title: { type: Type.STRING },
                  details: { type: Type.STRING },
                  simulatedImpact: { type: Type.STRING }
                }
              }
            }
          },
          required: ["summary", "metrics", "alerts", "recommendations"]
        }
      }
    });

    const insights = JSON.parse(response.text || "{}");
    res.json(insights);
  } catch (error: any) {
    console.error("Gemini Insight Error:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

// Vite Middleware
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

initializeServer();
