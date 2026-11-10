// GCC - request-scoped notification bell data.
//
// React's cache() deduplicates the unread count and latest-five query inside one
// server request. Layouts call this only after a session guard has succeeded.
import "server-only";

import { cache } from "react";

import { getNotificationBellData } from "@/lib/notifications";
import type { NotificationBellData } from "@/lib/notifications/types";

export const getNotificationBell = cache(async (uid: string): Promise<NotificationBellData> => {
  return getNotificationBellData(uid);
});
