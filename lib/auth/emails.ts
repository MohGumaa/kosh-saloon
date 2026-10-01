import { createTranslator } from "next-intl";
import type { EmailMessage } from "@/lib/email";
import en from "@/locales/en.json";
import ar from "@/locales/ar.json";

type Language = "EN" | "AR";
type Content = Omit<EmailMessage, "to">;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Emails go out in the recipient's stored language, not the requester's cookie.
function translatorFor(language: Language) {
  const locale = language === "AR" ? "ar" : "en";
  return {
    locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    t: createTranslator({ locale, messages: locale === "ar" ? ar : en, namespace: "emails" }),
  };
}

function layout(lang: string, dir: string, paragraphs: string[], link: { href: string; label: string }): string {
  const body = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  return (
    `<!doctype html><html lang="${lang}" dir="${dir}"><body style="font-family:sans-serif;line-height:1.5">` +
    `${body}<p><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></p></body></html>`
  );
}

export interface LoginNotificationDetails {
  name: string;
  language: Language;
  at: Date;
  ipAddress: string;
  userAgent: string;
  forgotPasswordUrl: string;
}

export function loginNotificationEmail(details: LoginNotificationDetails): Content {
  const { locale, dir, t } = translatorFor(details.language);
  const time = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(details.at);

  const paragraphs = [
    t("greeting", { name: details.name }),
    t("login.body"),
    t("login.time", { time }),
    t("login.ip", { ip: details.ipAddress }),
    t("login.device", { device: details.userAgent }),
    t("login.notYou"),
  ];
  const linkLabel = t("login.resetLink");

  return {
    subject: t("login.subject"),
    text: [...paragraphs, `${linkLabel}: ${details.forgotPasswordUrl}`].join("\n\n"),
    html: layout(locale, dir, paragraphs, { href: details.forgotPasswordUrl, label: linkLabel }),
  };
}

export interface PasswordResetDetails {
  name: string;
  language: Language;
  resetUrl: string;
}

export function passwordResetEmail(details: PasswordResetDetails): Content {
  const { locale, dir, t } = translatorFor(details.language);
  const paragraphs = [t("greeting", { name: details.name }), t("reset.body"), t("reset.expiry"), t("reset.ignore")];
  const linkLabel = t("reset.link");

  return {
    subject: t("reset.subject"),
    text: [...paragraphs, `${linkLabel}: ${details.resetUrl}`].join("\n\n"),
    html: layout(locale, dir, paragraphs, { href: details.resetUrl, label: linkLabel }),
  };
}
