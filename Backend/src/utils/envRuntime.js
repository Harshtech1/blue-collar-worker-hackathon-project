import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");
const projectRoot = path.resolve(backendRoot, "..");

const ENV_PATHS = [
  path.join(backendRoot, ".env"),
  path.join(projectRoot, ".env"),
  path.join(projectRoot, "react", "app", ".env"),
  path.join(projectRoot, "react", "app", "microservices", "core-api", ".env"),
];

let envLoaded = false;
const fileEnvCache = new Map();
const fileEnvSources = new Map();

const isHostedRuntime = () => Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.VERCEL);

export const ensureProjectEnvLoaded = () => {
  if (envLoaded) {
    return ENV_PATHS;
  }

  envLoaded = true;

  for (const envPath of ENV_PATHS) {
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath));
      for (const [key, value] of Object.entries(parsed)) {
        if (!fileEnvCache.has(key)) {
          fileEnvCache.set(key, value);
          fileEnvSources.set(key, envPath);
        }
      }
      dotenv.config({ path: envPath, override: false });
    }
  }

  return ENV_PATHS;
};

export const sanitizeEnvValue = (rawValue) => {
  if (typeof rawValue !== "string") {
    return "";
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  const withoutWrappingQuotes = trimmed.replace(/^(['"])([\s\S]*)\1$/, "$2").trim();
  return withoutWrappingQuotes;
};

export const readEnvValue = (...keys) => {
  ensureProjectEnvLoaded();

  for (const key of keys) {
    const runtimeValue = sanitizeEnvValue(process.env[key]);
    const fileValue = sanitizeEnvValue(fileEnvCache.get(key));
    const value = isHostedRuntime() ? (runtimeValue || fileValue) : (fileValue || runtimeValue);
    if (value) {
      return value;
    }
  }

  return "";
};

export const inspectEnvValue = (...keys) => {
  ensureProjectEnvLoaded();

  for (const key of keys) {
    const fileValue = fileEnvCache.get(key);
    const runtimeValue = process.env[key];
    const rawValue = isHostedRuntime()
      ? (runtimeValue ?? fileValue)
      : (fileValue ?? runtimeValue);

    if (typeof rawValue !== "string") {
      continue;
    }

    const trimmed = rawValue.trim();
    const sanitized = sanitizeEnvValue(rawValue);

    return {
      key,
      present: rawValue.length > 0,
      sanitizedPresent: Boolean(sanitized),
      rawLength: rawValue.length,
      sanitizedLength: sanitized.length,
      wrappedInQuotes: /^(['"]).*\1$/.test(trimmed),
      hasLeadingOrTrailingWhitespace: rawValue !== trimmed,
      hasNewlines: /[\r\n]/.test(rawValue),
      source: typeof fileValue === "string" && (!isHostedRuntime() || !runtimeValue)
        ? fileEnvSources.get(key)
        : "process.env",
    };
  }

  return {
    key: keys[0] || "unknown",
    present: false,
    sanitizedPresent: false,
    rawLength: 0,
    sanitizedLength: 0,
    wrappedInQuotes: false,
    hasLeadingOrTrailingWhitespace: false,
    hasNewlines: false,
  };
};

export const getLoadedEnvPaths = () => [...ENV_PATHS];
