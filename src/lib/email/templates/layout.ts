// GCC - shared responsive email layout.
//
// Table layout and inline styles only: Gmail, Outlook and mobile clients strip
// stylesheets. Every interpolated value is escaped here, so templates may pass
// user-controlled gamer tags and tournament names safely.
import { SITE_NAME, SITE_SHORT_NAME, SITE_URL } from "@/lib/config/site";

export const EMAIL_LOGO_URL = `${SITE_URL}/brand/gcc-logo-horizontal-dark.svg`;
export const EMAIL_PREFERENCES_URL = `${SITE_URL}/dashboard/notifications/settings`;

const NAVY = "#0A1B33";
const BLUE = "#2E9BFF";
const GOLD = "#D4A63C";
const GREY = "#5B6B82";
const LIGHT = "#F4F7FB";

/** Escapes text for HTML element and attribute contexts. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailButton {
  readonly label: string;
  readonly url: string;
}

export interface EmailLayoutInput {
  readonly preheader: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
  readonly button?: EmailButton | null;
  readonly footerNote?: string | null;
  /** Present only on non-critical mail. */
  readonly unsubscribeUrl?: string | null;
  readonly kindLabel?: string | null;
}

export interface RenderedEmail {
  readonly html: string;
  readonly text: string;
}

function paragraphHtml(value: string): string {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${NAVY};">${escapeHtml(value)}</p>`;
}

function bulletHtml(values: readonly string[]): string {
  if (values.length === 0) return "";

  const items = values
    .map(
      (value) =>
        `<li style="margin:0 0 8px 0;font-size:14px;line-height:22px;color:${NAVY};">${escapeHtml(value)}</li>`,
    )
    .join("");

  return `<ul style="margin:0 0 20px 0;padding:0 0 0 20px;">${items}</ul>`;
}

function buttonHtml(button: EmailButton): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px 0;">` +
    `<tr><td style="border-radius:6px;background:${BLUE};">` +
    `<a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:6px;">${escapeHtml(button.label)}</a>` +
    `</td></tr></table>`
  );
}

/** Renders one complete email plus its plain-text alternative. */
export function renderEmailLayout(input: EmailLayoutInput): RenderedEmail {
  const heading = escapeHtml(input.heading);
  const paragraphs = input.paragraphs.map(paragraphHtml).join("");
  const bullets = bulletHtml(input.bullets ?? []);
  const button = input.button ? buttonHtml(input.button) : "";
  const kindLabel = input.kindLabel
    ? `<p style="margin:0 0 8px 0;font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:${BLUE};">${escapeHtml(input.kindLabel)}</p>`
    : "";
  const footerNote = input.footerNote
    ? `<p style="margin:0 0 10px 0;font-size:12px;line-height:19px;color:${GREY};">${escapeHtml(input.footerNote)}</p>`
    : "";
  const unsubscribe = input.unsubscribeUrl
    ? `<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${GREY};text-decoration:underline;">Unsubscribe from these emails</a>`
    : `<span style="color:${GREY};">Critical account emails cannot be turned off.</span>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:${LIGHT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${LIGHT};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E3E9F2;border-radius:10px;overflow:hidden;">
<tr><td style="height:5px;background:${NAVY};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:22px 28px 0 28px;">
<a href="${escapeHtml(SITE_URL)}" style="text-decoration:none;"><img src="${escapeHtml(EMAIL_LOGO_URL)}" width="210" alt="${escapeHtml(SITE_NAME)}" style="display:block;border:0;max-width:210px;height:auto;"></a>
</td></tr>
<tr><td style="padding:20px 28px 8px 28px;font-family:Arial,Helvetica,sans-serif;">
${kindLabel}
<h1 style="margin:0 0 18px 0;font-size:22px;line-height:30px;color:${NAVY};font-weight:bold;">${heading}</h1>
${paragraphs}
${bullets}
${button}
</td></tr>
<tr><td style="padding:0 28px 24px 28px;font-family:Arial,Helvetica,sans-serif;">
<hr style="border:0;border-top:1px solid #E3E9F2;margin:4px 0 16px 0;">
${footerNote}
<p style="margin:0 0 8px 0;font-size:12px;line-height:19px;color:${GREY};">
Why am I receiving this? It is part of your ${escapeHtml(SITE_SHORT_NAME)} account or a competition you entered.
</p>
<p style="margin:0;font-size:12px;line-height:19px;color:${GREY};">
<a href="${escapeHtml(EMAIL_PREFERENCES_URL)}" style="color:${GREY};text-decoration:underline;">Manage email preferences</a>
&nbsp;&middot;&nbsp; ${unsubscribe}
</p>
<p style="margin:14px 0 0 0;font-size:11px;line-height:18px;color:#8795A8;">
${escapeHtml(SITE_NAME)} &middot; One Platform. Endless Competition.
</p>
</td></tr>
<tr><td style="height:4px;background:${GOLD};font-size:0;line-height:0;">&nbsp;</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const textLines = [
    input.heading,
    "",
    ...input.paragraphs,
    ...(input.bullets && input.bullets.length > 0
      ? ["", ...input.bullets.map((value) => `- ${value}`)]
      : []),
    ...(input.button ? ["", `${input.button.label}: ${input.button.url}`] : []),
    "",
    input.footerNote ?? "",
    `Why am I receiving this? It is part of your ${SITE_SHORT_NAME} account or a competition you entered.`,
    `Manage email preferences: ${EMAIL_PREFERENCES_URL}`,
    ...(input.unsubscribeUrl ? [`Unsubscribe: ${input.unsubscribeUrl}`] : []),
    "",
    `${SITE_NAME} - One Platform. Endless Competition.`,
  ].filter((line, index, all) => !(line === "" && all[index - 1] === ""));

  return { html, text: textLines.join("\n") };
}
