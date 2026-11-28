// GCC - terms of use.
// Draft policy copy for launch readiness. Review by a qualified lawyer before wide launch.
import Link from "next/link";

import { CONTACT_EMAIL, CONTACT_EMAIL_MAILTO } from "@/lib/config/site";
import { LegalPage, type LegalSection } from "@/components/shared/legal-page";

export const metadata = {
  title: "Terms of use",
  description:
    "The terms that govern use of the Global Champions Circuit public site, accounts and competitions.",
};

const sections: readonly LegalSection[] = [
  {
    id: "these-terms",
    heading: "These terms",
    body: (
      <>
        <p>
          These terms govern your use of the Global Champions Circuit (&ldquo;GCC&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;) website and competition platform. By browsing the
          site, creating an account, or taking part in a competition, you accept them.
        </p>
        <p>
          GCC is independent tournament infrastructure for football gaming communities. GCC is not a
          game, publisher service, betting product, or league operated by a football governing body.
        </p>
      </>
    ),
  },
  {
    id: "who-may-use-gcc",
    heading: "Who may use GCC",
    body: (
      <>
        <p>
          You may create a GCC account only if you are at least 13 years old. If you are under 13,
          you may not create an account or submit personal information through account forms. If the
          age at which you can consent to online services in your country is higher than 13, you may
          only use GCC where you have the required consent or legal basis.
        </p>
        <p>
          You are responsible for complying with the age rating and online rules of the games you
          play. GCC does not provide game software, accounts, in-game items, or publisher services.
        </p>
      </>
    ),
  },
  {
    id: "your-account",
    heading: "Your account and passwords",
    body: (
      <>
        <p>
          One person may hold one GCC account. You must provide accurate information, keep your
          sign-in credentials secure, and use a password that meets GCC&apos;s password policy. You
          are responsible for activity carried out through your account.
        </p>
        <p>
          Do not share, sell, or transfer an account. Tell us promptly through the contact page if
          you believe your account has been compromised. We may suspend an account while we
          investigate a credible security, fraud, or fair-play concern.
        </p>
      </>
    ),
  },
  {
    id: "competition-entry",
    heading: "Competition entry and rules",
    body: (
      <>
        <p>
          Each tournament is run by an approved organiser and has its own rules, platform, schedule,
          and eligibility requirements. By entering, you agree to that tournament&apos;s rules in
          addition to these terms. Where the two conflict, the tournament rules govern the sporting
          details of that competition.
        </p>
        <p>
          Entries are accepted through the platform only. A place is not secured until the platform
          records your registration and the organiser confirms the field. GCC may decline or remove
          an entry that does not meet published requirements.
        </p>
      </>
    ),
  },
  {
    id: "results-reports",
    heading: "Results, standings and result reports",
    body: (
      <>
        <p>
          Match results, standings, qualification, and knockout progression are calculated and
          stored by the platform. The tournament owner or a Super Admin enters every final score;
          players do not submit or confirm official results. The server record is authoritative.
        </p>
        <p>
          A player who believes a recorded result is wrong can use the &ldquo;Report a
          problem&rdquo; channel for admin review. A report is not an official result change. Any
          correction is made by the tournament owner or Super Admin with a reason and an audit
          entry, so history is preserved rather than deleted.
        </p>
      </>
    ),
  },
  {
    id: "fair-play",
    heading: "Fair play",
    body: (
      <>
        <p>You must not:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>manipulate a result, collude, or play on behalf of someone else;</li>
          <li>use cheats, unauthorised modifications, lag switches, or exploits;</li>
          <li>submit false evidence, forged identity details, or misleading reports;</li>
          <li>harass, threaten, or discriminate against another participant or organiser;</li>
          <li>
            attempt to access another account, admin surface, or data you are not authorised to see.
          </li>
        </ul>
        <p>
          Sanctions include warning, result correction, forfeiture, removal from a tournament,
          suspension, or permanent ban.
        </p>
      </>
    ),
  },
  {
    id: "whatsapp-contact",
    heading: "WhatsApp contact with opponents and organisers",
    body: (
      <>
        <p>
          When you enter a competition, GCC may issue a WhatsApp contact link for a scheduled match
          to the opponent in that match or to the tournament organiser, where needed to arrange the
          match. Your WhatsApp number is never published as plain text and is never included in a
          public tournament or profile document.
        </p>
        <p>
          A WhatsApp link necessarily contains the recipient&apos;s number. GCC therefore issues
          links only to signed-in users with a real relationship to the match/tournament, only where
          allowed by product rules, under rate limits, and records issuance for abuse handling. You
          can remove your WhatsApp number from your profile at any time; removal stops new links.
        </p>
        <p>
          Contact received through GCC must be used only for competition-related communication.
          Using a number for harassment, spam, marketing, or unrelated contact is a breach of these
          terms.
        </p>
      </>
    ),
  },
  {
    id: "organisers",
    heading: "Organisers",
    body: (
      <>
        <p>
          Organisers are independent community operators. They apply, are reviewed, and receive a
          limited role for tournaments they own. They do not act as GCC employees or agents and
          cannot make promises on GCC&apos;s behalf.
        </p>
        <p>
          Organisers must follow the{" "}
          <Link
            href="/organiser-code"
            className="font-semibold text-electric-300 underline-offset-4 hover:underline"
          >
            Organiser Code of Conduct
          </Link>
          , publish clear rules, protect participant data, and use platform result/report tools.
        </p>
      </>
    ),
  },
  {
    id: "third-party-services",
    heading: "Third-party services and links",
    body: (
      <>
        <p>
          GCC uses third-party services to operate the platform. These include Firebase (Auth and
          Firestore data hosting), Cloudinary (image hosting for avatars/logos/covers where
          configured), Resend (transactional email delivery), and hosting/infrastructure providers
          such as Vercel. Third-party services have their own terms and privacy practices.
        </p>
        <p>
          The site may link to independent third parties such as eHubMarket. GCC does not control
          their content, availability, prices, or terms. Any purchase or contract with a third party
          is between you and that third party.
        </p>
      </>
    ),
  },
  {
    id: "data-and-privacy",
    heading: "Data, privacy and retention",
    body: (
      <>
        <p>
          Our{" "}
          <Link
            href="/privacy"
            className="font-semibold text-electric-300 underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>{" "}
          explains what data GCC collects, why it is used, and how it is handled. Competition
          records are designed to be permanent: completed results, standings, titles, and Hall of
          Fame records may be kept as part of the sporting record.
        </p>
        <p>
          If you delete your account, GCC removes account/personal profile data as described in the
          Privacy Policy. Match/tournament history may be retained under the existing gamer tag,
          with the public profile shown as &ldquo;Deleted player&rdquo; and no avatar. GCC does not
          silently release gamer tags or tournament registrations.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    heading: "Availability and changes",
    body: (
      <>
        <p>
          We work to keep the platform available and accurate, but it is provided without a
          guarantee of uninterrupted access. Maintenance, security work, third-party outages, or
          competition review may interrupt a feature.
        </p>
        <p>
          We may add, change, or retire features. We will not rewrite a completed result without an
          auditable correction.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    heading: "Liability",
    body: (
      <>
        <p>
          Nothing in these terms excludes or limits a right that cannot lawfully be excluded.
          Subject to that, GCC is not liable for indirect or consequential loss, lost opportunity,
          or loss arising from a third-party service, game outage, or a purchase made outside GCC.
        </p>
        <p>
          You are responsible for your own hardware, connection, game account, and compliance with
          the rules of the game you play.
        </p>
      </>
    ),
  },
  {
    id: "governing-law",
    heading: "Governing law and contact",
    body: (
      <>
        <p>
          These terms are intended to be read alongside applicable law. GCC operates with awareness
          of Kenya&apos;s Data Protection Act, 2019, where applicable, and other mandatory legal
          requirements that may apply to users or the operator.
        </p>
        <p>
          Questions about these terms can be sent to{" "}
          <a
            href={CONTACT_EMAIL_MAILTO}
            className="font-semibold text-electric-300 underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          or through the{" "}
          <Link
            href="/contact"
            className="font-semibold text-electric-300 underline-offset-4 hover:underline"
          >
            contact page
          </Link>
          . Do not send passwords or payment details.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    body: (
      <p>
        We may update these terms as the platform develops. The date at the top of the page shows
        the current version. A material change should be announced before it takes effect.
        Continuing to use GCC after a change means you accept the updated terms.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of use"
      updated="26 November 2026"
      summary="Rules for using GCC, creating an account, entering competitions, and interacting with organisers and opponents. Draft for launch readiness; review by a qualified lawyer before wide launch."
      sections={sections}
      contactNote={
        <p>
          Need help?{" "}
          <Link
            href="/contact"
            className="font-semibold text-electric-300 underline-offset-4 hover:underline"
          >
            Contact the team
          </Link>{" "}
          or read the{" "}
          <Link
            href="/privacy"
            className="font-semibold text-electric-300 underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      }
    />
  );
}
