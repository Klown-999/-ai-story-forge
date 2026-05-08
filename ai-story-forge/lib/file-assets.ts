
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const tmpDir = path.join(process.cwd(), "data", "tmp-uploads");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

export function saveTempUpload(fileName: string, buffer: Buffer) {
  const uploadToken = randomUUID();
  const filePath = path.join(tmpDir, `${uploadToken}-${fileName}`);
  fs.writeFileSync(filePath, buffer);

  return {
    uploadToken,
    fileName,
    filePath,
  };
}
