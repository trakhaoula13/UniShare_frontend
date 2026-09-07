import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const TEMPLATE_RESET_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID; // Password Reset
const TEMPLATE_VERIFICATION_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_VERIFICATION_ID; // OTP / Authentication

// Tente de recuperer l'adresse IP publique du visiteur (best-effort, non bloquant).
const getClientIp = async () => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    return data.ip || "Non disponible";
  } catch {
    return "Non disponible";
  }
};

const splitName = (fullName = "") => {
  const parts = fullName.trim().split(" ");
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" };
};

/**
 * Envoie l'email de verification OTP (inscription).
 * Template attendu (EmailJS) : {{otpCode}}, {{email}}, {{expiryTime}}, {{firstName}}, {{lastName}}
 */
export const sendVerificationEmail = async ({ email, code, fullName = "", expiryTime = "10 minutes" }) => {
  if (!SERVICE_ID || !PUBLIC_KEY || !TEMPLATE_VERIFICATION_ID) {
    throw new Error("Configuration EmailJS manquante (verifiez le fichier .env)");
  }
  const { firstName, lastName } = splitName(fullName);

  return emailjs.send(
    SERVICE_ID,
    TEMPLATE_VERIFICATION_ID,
    { otpCode: code, email, expiryTime, firstName, lastName },
    { publicKey: PUBLIC_KEY }
  );
};

/**
 * Envoie l'email de reinitialisation de mot de passe (lien cliquable).
 * Template attendu (EmailJS) : {{email}}, {{firstName}}, {{lastName}}, {{requestDate}}, {{ipAddress}}, {{resetLink}}
 */
export const sendPasswordResetEmail = async ({ email, resetLink, fullName = "" }) => {
  if (!SERVICE_ID || !PUBLIC_KEY || !TEMPLATE_RESET_ID) {
    throw new Error("Configuration EmailJS manquante (verifiez le fichier .env)");
  }
  const { firstName, lastName } = splitName(fullName);
  const ipAddress = await getClientIp();
  const requestDate = new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

  return emailjs.send(
    SERVICE_ID,
    TEMPLATE_RESET_ID,
    { email, firstName, lastName, requestDate, ipAddress, resetLink },
    { publicKey: PUBLIC_KEY }
  );
};
