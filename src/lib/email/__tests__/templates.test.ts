// GCC - email template unit tests.
//
// Every value that reaches a template may be user-controlled (gamer tags,
// tournament names, announcement copy). These tests prove the layout escapes it,
// emits a plain-text alternative, and only offers an unsubscribe link on
// non-critical mail.
import { describe, expect, it } from "vitest";

import { EMAIL_LOGO_URL, escapeHtml, renderEmailLayout } from "@/lib/email/templates/layout";
import {
  absoluteEmailUrl,
  notificationSubject,
  renderNotificationEmail,
} from "@/lib/email/templates/notification";
import { renderAllEmailTemplates } from "@/lib/email/templates";
import { NOTIFICATION_KINDS, NOTIFICATION_REGISTRY } from "@/lib/notifications/types";

const UNSUBSCRIBE = "https://example.com/unsubscribe?t=signed-token";
const XSS = `<script>alert("x")</script> & 'quoted'`;

describe("escapeHtml", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("escapes ampersands before the entities it creates", () => {
    expect(escapeHtml("A & B < C")).toBe("A &amp; B &lt; C");
  });
});

describe("renderEmailLayout", () => {
  it("escapes user-controlled fields in the HTML body", () => {
    const rendered = renderEmailLayout({
      preheader: XSS,
      heading: XSS,
      paragraphs: [XSS],
      bullets: [XSS],
      button: { label: XSS, url: "https://example.com/?q=<script>" },
      footerNote: XSS,
    });

    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("</script>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).toContain("&amp; &#39;quoted&#39;");
  });

  it("uses an absolute logo and a real plain-text alternative", () => {
    const rendered = renderEmailLayout({
      preheader: "Preview",
      heading: "Hello",
      paragraphs: ["First paragraph", "Second paragraph"],
      bullets: ["One", "Two"],
    });

    expect(EMAIL_LOGO_URL).toMatch(/^https?:\/\//);
    expect(rendered.html).toContain(EMAIL_LOGO_URL);
    expect(rendered.text).toContain("Hello");
    expect(rendered.text).toContain("First paragraph");
    expect(rendered.text).toContain("- One");
    expect(rendered.text).not.toContain("<p");
    expect(rendered.text).not.toContain("<html");
  });

  it("offers an unsubscribe link only when one is supplied", () => {
    const withUnsubscribe = renderEmailLayout({
      preheader: "Preview",
      heading: "Hello",
      paragraphs: ["Body"],
      unsubscribeUrl: UNSUBSCRIBE,
    });
    const critical = renderEmailLayout({
      preheader: "Preview",
      heading: "Hello",
      paragraphs: ["Body"],
      unsubscribeUrl: null,
    });

    expect(withUnsubscribe.html).toContain(UNSUBSCRIBE);
    expect(withUnsubscribe.html).toContain("Unsubscribe from these emails");
    expect(withUnsubscribe.text).toContain(UNSUBSCRIBE);

    expect(critical.html).not.toContain("Unsubscribe from these emails");
    expect(critical.html).toContain("Critical account emails cannot be turned off.");
  });

  it("never includes a phone number or a secret", () => {
    const rendered = renderEmailLayout({
      preheader: "Preview",
      heading: "Hello",
      paragraphs: ["Body"],
    });

    expect(rendered.html).not.toMatch(/\+[0-9]{8,}/);
    expect(rendered.text).not.toMatch(/\+[0-9]{8,}/);
  });
});

describe("absoluteEmailUrl", () => {
  it("keeps absolute URLs and expands app paths", () => {
    expect(absoluteEmailUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(absoluteEmailUrl("/dashboard")).toMatch(/^https?:\/\/.+\/dashboard$/);
    expect(absoluteEmailUrl("dashboard")).toMatch(/^https?:\/\/.+\/dashboard$/);
    expect(absoluteEmailUrl(null)).toBeNull();
    expect(absoluteEmailUrl("")).toBeNull();
  });
});

describe("renderNotificationEmail", () => {
  it("uses the typed subject and label for each kind", () => {
    for (const kind of NOTIFICATION_KINDS) {
      const rendered = renderNotificationEmail({
        kind,
        title: "Notification title",
        body: "Notification body",
        link: "/dashboard",
        unsubscribeUrl: UNSUBSCRIBE,
      });
      const definition = NOTIFICATION_REGISTRY[kind];

      expect(notificationSubject(kind, "Notification title").length).toBeGreaterThan(0);
      expect(rendered.html).toContain(definition.label);
      expect(rendered.text).toContain("Notification title");
    }
  });

  it("removes the unsubscribe option from critical mail even if one is passed", () => {
    const rendered = renderNotificationEmail({
      kind: "account_banned",
      title: "Your account was banned",
      body: "Contact the platform team.",
      link: "/dashboard",
      unsubscribeUrl: UNSUBSCRIBE,
    });

    expect(rendered.html).not.toContain(UNSUBSCRIBE);
    expect(rendered.html).toContain("Critical account emails cannot be turned off.");
  });

  it("shows the unsubscribe link for non-critical mail", () => {
    const rendered = renderNotificationEmail({
      kind: "fixtures_published",
      title: "Your fixtures are published",
      body: "Eight matches are ready.",
      link: "/dashboard/fixtures",
      unsubscribeUrl: UNSUBSCRIBE,
    });

    expect(rendered.html).toContain(UNSUBSCRIBE);
    expect(rendered.html).toContain("View your fixtures");
  });

  it("omits the action button for a suspended or banned account", () => {
    for (const kind of ["account_suspended", "account_banned"] as const) {
      const rendered = renderNotificationEmail({
        kind,
        title: "Account notice",
        body: "Body",
        link: "/dashboard",
      });

      expect(rendered.html).not.toContain("Open GCC</a>");
    }
  });
});

describe("renderAllEmailTemplates", () => {
  it("renders every notification plus the transactional templates", () => {
    const templates = renderAllEmailTemplates();
    const ids = templates.map((template) => template.id);

    for (const kind of NOTIFICATION_KINDS) {
      expect(ids).toContain(kind);
    }

    expect(ids).toEqual(expect.arrayContaining(["welcome", "email-changed", "test", "layout"]));

    for (const template of templates) {
      expect(template.html).toContain("<!DOCTYPE html>");
      expect(template.text.length).toBeGreaterThan(0);
      expect(template.subject.length).toBeGreaterThan(0);
    }
  });
});
