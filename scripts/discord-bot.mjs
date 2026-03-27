import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  discordApi,
  extractOpenAIResponseText,
  formatTimestamp,
  loadLocalEnv,
  openaiResponsesCreate,
  postDiscordMessage,
  postDiscordMessages,
  requireEnv,
  toCodeBlock,
  truncateOutput,
} from "./discord-common.mjs";

loadLocalEnv();

const DISCORD_BOT_TOKEN = requireEnv("DISCORD_BOT_TOKEN");
const DISCORD_CHANNEL_ID = requireEnv("DISCORD_CHANNEL_ID");
const COMMAND_PREFIX = String(process.env.DISCORD_COMMAND_PREFIX || "!").trim() || "!";
const POLL_INTERVAL_MS = Math.max(3000, Number(process.env.DISCORD_POLL_INTERVAL_MS || 8000));
const STATE_FILE = path.resolve(process.cwd(), ".discord-bot-state.json");
const OUTBOX_FILE = path.resolve(process.cwd(), ".discord-outbox.txt");
const OPENAI_STATE_FILE = path.resolve(process.cwd(), ".discord-openai-state.json");
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-5-mini").trim() || "gpt-5-mini";
const OPENAI_REASONING_EFFORT = String(process.env.OPENAI_REASONING_EFFORT || "").trim();
const OPENAI_INSTRUCTIONS =
  String(process.env.OPENAI_INSTRUCTIONS || "").trim() ||
  [
    "Voce e um assistente util, colaborativo e objetivo.",
    "Responda preferencialmente em portugues do Brasil.",
    "Seja claro, pratico e gentil.",
    "Se a pergunta envolver codigo, explique com foco em como fazer.",
  ].join(" ");
const ALLOWED_USER_IDS = String(process.env.DISCORD_ALLOWED_USER_IDS || "")
  .split(",")
  .map((value) => String(value || "").trim())
  .filter(Boolean);

const ALLOWED_COMMANDS = {
  help: {
    description: "Lista comandos disponiveis.",
  },
  ping: {
    description: "Testa conectividade do bot.",
  },
  status: {
    description: "Mostra se existe comando em execucao.",
  },
  gitstatus: {
    description: "Mostra git status resumido.",
  },
  build: {
    description: "Executa npm run build.",
  },
  commit: {
    description: "Faz git add . + git commit -m. Uso: !commit sua mensagem",
  },
  notify: {
    description: "Envia uma mensagem de confirmacao. Uso: !notify texto",
  },
  ask: {
    description: "Pergunta algo para a OpenAI. Uso: !ask sua pergunta",
  },
  reset: {
    description: "Limpa o contexto da conversa OpenAI para o seu usuario.",
  },
};

let botUserId = "";
let busy = false;
let currentTaskLabel = "";
let polling = false;

function describeAuthor(message = {}) {
  const username = String(message?.author?.username || "desconhecido").trim();
  const userId = String(message?.author?.id || "").trim();
  return `${username}${userId ? ` (${userId})` : ""}`;
}

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return { lastMessageId: "" };
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return {
      lastMessageId: String(parsed?.lastMessageId || "").trim(),
    };
  } catch {
    return { lastMessageId: "" };
  }
}

function saveState(lastMessageId) {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({ lastMessageId: String(lastMessageId || "") }, null, 2),
    "utf8"
  );
}

