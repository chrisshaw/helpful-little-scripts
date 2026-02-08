import express from "express";
import cors from "cors";
import { generate } from "./generator.js";

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

app.use(cors());
app.use(express.json());

app.post("/api/generate", async (req, res) => {
  const { prompt, size } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing 'prompt' field" });
  }

  try {
    const tool = await generate(prompt, size);
    res.json(tool);
  } catch (err) {
    console.error("Generation failed:", err);

    if (err.reasons) {
      return res.status(422).json({
        error: "Generated tool failed safety validation",
        reasons: err.reasons,
      });
    }

    if (err.message?.includes("parse")) {
      return res.status(422).json({
        error: "Failed to parse generated tool — the model returned invalid output",
      });
    }

    res.status(502).json({ error: "Failed to generate tool" });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Zwibbler Tool Generator API`);
  console.log(`  ───────────────────────────`);
  console.log(`  http://localhost:${PORT}\n`);
});
