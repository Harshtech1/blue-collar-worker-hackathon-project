export const ADMIN_COPILOT_SEED_EVENT = "rahi-admin-copilot-seed";

export type AdminCopilotSeedMode = "send" | "draft";

export type AdminCopilotSeedDetail = {
  prompt: string;
  sourceLabel?: string;
  mode?: AdminCopilotSeedMode;
};

export const emitAdminCopilotSeed = (detail: AdminCopilotSeedDetail) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(ADMIN_COPILOT_SEED_EVENT, {
    detail,
  }));
};
