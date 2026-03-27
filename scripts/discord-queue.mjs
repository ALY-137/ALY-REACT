import fs from "node:fs";
import path from "node:path";

const outboxFile = path.resolve(process.cwd(), ".discord-outbox.txt");
const message = process.argv.slice(2).join(" ").trim();

if (!message) {
  console.error("Uso: node scripts/discord-queue.mjs \"mensagem\"");
  process.exit(1);
}

fs.writeFileSync(outboxFile, `${message}\n`, "utf8");
console.log(`Mensagem gravada no outbox: ${outboxFile}`);
