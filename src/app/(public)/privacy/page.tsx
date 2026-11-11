// GCC - privacy policy.
// Describes the data model that exists in the repository; no analytics or
// advertising services are present.
import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/shared/legal-page";

export const metadata = {
  title: "Privacy policy",
  description:
    "How GCC collects, uses, stores and protects personal data across accounts, competitions and public records.",
};

const sections: readonly LegalSection[] = [
  {
    id: "scope",
    heading: "Scope",
    body: (
      <>
        <p>
          This policy explains how Global Champions Circuit (&ldquo;GCC&rdquo;) handles personal
          data when you visit the public site, hold an account or take part in a competition. It
          applies to this deployment of the platform.
        </p>
        <p>
          The public site can be browsed without an account. Accounts are not open yet; when they
          open, this policy will apply to the data described below.
        </p>
      </>
    ),
  },
  {
    id: "data-we-collect",
    heading: "Data we collect",
    body: (
      <>
        <p>When accounts and competitions are active, we collect:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-grey-100">Account data:</strong> full name, gamer tag, email
            address, optional WhatsApp number, country, preferred game, platform and optional
            profile photo.
          </li>
          <li>
            <strong className="text-grey-100">Competition data:</strong> registrations, pot and
            fixture assignments, admin-entered results, standings, result reports and announcements.
          </li>
          <li>
            <strong className="text-grey-100">Organiser data:</strong> application details such as
            community name, experience, motivation, expected player count and contact channels.
          </li>
          <li>
            <strong className="text-grey-100">Technical data:</strong> the minimum information
            needed to serve pages, keep a session secure and protect the platform from abuse, such
            as request logs and an http-only session cookie.
          </li>
        </ul>
        <p>
          We do not run advertising trackers, sell personal data or collect payment details on this
          site.
        </p>
      </>
    ),
  },
  {
    id: "why-we-use-data",
    heading: "Why we use your data",
    body: (
      <>
        <ul className="list-disc space-y-2 pl-5">
          <li>To create and secure your account.</li>
          <li>To enter you in competitions, generate fixtures and record results.</li>
          <li>To display public competition records and career statistics.</li>
          <li>To review organiser applications and administer roles.</li>
          <li>To investigate result reports, fair-play concerns and security incidents.</li>
          <li>To meet legal obligations and enforce our terms.</li>
        </ul>
        <p>
          We rely on performance of our agreement with you, our legitimate interests in running a
          fair and secure competition platform, consent where it is required, and legal obligation.
          You can withdraw consent for an optional feature at any time.
        </p>
      </>
    ),
  },
  {
    id: "what-is-public",
    heading: "What is public",
    body: (
      <>
        <p>
          A public player profile may show your gamer tag, country, preferred game, platform, photo
          and competitive record: tournaments entered, matches played, wins, draws, losses, goals
          and titles.
        </p>
        <p>
          Your email address and WhatsApp number are never shown on a public profile or in a public
          tournament document. Organisers receive only the contact details needed to run their
          competition, and those details are not published.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies and sessions",
    body: (
      <>
        <p>
          GCC uses a single http-only session cookie when you sign in. It is used to keep you signed
          in, is not readable by page scripts and is cleared when you sign out or when it expires.
        </p>
        <p>
          We do not use advertising cookies, cross-site trackers or third-party analytics on the
          public site. If that changes, this policy will be updated before the change takes effect.
        </p>
      </>
    ),
  },
  {
    id: "service-providers",
    heading: "Service providers",
    body: (
      <>
        <p>
          Firebase (a Google service) provides authentication and the database that stores accounts
          and competition records. Our hosting provider serves the site. These providers process
          data on our instructions and under their own security and data protection commitments.
        </p>
        <p>
          eHubMarket is an independent marketplace partner. GCC does not send your account data to
          eHubMarket. If you follow the link, your browser makes a normal request to that site and
          its own privacy policy applies.
        </p>
        <p>
          We may disclose data where required by law, to protect a person&rsquo;s safety, or to
          investigate fraud or a serious breach of our terms.
        </p>
      </>
    ),
  },
  {
    id: "international-transfers",
    heading: "International transfers",
    body: (
      <p>
        Our service providers may process data in countries other than yours. Where that happens, we
        rely on the transfer safeguards offered by those providers and applicable data protection
        law. You can ask us for more information about the safeguards used for your data.
      </p>
    ),
  },
  {
    id: "retention",
    heading: "How long we keep data",
    body: (
      <>
        <p>
          Account data is kept while your account exists and for a short period afterwards where
          needed for security, dispute resolution or legal obligations.
        </p>
        <p>
          Competition records are designed to be permanent. Completed results, standings, champions
          and Hall of Fame entries are preserved as part of the sporting record. If an account is
          closed, we remove or minimise personal details that are not needed to maintain that
          record.
        </p>
      </>
    ),
  },
  {
    id: "security",
    heading: "Security",
    body: (
      <>
        <p>
          Administrative credentials never reach the browser. Sessions are verified on the server,
          database access is restricted by security rules, and privileged actions are audited. No
          system is completely secure, but we work to limit access to personal data to the people
          and processes that need it.
        </p>
        <p>
          If you believe an account or a competition has been compromised, contact us immediately
          and do not share your password or one-time codes.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    heading: "Your rights",
    body: (
      <>
        <p>
          Depending on where you live, you may have the right to access, correct, delete or restrict
          the use of your personal data, to object to certain processing, to receive a portable
          copy, and to complain to a data protection authority.
        </p>
        <p>
          Some records may be exempt from deletion where they are needed for the permanent
          competition record, to resolve a dispute, or to meet a legal obligation. If that applies,
          we will explain what is retained and why. To make a request, use the contact page.
        </p>
      </>
    ),
  },
  {
    id: "children",
    heading: "Children",
    body: (
      <p>
        GCC is not intended for children below the age at which they can consent to online services
        in their country. We do not knowingly collect data from a child below that age. If you
        believe a child has created an account, contact us so it can be reviewed and removed.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        We may update this policy as the platform develops. The date at the top of the page shows
        the current version. A material change will be announced on the platform before it takes
        effect.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <p>
        Privacy questions and requests can be sent through the contact page. Please describe the
        data or account concerned; do not send passwords, one-time codes or payment details.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy policy"
      updated="7 November 2026"
      summary="What GCC collects, why it is needed, who can see it and how competition records are kept. Your email address and WhatsApp number are never public."
      sections={sections}
      contactNote={
        <p>
          To make a privacy request, use the{" "}
          <Link
            href="/contact"
            className="font-semibold text-electric-300 underline-offset-4 hover:underline"
          >
            contact page
          </Link>
          . For the rules of the platform, read the{" "}
          <Link
            href="/terms"
            className="font-semibold text-electric-300 underline-offset-4 hover:underline"
          >
            terms of use
          </Link>
          .
        </p>
      }
    />
  );
}