function loadOpenAIState() {
  try {
    if (!fs.existsSync(OPENAI_STATE_FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(OPENAI_STATE_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveOpenAIState(state) {
  fs.writeFileSync(OPENAI_STATE_FILE, JSON.stringify(state || {}, null, 2), "utf8");
}

function getConversationStateKey(message = {}) {
  const channelId = String(message?.channel_id || DISCORD_CHANNEL_ID || "").trim();
  const authorId = String(message?.author?.id || "").trim();
  return `${channelId}:${authorId}`;
}

function compareSnowflakes(a = "", b = "") {
  const left = BigInt(String(a || "0"));
  const right = BigInt(String(b || "0"));
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

async function askOpenAI(message, prompt) {
  const question = String(prompt || "").trim();
  if (!question) {
    await postDiscordMessage({
      token: DISCORD_BOT_TOKEN,
      channelId: DISCORD_CHANNEL_ID,
      content: `Uso: ${COMMAND_PREFIX}ask sua pergunta`,
    });
    return;
  }

  if (!OPENAI_API_KEY) {
    await postDiscordMessage({
      token: DISCORD_BOT_TOKEN,
      channelId: DISCORD_CHANNEL_ID,
      content:
        "OPENAI_API_KEY nao configurada. Adicione essa variavel em `.env.discord.local` para habilitar o !ask.",
    });
    return;
  }

  const conversationState = loadOpenAIState();
  const conversationKey = getConversationStateKey(message);
  const previousResponseId = String(conversationState?.[conversationKey]?.previousResponseId || "").trim();

  const body = {
    model: OPENAI_MODEL,
    input: [
      {
        role: "user",
        content: question,
      },
    ],
    instructions: OPENAI_INSTRUCTIONS,
  };

  if (OPENAI_REASONING_EFFORT) {
    body.reasoning = { effort: OPENAI_REASONING_EFFORT };
  }

  if (previousResponseId) {
    body.previous_response_id = previousResponseId;
  }

  await postDiscordMessage({
    token: DISCORD_BOT_TOKEN,
    channelId: DISCORD_CHANNEL_ID,
    content: `Consultando ${OPENAI_MODEL}...`,
  });

  const response = await openaiResponsesCreate({
    apiKey: OPENAI_API_KEY,
    body,
  });

  const responseText =
    extractOpenAIResponseText(response) ||
    "Recebi a resposta da OpenAI, mas ela veio sem texto legivel.";

  if (response?.id) {
    conversationState[conversationKey] = {
      previousResponseId: String(response.id),
      updatedAt: new Date().toISOString(),
      model: OPENAI_MODEL,
    };
    saveOpenAIState(conversationState);
  }

  await postDiscordMessages({
    token: DISCORD_BOT_TOKEN,
    channelId: DISCORD_CHANNEL_ID,
    content: responseText,
  });
}

async function flushOutbox() {
  try {
    if (!fs.existsSync(OUTBOX_FILE)) return;
    const content = fs.readFileSync(OUTBOX_FILE, "utf8").trim();
    if (!content) return;

    console.log("[discord-bot] Publicando mensagem do outbox no canal...");
    await postDiscordMessage({
      token: DISCORD_BOT_TOKEN,
      channelId: DISCORD_CHANNEL_ID,
      content,
    });
    fs.writeFileSync(OUTBOX_FILE, "", "utf8");
    console.log("[discord-bot] Outbox enviado e limpo.");
  } catch (error) {
    console.error(
      "[discord-bot] Falha ao publicar outbox:",
      error?.message || error
    );
  }
}

function parseCommand(messageContent = "") {
  const trimmed = String(messageContent || "").trim();
  if (!trimmed.startsWith(COMMAND_PREFIX)) return null;
  const body = trimmed.slice(COMMAND_PREFIX.length).trim();
  if (!body) return null;
  const [rawCommand, ...rest] = body.split(/\s+/);
  return {
    command: String(rawCommand || "").trim().toLowerCase(),
    args: rest,
    rawArgs: rest.join(" ").trim(),
  };
}

function runProcess(command, args = [], label = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve({
        code: Number(code || 0),
        stdout,
        stderr,
        label: label || `${command} ${args.join(" ")}`.trim(),
      });
    });
  });
}

function runCommand(command, args = [], rawArgs = "") {
  const commandMap = {
    build: {
      command: "cmd",
      args: ["/c", "npm run build"],
      label: "npm run build",
    },
    gitstatus: {
      command: "git",
      args: ["status", "--short", "--branch"],
      label: "git status --short --branch",
    },
  };

  if (command === "commit") {
    const commitMessage = String(rawArgs || "").trim();
    if (!commitMessage) {
      throw new Error(`Uso: ${COMMAND_PREFIX}commit sua mensagem`);
    }

    return (async () => {
      const addResult = await runProcess("git", ["add", "."], "git add .");
      if (addResult.code !== 0) {
        return {
          code: addResult.code,
          stdout: addResult.stdout,
          stderr: addResult.stderr,
          label: "git add .",
        };
      }

      const commitResult = await runProcess(
        "git",
        ["commit", "-m", commitMessage],
        `git commit -m "${commitMessage}"`
      );
      return commitResult;
    })();
  }

  const target = commandMap[command];
  if (!target) {
    throw new Error(`Comando nao permitido: ${command}`);
  }

  return runProcess(target.command, target.args, target.label);
}

async function handleCommand(message) {
  const parsed = parseCommand(message?.content || "");
  if (!parsed) return;

  console.log(
    `[discord-bot] Comando recebido de ${describeAuthor(message)}: ${String(
      message?.content || ""
    ).trim()}`
  );

  if (ALLOWED_USER_IDS.length && !ALLOWED_USER_IDS.includes(String(message?.author?.id || ""))) {
    console.log(
      `[discord-bot] Ignorado por DISCORD_ALLOWED_USER_IDS: ${describeAuthor(message)}`
    );
    return;
  }

  const { command, rawArgs } = parsed;
  if (!ALLOWED_COMMANDS[command]) {
    await postDiscordMessage({
      token: DISCORD_BOT_TOKEN,
      channelId: DISCORD_CHANNEL_ID,
      content: `Comando desconhecido. Use ${COMMAND_PREFIX}help.`,
    });
    return;
  }

  if (command === "help") {
    const helpText = Object.entries(ALLOWED_COMMANDS)
      .map(([key, value]) => `- ${COMMAND_PREFIX}${key}: ${value.description}`)
      .join("\n");
    await postDiscordMessage({
      token: DISCORD_BOT_TOKEN,
      channelId: DISCORD_CHANNEL_ID,
      content: `Comandos disponiveis:\n${helpText}`,
    });
    return;
  }

  if (command === "ping") {
    await postDiscordMessage({
      token: DISCORD_BOT_TOKEN,
      channelId: DISCORD_CHANNEL_ID,
      content: `pong ${formatTimestamp()}`,
    });
    return;
  }

  if (command === "status") {
    await postDiscordMessage({
      token: DISCORD_BOT_TOKEN,
      channelId: DISCORD_CHANNEL_ID,
      content: busy
        ? `Ocupado executando: ${currentTaskLabel}`
        : "Livre. Nenhum comando em execucao.",
    });
    return;
  }

  if (command === "notify") {
    await postDiscordMessage({
      token: DISCORD_BOT_TOKEN,
      channelId: DISCORD_CHANNEL_ID,
      content: rawArgs || "Notificacao recebida.",
    });
    return;
  }

  if (command === "reset") {
    const conversationState = loadOpenAIState();
    const conversationKey = getConversationStateKey(message);
    delete conversationState[conversationKey];
    saveOpenAIState(conversationState);
    await postDiscordMessage({
      token: DISCORD_BOT_TOKEN,
      channelId: DISCORD_CHANNEL_ID,
      content: "Contexto da conversa limpo para este usuario.",
    });
    return;
  }

  if (busy) {
    await postDiscordMessage({
      token: DISCORD_BOT_TOKEN,
      channelId: DISCORD_CHANNEL_ID,
      content: `Ja existe um comando em execucao: ${currentTaskLabel}`,
    });
    return;
  }

  busy = true;
  currentTaskLabel = command;
  console.log(`[discord-bot] Executando ${COMMAND_PREFIX}${command}`);

  await postDiscordMessage({
    token: DISCORD_BOT_TOKEN,
    channelId: DISCORD_CHANNEL_ID,
    content: `Executando ${COMMAND_PREFIX}${command}...`,
  });

  try {
    if (command === "ask") {
      await askOpenAI(message, rawArgs);
    } else {
      const result = await runCommand(command, parsed.args, rawArgs);
      const output = truncateOutput(
        [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n\n")
      );
      const header =
        result.code === 0
          ? `Comando ${command} finalizado com sucesso.`
          : `Comando ${command} terminou com codigo ${result.code}.`;

      await postDiscordMessage({
        token: DISCORD_BOT_TOKEN,
        channelId: DISCORD_CHANNEL_ID,
        content: `${header}\n${toCodeBlock(output || "(sem saida)", "txt")}`,
      });
    }
  } catch (error) {
    const extra =
      error?.payload && typeof error.payload === "object"
        ? `\n${toCodeBlock(truncateOutput(JSON.stringify(error.payload, null, 2)), "json")}`
        : "";
    await postDiscordMessage({
      token: DISCORD_BOT_TOKEN,
      channelId: DISCORD_CHANNEL_ID,
      content: `Falha ao executar ${command}.\n${toCodeBlock(
        truncateOutput(error?.stack || error?.message || String(error)),
        "txt"
      )}${extra}`,
    });
  } finally {
    busy = false;
    currentTaskLabel = "";
  }
}

async function bootstrap() {
  const me = await discordApi("/users/@me", {
    token: DISCORD_BOT_TOKEN,
  });
  botUserId = String(me?.id || "").trim();

  const latestMessages = await discordApi(
    `/channels/${DISCORD_CHANNEL_ID}/messages?limit=1`,
    { token: DISCORD_BOT_TOKEN }
  );
  const state = loadState();
  const lastMessageId =
    state.lastMessageId || String(latestMessages?.[0]?.id || "").trim();
  saveState(lastMessageId);

  console.log(
    `Discord bot pronto. Canal: ${DISCORD_CHANNEL_ID}. Ultima mensagem conhecida: ${lastMessageId || "(nenhuma)"}. Bot: ${String(
      me?.username || "desconhecido"
    )}${botUserId ? ` (${botUserId})` : ""}.`
  );
  console.log(`[discord-bot] Arquivo de outbox: ${OUTBOX_FILE}`);
  if (ALLOWED_USER_IDS.length) {
    console.log(
      `[discord-bot] Usuarios autorizados: ${ALLOWED_USER_IDS.join(", ")}`
    );
  } else {
    console.log("[discord-bot] Sem filtro de usuarios autorizados.");
  }
}

async function pollMessages() {
  if (polling) return;
  polling = true;

  try {
    const state = loadState();
    const lastKnownId = String(state.lastMessageId || "").trim();
    const messages = await discordApi(
      `/channels/${DISCORD_CHANNEL_ID}/messages?limit=20`,
      { token: DISCORD_BOT_TOKEN }
    );

    const ordered = [...messages]
      .filter((message) => {
        const id = String(message?.id || "").trim();
        if (!id) return false;
        if (!lastKnownId) return true;
        return compareSnowflakes(id, lastKnownId) > 0;
      })
      .sort((a, b) => compareSnowflakes(a.id, b.id));

    if (ordered.length) {
      console.log(
        `[discord-bot] ${ordered.length} nova(s) mensagem(ns) detectada(s) no canal.`
      );
    }

    let newestId = lastKnownId;
    for (const message of ordered) {
      const messageId = String(message?.id || "").trim();
      if (messageId && (!newestId || compareSnowflakes(messageId, newestId) > 0)) {
        newestId = messageId;
      }

      if (String(message?.author?.id || "").trim() === botUserId) continue;
      await handleCommand(message);
    }

    if (newestId && newestId !== lastKnownId) {
      saveState(newestId);
    }

    await flushOutbox();
  } catch (error) {
    console.error("Falha no polling do Discord bot:", error?.message || error);
  } finally {
    polling = false;
  }
}

await bootstrap();
await pollMessages();
setInterval(() => {
  void pollMessages();
}, POLL_INTERVAL_MS);
