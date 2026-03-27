import {
  loadLocalEnv,
  postDiscordMessage,
  postWebhookMessage,
  requireEnv,
} from "./discord-common.mjs";

loadLocalEnv();

const message = process.argv.slice(2).join(" ").trim();

if (!message) {
  console.error("Uso: node scripts/discord-notify.mjs \"mensagem\"");
  process.exit(1);
}

async function main() {
  const webhookUrl = String(process.env.DISCORD_WEBHOOK_URL || "").trim();
  if (webhookUrl) {
    await postWebhookMessage({ webhookUrl, content: message });
    console.log("Mensagem enviada via webhook do Discord.");
    return;
  }

  const token = requireEnv("DISCORD_BOT_TOKEN");
  const channelId = requireEnv("DISCORD_CHANNEL_ID");
  await postDiscordMessage({ token, channelId, content: message });
  console.log("Mensagem enviada via bot do Discord.");
}

main().catch((error) => {
  console.error("Falha ao enviar notificacao para o Discord:", error?.message || error);
  process.exit(1);
});
