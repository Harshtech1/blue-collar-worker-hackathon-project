export const ADMIN_MAP_COMMAND_EVENT = "rahi-admin-map-command";

export type AdminMapCommandDetail = {
  command: "focus_revenue_moat";
  source?: string;
};

export const emitAdminMapCommand = (detail: AdminMapCommandDetail) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(ADMIN_MAP_COMMAND_EVENT, {
    detail,
  }));
};
