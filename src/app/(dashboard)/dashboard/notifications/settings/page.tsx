// GCC - notification and email settings.
//
// The owner controls three non-critical email streams. The account email is
// shown masked and can only be changed through the fresh-session endpoint.
import { PageHeader } from "@/components/shared/page-header";
import { NotificationPreferencesForm } from "@/components/notifications/preferences-form";
import { ChangeEmailForm } from "@/components/profile/change-email-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageSignedIn } from "@/lib/auth/page-access";
import { maskEmail } from "@/lib/email/client";
import { readNotificationSettings } from "@/lib/notifications/preferences";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notifications/policy";

export const metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const user = await requirePageSignedIn("/dashboard/notifications/settings");
  const settings = await readNotificationSettings(user.userId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Player dashboard"
        title="Notification settings"
        description="Choose which emails you receive. Everything also appears in the notification centre."
      />

      {settings && !settings.emailDeliverable ? (
        <div
          role="alert"
          className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm leading-6 text-warning-soft"
        >
          Email to this address is paused because a previous message bounced or was marked as spam.
          Change your address below to start receiving email again.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Email address</CardTitle>
          <CardDescription>
            Used to sign in and to deliver account and competition email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeEmailForm maskedEmail={maskEmail(settings?.email ?? user.email)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email preferences</CardTitle>
          <CardDescription>
            Applies to the signed-in account only. Critical account email is always sent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesForm initial={settings?.prefs ?? DEFAULT_NOTIFICATION_PREFS} />
        </CardContent>
      </Card>
    </div>
  );
}
