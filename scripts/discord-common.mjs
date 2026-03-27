import fs from "node:fs";
import path from "node:path";

const DEFAULT_ENV_FILES = [".env.discord.local", ".env.local"];

function parseEnvLine(line = "") {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) return null;
  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

export function loadLocalEnv(envFiles = DEFAULT_ENV_FILES) {
  envFiles.forEach((envFile) => {
    const absolutePath = path.resolve(process.cwd(), envFile);
    if (!fs.existsSync(absolutePath)) return;

    const content = fs.readFileSync(absolutePath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const parsed = parseEnvLine(line);
      if (!parsed?.key) return;
      if (typeof process.env[parsed.key] === "undefined") {
        process.env[parsed.key] = parsed.value;
      }
    });
  });
}

export function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

export async function discordApi(pathname, { method = "GET", token, body } = {}) {
  const headers = {
    Authorization: `Bot ${token}`,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`https://discord.com/api/v10${pathname}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const error = new Error(
      `Discord API ${method} ${pathname} falhou com ${response.status}`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function postDiscordMessage({ token, channelId, content }) {
  const mensagem = String(content || "").trim();
  if (!mensagem) return null;
  return discordApi(`/channels/${channelId}/messages`, {
    method: "POST",
    token,
    body: { content: mensagem.slice(0, 1900) },
  });
}

export async function postWebhookMessage({ webhookUrl, content }) {
  const mensagem = String(content || "").trim();
  if (!mensagem) return null;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: mensagem.slice(0, 1900) }),
  });

  if (!response.ok) {
    throw new Error(`Webhook Discord falhou com ${response.status}`);
  }

  return true;
}

export function splitMessageChunks(value, maxLength = 1900) {
  const text = String(value || "").trim();
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let sliceIndex = remaining.lastIndexOf("\n", maxLength);
    if (sliceIndex < Math.floor(maxLength * 0.55)) {
      sliceIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (sliceIndex < Math.floor(maxLength * 0.4)) {
      sliceIndex = maxLength;
    }

    chunks.push(remaining.slice(0, sliceIndex).trim());
    remaining = remaining.slice(sliceIndex).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks.filter(Boolean);
}

export async function postDiscordMessages({ token, channelId, content }) {
  const chunks = splitMessageChunks(content);
  const results = [];
  for (const chunk of chunks) {
    results.push(
      await postDiscordMessage({
        token,
        channelId,
        content: chunk,
      })
    );
  }
  return results;
}

export async function openaiResponsesCreate({ apiKey, body }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const error = new Error(
      `OpenAI Responses API falhou com ${response.status}`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function extractOpenAIResponseText(payload = null) {
  if (!payload) return "";
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputItems = Array.isArray(payload.output) ? payload.output : [];
  const parts = [];

  for (const item of outputItems) {
    const contentItems = Array.isArray(item?.content) ? item.content : [];
    for (const content of contentItems) {
      const candidates = [
        content?.text,
        content?.output_text,
        content?.content?.text,
      ];

      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
          parts.push(candidate.trim());
        }
      }
    }
  }

  return parts.join("\n\n").trim();
}

export function truncateOutput(value, maxLength = 1400) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 32)}\n...[saida truncada]`;
}

export function toCodeBlock(value = "", language = "") {
  const text = String(value || "").trim();
  if (!text) return "```txt\n(vazio)\n```";
  return `\`\`\`${language}\n${text}\n\`\`\``;
}

export function formatTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}
