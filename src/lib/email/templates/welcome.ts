// GCC - welcome email sent once, right after registration.
import { SITE_URL } from "@/lib/config/site";

import { renderEmailLayout, type RenderedEmail } from "./layout";

export interface WelcomeEmailData {
  readonly gamerTag: string;
}

export function renderWelcomeEmail(data: WelcomeEmailData): RenderedEmail {
  return renderEmailLayout({
    preheader: "Your GCC account is ready. Find a competition and get your first fixture.",
    heading: `Welcome to GCC, ${data.gamerTag}`,
    paragraphs: [
      "Your account is ready. Browse open competitions, enter one, and your fixtures and results will appear on your dashboard.",
      "We send a short email when something you entered changes: a confirmed entry, a completed draw, published fixtures, a knockout tie or a final result. You can turn optional email off at any time.",
    ],
    bullets: [
      "Complete your profile so opponents recognise your gamer tag.",
      "Check the competition rules and schedule before you enter.",
      "If this address is wrong, change it from profile settings while signed in.",
    ],
    button: { label: "Find a competition", url: `${SITE_URL}/tournaments` },
    footerNote: "This welcome email is sent once and is not part of your notification preferences.",
    unsubscribeUrl: null,
  });
}
