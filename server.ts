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
      En tant qu'analyste financier senior pour "Reveno", analysez ces données de revenus d'entreprise pour l'entité "${companyName || 'Entité Inconnue'}" et fournissez des informations de niveau institutionnel.
      
      Données Actuelles:
      Revenus: ${JSON.stringify(revenues)}
      Objectifs: ${JSON.stringify(goals)}

      Concentrez-vous sur:
      1. La vélocité de croissance et les tendances.
      2. La performance par rapport aux objectifs.
      3. La détection d'anomalies (risque de désabonnement, pics, changements de marché).
      4. Recommandations stratégiques (tarification, effectifs, expansion).

      Gardez un ton sophistiqué, faisant autorité et axé sur les données. RÉPONDEZ EXCLUSIVEMENT EN FRANÇAIS. Tous les montants financiers doivent utiliser le symbole Euro (€).
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

app.post("/api/copilot", async (req, res) => {
  try {
    const { message, history, context } = req.body;

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `
          Vous êtes l'Assistant Financier Senior de Reveno. Votre rôle est d'aider l'utilisateur à comprendre ses données de trésorerie.
          
          Contexte Actuel:
          Entité: ${context.companyName || 'Inconnue'}
          Données de revenus: ${JSON.stringify(context.revenues)}
          Objectifs: ${JSON.stringify(context.goals)}
          
          Directives:
          1. Soyez précis, analytique et professionnel.
          2. Utilisez les données fournies pour répondre aux questions spécifiques.
          3. Suggérez des actions basées sur les tendances observées.
          4. Répondez toujours en FRANÇAIS.
          5. Toute mention de montant financier doit être exprimée en EUROS (€).
          6. Si vous ne connaissez pas la réponse ou si les données sont insuffisantes, soyez honnête.
        `,
      },
      history: history.map((h: any) => ({
        role: h.role,
        parts: [{ text: h.content }],
      })),
    });

    const result = await chat.sendMessage({ message });
    res.json({ content: result.text });
  } catch (error: any) {
    console.error("Copilot Error:", error);
    res.status(500).json({ error: "L'assistant a rencontré une erreur technique." });
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
