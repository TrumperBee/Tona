// GCC - rendered email preview (development only).
//
// Renders every template with sample data and shows the HTML and plain text
// side by side. The route returns 404 in production so it cannot be used to
// inspect internal copy on a live deployment.
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { renderAllEmailTemplates } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email preview",
  robots: { index: false, follow: false },
};

export default function EmailPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const templates = renderAllEmailTemplates();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Development"
        title="Email preview"
        description="Every template with representative sample data. Nothing is sent and this page is unavailable in production."
      />

      {templates.map((template) => (
        <Card key={template.id}>
          <CardHeader>
            <CardTitle>{template.name}</CardTitle>
            <p className="mt-1 text-sm text-grey-400">Subject: {template.subject}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <iframe
              title={`${template.name} HTML preview`}
              srcDoc={template.html}
              sandbox=""
              className="h-[640px] w-full rounded-lg border border-white/10 bg-white"
            />
            <details className="rounded-lg border border-white/10 p-4 text-sm text-grey-300">
              <summary className="cursor-pointer font-semibold text-white">
                Plain-text version
              </summary>
              <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-5">
                {template.text}
              </pre>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
