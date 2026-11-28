// GCC - privacy policy.
// Draft policy copy for launch readiness. Review by a qualified lawyer before wide launch.
import Link from "next/link";

import { CONTACT_EMAIL, CONTACT_EMAIL_MAILTO } from "@/lib/config/site";
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
          data when you visit the site, create an account, or take part in a competition.
        </p>
        <p>
          GCC handles personal data in line with applicable law. Where relevant, this includes
          Kenya&apos;s Data Protection Act, 2019. This page is a product privacy draft and should be
          reviewed by a qualified lawyer before wide launch.
        </p>
      </>
    ),
  },
  {
    id: "data-we-collect",
    heading: "Data we collect",
    body: (
      <>
        <p>Depending on how you use GCC, we collect:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-grey-100">Account data:</strong> full name, gamer tag, email
            address, password/authentication credentials handled through Firebase Auth, optional
            WhatsApp number, country, preferred game, platform, optional community/favourite club,
            and optional profile photo/avatar.
          </li>
          <li>
            <strong className="text-grey-100">Competition data:</strong> registrations, pot and
            fixture assignments, admin-entered results, standings, knockout progression, result
            reports, and announcements.
          </li>
          <li>
            <strong className="text-grey-100">Organiser data:</strong> application details such as
            community name, experience, motivation, expected player count, and contact channels.
          </li>
          <li>
            <strong className="text-grey-100">Technical data:</strong> minimum information needed to
            serve pages, keep sessions secure, and protect the platform from abuse, such as request
            metadata, rate-limit counters, and http-only session cookies.
          </li>
          <li>
            <strong className="text-grey-100">Email delivery data:</strong> notification
            preferences, deliverability state, and a one-way hash of an address that must not be
            emailed after a hard bounce or spam complaint.
          </li>
        </ul>
        <p>We do not sell personal data and do not run advertising trackers on the public site.</p>
      </>
    ),
  },
  {
    id: "why-we-use-data",
    heading: "Why we use your data",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>To create, secure, and manage your account.</li>
        <li>To enter you in competitions, generate fixtures, record results, and show records.</li>
        <li>To let opponents/organisers arrange matches through controlled WhatsApp links.</li>
        <li>To review organiser applications and administer roles.</li>
        <li>To investigate result reports, fair-play concerns, and security incidents.</li>
        <li>To send account/competition emails through Resend according to preferences.</li>
        <li>To meet legal obligations and enforce our terms.</li>
      </ul>
    ),
  },
  {
    id: "what-is-public",
    heading: "What is public and what is shared",
    body: (
      <>
        <p>
          Public profiles may show gamer tag, country, preferred game, platform, photo, and
          competitive record. Your email address and WhatsApp number are never shown on a public
          profile or public tournament document.
        </p>
        <p>
          If you add a WhatsApp number, GCC may issue a WhatsApp link to a signed-in opponent in a
          scheduled match or to the relevant tournament organiser. A WhatsApp link necessarily
          contains your number; it is never displayed as plain text by GCC, is issued only under
          product rules/rate limits, and issuance is recorded for abuse handling. You can remove
          your number from your profile at any time, which stops new links.
        </p>
      </>
    ),
  },
  {
    id: "email",
    heading: "Email and notifications",
    body: (
      <>
        <p>
          GCC sends account and competition email through Resend. Critical email (security/account
          status, email-change notice, cancelled competition you entered, or similar critical
          notices) may be sent regardless of optional preferences. Important competition emails are
          on by default where applicable; optional emails are opt-in.
        </p>
        <p>
          Non-critical emails include unsubscribe controls. A hard bounce or complaint may pause
          email to that address. In-app notifications remain available where applicable.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies and sessions",
    body: (
      <p>
        GCC uses an http-only session cookie when you sign in. It keeps you signed in, is not
        readable by page scripts, and is cleared on sign-out or expiry. GCC does not use advertising
        cookies or cross-site trackers on the public site.
      </p>
    ),
  },
  {
    id: "service-providers",
    heading: "Service providers and hosting",
    body: (
      <>
        <p>
          GCC uses third-party providers to operate: Firebase (Authentication and Firestore data
          hosting), Cloudinary (image hosting for avatars/tournament logos/covers where configured),
          Resend (email delivery), and Vercel/hosting infrastructure for serving the application.
          These providers process data under their own terms/security commitments.
        </p>
        <p>
          eHubMarket is an independent partner link. GCC does not send your account data to
          eHubMarket. If you follow an external link, that site&apos;s policy applies.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    heading: "Data retention",
    body: (
      <>
        <p>
          Account data is kept while your account exists and for a limited period afterwards where
          needed for security, dispute resolution, or legal obligations.
        </p>
        <p>
          Competition records are designed to be permanent. Completed results, standings, champions,
          and Hall of Fame entries are preserved as sporting records. If an account is deleted, GCC
          minimises/removes personal details not needed for that record.
        </p>
      </>
    ),
  },
  {
    id: "deleting-your-account",
    heading: "Deleting your account",
    body: (
      <>
        <p>
          You can delete your account from profile settings after a recent sign-in. Deletion removes
          your Firebase sign-in and personal profile data (email, full name, WhatsApp number,
          community, favourite club, avatar/profile photo). Avatar files are removed from Cloudinary
          on a best-effort basis.
        </p>
        <p>
          Match/tournament history is kept under the existing gamer tag as part of the permanent
          sporting record. Your public profile becomes &ldquo;Deleted player&rdquo; with no avatar.
          GCC does not silently release gamer tags or tournament registrations. Organisers may see
          &ldquo;Deleted player&rdquo; where needed for the historical record.
        </p>
      </>
    ),
  },
  {
    id: "security",
    heading: "Security",
    body: (
      <p>
        Admin credentials never reach the browser. Sessions are verified on the server, writes go
        through Admin SDK routes with validation/authorisation/audit logging, and privileged actions
        are audited. No system is completely secure, but GCC limits access to personal data to
        people and processes that need it.
      </p>
    ),
  },
  {
    id: "your-rights",
    heading: "Your rights",
    body: (
      <p>
        Depending on where you live, you may have rights to access, correct, delete, restrict,
        object, or receive a portable copy of personal data, and to complain to a data protection
        authority. Some competition records may be retained where needed for the permanent sporting
        record, dispute resolution, or legal obligation. To make a request, contact{" "}
        <a
          href={CONTACT_EMAIL_MAILTO}
          className="font-semibold text-electric-300 underline-offset-4 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    ),
  },
  {
    id: "children",
    heading: "Children and minimum age",
    body: (
      <p>
        GCC is not intended for children under 13. You must be at least 13 years old to create an
        account. If local law requires a higher age or guardian consent for online services, that
        higher requirement applies. If you believe a child under the applicable age has created an
        account, contact us so it can be reviewed and removed.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        We may update this policy as the platform develops. The date at the top of the page shows
        the current version. Material changes should be announced before taking effect.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <p>
        Privacy questions and requests can be sent to{" "}
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
        . Do not send passwords, one-time codes, or payment details.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy policy"
      updated="26 November 2026"
      summary="How GCC handles account, competition, WhatsApp, email, image hosting, and retention data. Draft for launch readiness; review by a qualified lawyer before wide launch."
      sections={sections}
      contactNote={
        <p>
          For platform rules, read the{" "}
          <Link
            href="/terms"
            className="font-semibold text-electric-300 underline-offset-4 hover:underline"
          >
            Terms of Use
          </Link>
          .
        </p>
      }
    />
  );
}
