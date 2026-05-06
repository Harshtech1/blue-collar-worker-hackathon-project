export const parseAdminEmails = (env = process.env) => {
  const primaryEmail = env.ADMIN_EMAIL || "";
  const extraEmails = env.ADMIN_EMAILS || "";
  const rawEmails = `${primaryEmail},${extraEmails}`.split(",");

  return [...new Set(
    rawEmails
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )];
};

export const isConfiguredAdminEmail = (email, env = process.env) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return Boolean(normalizedEmail) && parseAdminEmails(env).includes(normalizedEmail);
};

export const validateAdminCredentials = ({ email, password }, env = process.env) => {
  const configuredPassword = env.ADMIN_PASSWORD;

  return Boolean(
    configuredPassword
      && password === configuredPassword
      && isConfiguredAdminEmail(email, env),
  );
};
