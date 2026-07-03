import fs from "fs";
import path from "path";

let cached: boolean | undefined;

/** Local dev mirrors lab_documents to data/; Vercel serverless is read-only. */
export function labFsWritable(): boolean {
  if (cached !== undefined) return cached;
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    cached = false;
    return false;
  }
  try {
    const probe = path.join(process.cwd(), "data", ".lab-fs-probe");
    fs.mkdirSync(path.dirname(probe), { recursive: true });
    fs.writeFileSync(probe, "1", "utf8");
    fs.unlinkSync(probe);
    cached = true;
  } catch {
    cached = false;
  }
  return cached;
}
