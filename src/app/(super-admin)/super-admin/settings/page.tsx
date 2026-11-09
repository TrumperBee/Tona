// GCC - platform settings.
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/super-admin/settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformSettings } from "@/lib/platform/settings";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata = { title: "Platform settings" };

export default async function SettingsPage() {
  const settings = await getPlatformSettings();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Super Admin console"
        title="Platform settings"
        description="One document controls platform-wide availability and organiser limits. Every change is audited with a reason."
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Settings" }]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Last change</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                Updated by
              </dt>
              <dd className="mt-1 text-grey-200">{settings.updatedBy ?? "Never changed"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                Updated at
              </dt>
              <dd className="mt-1 text-grey-200">
                {settings.updatedAt ? formatDateTime(settings.updatedAt) : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <SettingsForm
        initial={{
          maintenanceMode: settings.maintenanceMode,
          maintenanceMessage: settings.maintenanceMessage,
          registrationsOpen: settings.registrationsOpen,
          maxActiveTournamentsPerOrganiser: settings.maxActiveTournamentsPerOrganiser,
          applicationCooldownDays: settings.applicationCooldownDays,
        }}
      />
    </div>
  );
}
