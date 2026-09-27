import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_BACKEND_URL = "http://127.0.0.1:5000";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "ASL Vision Pro Server is running" });
  });

  // Proxy Prediction Endpoint to Python Backend
  app.post("/api/predict", async (req, res) => {
    const { image, landmarks } = req.body;
    
    if (!image && !landmarks) {
      return res.status(400).json({ error: "No image or landmarks provided" });
    }

    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, landmarks })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error("Python backend error:", data);
        return res.status(response.status).json(data);
      }

      res.json({
        prediction:    data.prediction ?? null,
        confidence:    data.confidence ?? 0,
        timestamp:     data.timestamp ?? new Date().toISOString(),
        pred_class:    data.pred_class,
        bbox:          data.bbox,
        hand_detected: data.hand_detected ?? true,
        mock:          data.mock ?? false,
      });
    } catch (error) {
      console.error("Error proxying to Python backend:", error);
      res.status(500).json({ 
        error: "Python backend unavailable. Make sure backend.py is running on port 5000",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Calibrate histogram endpoint
  app.post("/api/calibrate-histogram", async (req, res) => {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: "No image data provided" });
    }

    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/api/calibrate-histogram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image })
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error calibrating histogram:", error);
      res.status(500).json({ 
        error: "Failed to calibrate histogram",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
