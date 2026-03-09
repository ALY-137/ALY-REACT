#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const FIREBASE_TOOLS_VERSION = process.env.FIREBASE_TOOLS_VERSION || "13.35.1";
const DEPLOY_TARGET = "firestore:rules";

function normalizeProjectId(value) {
  return String(value || "").trim();
}

function normalizeList(raw) {
  return String(raw || "")
    .split(/[\n,; ]+/g)
    .map((item) => normalizeProjectId(item))
    .filter(Boolean);
}

function readProjectsFromFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), String(filePath || "").trim());
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Arquivo de projetos nao encontrado: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  return content
    .split(/\r?\n/g)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);
}

function ensureUnique(values) {
  const seen = new Set();
  const unique = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }
  return unique;
}

function parseArgs(argv) {
  const args = {
    projects: [],
    projectsCsv: "",
    projectsFile: "",
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === "--project" || current === "-p") {
      args.projects.push(normalizeProjectId(argv[i + 1]));
      i += 1;
      continue;
    }
    if (current === "--projects") {
      args.projectsCsv = String(argv[i + 1] || "");
      i += 1;
      continue;
    }
    if (current === "--project-file") {
      args.projectsFile = String(argv[i + 1] || "");
      i += 1;
      continue;
    }
    if (current === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (current === "--help" || current === "-h") {
      args.help = true;
      continue;
    }
    if (current.startsWith("-")) {
      throw new Error(`Flag nao suportada: ${current}`);
    }
    args.projects.push(normalizeProjectId(current));
  }

  return args;
}

function printHelp() {
  console.log("Deploy portavel de Firestore rules para multiplos projetos.");
  console.log("");
  console.log("Uso:");
  console.log("  node scripts/deploy-firestore-rules.js [opcoes]");
  console.log("");
  console.log("Opcoes:");
  console.log("  --project, -p <id>         Adiciona um projeto (repetivel)");
  console.log("  --projects <csv>           Lista separada por virgula");
  console.log("  --project-file <arquivo>   Arquivo com 1 project_id por linha");
  console.log("  --dry-run                  Mostra os comandos sem executar");
  console.log("  --help, -h                 Mostra esta ajuda");
  console.log("");
  console.log("Fallback por variavel de ambiente:");
  console.log("  FIREBASE_RULES_PROJECTS=teste-aa015,aly-onepages-runtime");
}

function parseServiceAccountJson(raw) {
  const source = String(raw || "").trim();
  if (!source) return null;

  try {
    return JSON.parse(source);
  } catch {
    // tentativa base64
  }

  try {
    const decoded = Buffer.from(source, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function setupGoogleCredentialsFromEnv() {
  const alreadyConfigured = normalizeProjectId(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (alreadyConfigured) return null;

  const saObject = parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!saObject) return null;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "firebase-sa-"));
  const keyFile = path.join(tempDir, "service-account.json");
  fs.writeFileSync(keyFile, JSON.stringify(saObject), "utf8");
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFile;
  return keyFile;
}

function hasAnyAuthMethod() {
  return Boolean(
    normalizeProjectId(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
      normalizeProjectId(process.env.FIREBASE_TOKEN)
  );
}

function runningInCi() {
  return String(process.env.CI || "").trim().toLowerCase() === "true";
}

function resolveProjects(args) {
  const fromArgs = args.projects.filter(Boolean);
  const fromCsv = normalizeList(args.projectsCsv);
  const fromEnv = normalizeList(process.env.FIREBASE_RULES_PROJECTS);
  const fromFile = args.projectsFile ? readProjectsFromFile(args.projectsFile) : [];
  return ensureUnique([...fromArgs, ...fromCsv, ...fromFile, ...fromEnv]);
}

function runDeploy(projectId, dryRun = false) {
  const cmd = "npx";
  const cmdArgs = [
    `firebase-tools@${FIREBASE_TOOLS_VERSION}`,
    "deploy",
    "--only",
    DEPLOY_TARGET,
    "--project",
    projectId,
    "--non-interactive",
  ];

  console.log(`\n[deploy] ${projectId}`);
  console.log(`${cmd} ${cmdArgs.join(" ")}`);

  if (dryRun) return 0;

  const result = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  return Number(result.status || 0);
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }

    const tempKeyFile = setupGoogleCredentialsFromEnv();
    const projects = resolveProjects(args);

    if (!projects.length) {
      throw new Error(
        "Nenhum projeto alvo definido. Use --project/--projects/--project-file ou FIREBASE_RULES_PROJECTS."
      );
    }

    if (!hasAnyAuthMethod()) {
      if (runningInCi()) {
        throw new Error(
          "Autenticacao nao encontrada no CI. Configure GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT ou FIREBASE_TOKEN."
        );
      }
      console.warn(
        "Aviso: sem env de autenticacao. Tentando credencial ja logada no firebase-tools (firebase login)."
      );
    }

    console.log(`Projetos alvo (${projects.length}): ${projects.join(", ")}`);
    if (args.dryRun) {
      console.log("Modo dry-run: nenhum deploy sera executado.");
    }

    for (const projectId of projects) {
      const exitCode = runDeploy(projectId, args.dryRun);
      if (exitCode !== 0) {
        throw new Error(`Falha no deploy das rules para o projeto: ${projectId}`);
      }
    }

    if (tempKeyFile) {
      try {
        fs.unlinkSync(tempKeyFile);
        fs.rmdirSync(path.dirname(tempKeyFile));
      } catch {
        // sem impacto funcional
      }
    }

    console.log("\nDeploy de firestore.rules finalizado.");
  } catch (error) {
    console.error(`\nErro: ${error.message}`);
    process.exit(1);
  }
}

main();
