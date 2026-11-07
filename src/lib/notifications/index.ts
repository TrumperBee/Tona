// GCC — notification domain.
// Planned: in-app notifications and announcements, with email/WhatsApp delivery
// layered on top in later phases.
// TODO(phase 16): implement createNotification, markAsRead and fan-out.

export type NotificationChannel = "in-app" | "email" | "whatsapp";

export interface NotificationDraft {
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly channel: NotificationChannel;
  readonly href?: string;
}
