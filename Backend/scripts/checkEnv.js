import {
  ensureProjectEnvLoaded,
  getLoadedEnvPaths,
  inspectEnvValue,
  readEnvValue,
} from "../src/utils/envRuntime.js";

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

const normalizeGeminiModel = (model) => (model || DEFAULT_GEMINI_MODEL).replace(/^models\//, "");

const checkGroq = async () => {
  const apiKey = readEnvValue("GROQ_API_KEY");
  const model = readEnvValue("GROQ_MODEL") || DEFAULT_GROQ_MODEL;

  if (!apiKey) {
    return {
      provider: "groq",
      ok: false,
      status: "missing",
      model,
      message: "GROQ_API_KEY is not available to the backend runtime.",
    };
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        provider: "groq",
        ok: false,
        status: response.status,
        model,
        message: payload?.error?.message || payload?.message || `Groq model probe failed with ${response.status}.`,
      };
    }

    const availableModels = Array.isArray(payload?.data) ? payload.data.map((entry) => entry?.id).filter(Boolean) : [];
    if (!availableModels.includes(model)) {
      return {
        provider: "groq",
        ok: false,
        status: "model_unavailable",
        model,
        message: `${model} is not available for this Groq account.`,
      };
    }

    return {
      provider: "groq",
      ok: true,
      status: response.status,
      model,
      message: "Groq auth and model lookup succeeded.",
    };
  } catch (error) {
    return {
      provider: "groq",
      ok: false,
      status: "network_error",
      model,
      message: error instanceof Error ? error.message : "Unknown Groq probe failure.",
    };
  }
};

const checkGemini = async () => {
  const apiKey = readEnvValue("GEMINI_API_KEY", "GOOGLE_API_KEY", "VITE_GEMINI_API_KEY");
  const model = normalizeGeminiModel(readEnvValue("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL);

  if (!apiKey) {
    return {
      provider: "gemini",
      ok: false,
      status: "missing",
      model,
      message: "No Gemini-compatible API key is available to the backend runtime.",
    };
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${apiKey}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        provider: "gemini",
        ok: false,
        status: response.status,
        model,
        message: payload?.error?.message || `Gemini model probe failed with ${response.status}.`,
      };
    }

    return {
      provider: "gemini",
      ok: true,
      status: response.status,
      model: payload?.name || model,
      message: "Gemini auth and model lookup succeeded.",
    };
  } catch (error) {
    return {
      provider: "gemini",
      ok: false,
      status: "network_error",
      model,
      message: error instanceof Error ? error.message : "Unknown Gemini probe failure.",
    };
  }
};

const main = async () => {
  ensureProjectEnvLoaded();

  const report = {
    checkedAt: new Date().toISOString(),
    loadedEnvPaths: getLoadedEnvPaths(),
    variables: {
      mongodb: inspectEnvValue("MONGODB_URI", "MONGO_URI"),
      cloudinaryUrl: inspectEnvValue("CLOUDINARY_URL"),
      groqApiKey: inspectEnvValue("GROQ_API_KEY"),
      geminiApiKey: inspectEnvValue("GEMINI_API_KEY", "GOOGLE_API_KEY", "VITE_GEMINI_API_KEY"),
    },
    resolvedModels: {
      groq: readEnvValue("GROQ_MODEL") || DEFAULT_GROQ_MODEL,
      gemini: normalizeGeminiModel(readEnvValue("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL),
    },
    providers: await Promise.all([checkGroq(), checkGemini()]),
  };

  const allProvidersFailed = report.providers.every((provider) => !provider.ok);
  if (allProvidersFailed) {
    process.exitCode = 1;
  }

  console.log(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  console.error("[checkEnv] failed", error);
  process.exitCode = 1;
});
