// GCC - account security and operations emails.
//
// These are transactional, not marketing. The change notice goes to the OLD
// address so a compromised session cannot hide the change from the owner.
import { SITE_URL } from "@/lib/config/site";

import { renderEmailLayout, type RenderedEmail } from "./layout";

export function renderEmailChangedEmail(data: {
  readonly gamerTag: string;
  readonly newEmail: string;
}): RenderedEmail {
  return renderEmailLayout({
    preheader: "Your GCC email address was changed.",
    heading: "Your email address was changed",
    paragraphs: [
      `The email address on the GCC account for ${data.gamerTag} was changed.`,
      "If you made this change, no action is needed. Sign in again with the new address (shown below) to continue.",
      "If you did not make this change, contact the platform team immediately. Your other sessions have been signed out.",
    ],
    bullets: [`New address: ${data.newEmail}`],
    button: { label: "Open GCC", url: `${SITE_URL}/login` },
    footerNote: "This security notice is sent to the previous address and cannot be turned off.",
    unsubscribeUrl: null,
  });
}

export function renderTestEmail(data: { readonly adminEmail: string }): RenderedEmail {
  return renderEmailLayout({
    preheader: "This is a test message from the GCC Super Admin email tools.",
    heading: "Test email",
    paragraphs: [
      "Resend is configured and this message was accepted for delivery.",
      `It was sent to ${data.adminEmail} from the Super Admin console.`,
    ],
    button: { label: "Open settings", url: `${SITE_URL}/super-admin/settings` },
    footerNote: "Test emails use the same sender, reply-to and quota path as real notifications.",
    unsubscribeUrl: null,
  });
}
