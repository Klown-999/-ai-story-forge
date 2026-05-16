
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { processOneGenerationJob } from "../lib/jobs/worker";

async function main() {
  console.log("[job-worker] started");
  console.log(
    "[job-worker] GEMINI_API_KEY loaded:",
    !!process.env.GEMINI_API_KEY
  );
  console.log(
    "[job-worker] GROQ_API_KEY loaded:",
    !!process.env.GROQ_API_KEY
  );

  while (true) {
    try {
      const worked = await processOneGenerationJob();

      if (!worked) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error("[job-worker] loop failure:", error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

main().catch((error) => {
  console.error("[job-worker] fatal:", error);
  process.exit(1);
});
