// GCC - terms of use.
// Complete static policy copy. No accounts or paid services are open yet.
import Link from "next/link";

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
          public site you accept them. If you do not accept them, please do not use the site.
        </p>
        <p>
          The platform is being introduced in stages. Sections that describe accounts, registrations
          or organiser tools apply when those features open; until then, the relevant pages state
          plainly that they are unavailable.
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
          You may use GCC if you can form a binding agreement in your jurisdiction and are old
          enough to consent to online services where you live. If you are below that age, you may
          not create an account.
        </p>
        <p>
          You are responsible for complying with the age rating and online rules of the games you
          play. GCC does not provide game software, accounts, in-game items or publisher services.
        </p>
      </>
    ),
  },
  {
    id: "your-account",
    heading: "Your account",
    body: (
      <>
        <p>
          One person may hold one GCC account. You must provide accurate information, keep your
          sign-in credentials secure and keep your email address current for password reset. You
          must not share, sell or transfer an account.
        </p>
        <p>
          You are responsible for activity carried out through your account. Tell us promptly if you
          believe it has been compromised. We may suspend an account while we investigate a credible
          security or fair-play concern.
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
          Each tournament is run by an approved organiser and has its own rules, platform, schedule
          and eligibility requirements. By entering, you agree to that tournament&rsquo;s rules in
          addition to these terms. Where the two conflict, the tournament rules govern the sporting
          details of that competition.
        </p>
        <p>
          Entries are accepted through the platform only. A place is not secured until the platform
          records your registration and the organiser confirms the field. GCC may decline or remove
          an entry that does not meet the published requirements.
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
          Match results, standings, qualification and knockout progression are calculated and stored
          by the platform. The tournament owner or a Super Admin enters every final score; players
          do not submit or confirm results. The server record is authoritative, and screenshots or
          chat messages do not replace it.
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
          <li>
            manipulate a result, collude with another participant or play on behalf of someone else;
          </li>
          <li>
            use cheats, unauthorised modifications, lag switches or exploits that affect a match;
          </li>
          <li>submit a false result, forged evidence or a misleading identity;</li>
          <li>harass, threaten or discriminate against another participant or organiser;</li>
          <li>
            attempt to access another account, the administration surface or data you are not
            authorised to see.
          </li>
        </ul>
        <p>
          Sanctions include a warning, a result correction, forfeiture, removal from a tournament,
          suspension or a permanent ban. Serious cases may be reported to the relevant game or
          community operator where that is appropriate.
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
          Organisers are independent community operators. They apply, are reviewed and receive a
          limited role that allows them to manage only the tournaments they own. They do not act as
          GCC employees or agents and cannot make promises on GCC&rsquo;s behalf.
        </p>
        <p>
          An organiser must publish clear rules, apply them consistently, protect participant data
          and use the platform&rsquo;s result and result-report tools rather than private
          side-agreements. Abuse of the role may result in removal.
        </p>
      </>
    ),
  },
  {
    id: "third-party-links",
    heading: "Third-party links and eHubMarket",
    body: (
      <>
        <p>
          The site links to eHubMarket, an independent marketplace partner, and may link to other
          third-party services. Those links open in a new tab and are provided for convenience. GCC
          does not control their content, availability, prices or terms.
        </p>
        <p>
          Any purchase or contract with a third party is between you and that third party. GCC does
          not sell game accounts or in-game items and cannot refund, replace or recover a purchase
          made elsewhere.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    heading: "Intellectual property",
    body: (
      <>
        <p>
          The GCC name, logo, site design, written content and software are owned by or licensed to
          GCC. You may view and share public pages for personal, non-commercial use. You may not
          copy the platform, impersonate GCC or use its branding to suggest endorsement.
        </p>
        <p>
          Game titles, publisher marks and league names belong to their respective owners. They are
          used only to describe supported titles or competitive structures. GCC is not affiliated
          with, endorsed by or sponsored by UEFA, any football governing body, any game publisher or
          any professional league.
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
          guarantee of uninterrupted access. Maintenance, security work, third-party outages or a
          competition review may interrupt a feature.
        </p>
        <p>
          We may add, change or retire features. We will not rewrite a completed result without an
          auditable correction, and we will not present an unavailable feature as working.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    heading: "Suspension and termination",
    body: (
      <>
        <p>
          You may stop using GCC at any time. We may suspend or close an account for a breach of
          these terms, a serious fair-play concern, fraud, or a legal or security requirement. Where
          it is safe and lawful to do so, we will explain the reason and the route to challenge the
          decision.
        </p>
        <p>
          Competition records are designed to be permanent. Closing an account does not erase
          completed results, standings or Hall of Fame entries, although we minimise personal
          details that are not needed for the record.
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
          Nothing in these terms excludes or limits a right that cannot lawfully be excluded,
          including your statutory consumer rights. Subject to that, GCC is not liable for indirect
          or consequential loss, lost opportunity, or loss arising from a third-party service, game
          outage or a purchase made outside GCC.
        </p>
        <p>
          You are responsible for your own hardware, connection, game account and compliance with
          the rules of the game you play.
        </p>
      </>
    ),
  },
  {
    id: "governing-law",
    heading: "Governing law and disputes",
    body: (
      <>
        <p>
          These terms are governed by the laws that mandatorily apply to you and to the operator of
          GCC. Before starting a formal dispute, please raise the issue through the contact channel
          so we can try to resolve it directly.
        </p>
        <p>
          The operating entity and its registered details will be published on this page before paid
          services or public competition registration open.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    body: (
      <p>
        We may update these terms as the platform develops. The date at the top of the page always
        shows the current version. A material change will be announced on the platform before it
        takes effect. Continuing to use GCC after a change means you accept the updated terms.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <p>
        Questions about these terms can be sent through the contact page. Please include the page or
        competition the question relates to, and do not send passwords or payment details.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of use"
      updated="7 November 2026"
      summary="The rules for using the GCC public site, holding an account and taking part in a competition. Written to be read, not to hide behind."
      sections={sections}
      contactNote={
        <p>
          Need to raise something specific?{" "}
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
            privacy policy
          </Link>
          .
        </p>
      }
    />
  );
}
