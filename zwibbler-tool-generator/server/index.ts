import express from "express";
import cors from "cors";
import { generate, ValidationError } from "./generator.js";

interface GenerateRequestBody {
  prompt?: string;
  size?: string;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

const app = express();
const PORT = Number.parseInt(process.env.PORT ?? "3001", 10);

app.use(cors());
app.use(express.json());

app.post("/api/generate", async (req: express.Request<object, object, GenerateRequestBody>, res: express.Response) => {
  const { prompt, size } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing 'prompt' field" });
  }

  try {
    const tool = await generate(prompt, size);
    res.json(tool);
  } catch (err) {
    console.error("Generation failed:", err);

    if (err instanceof ValidationError) {
      return res.status(422).json({
        error: "Generated tool failed safety validation",
        reasons: err.reasons,
      });
    }

    if (getErrorMessage(err).includes("parse")) {
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
