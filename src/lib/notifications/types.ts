// GCC - notification view types shared by server queries and client chrome.
import type { NotificationType } from "@/types/domain";

export interface NotificationRow {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly read: boolean;
  readonly createdAt: Date | null;
}

export interface NotificationListResult {
  readonly rows: readonly NotificationRow[];
  readonly total: number;
  readonly unread: number;
  readonly hasMore: boolean;
  readonly firstId: string | null;
  readonly lastId: string | null;
}

export interface NotificationBellItem {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly read: boolean;
  readonly createdAt: Date | null;
}

export interface NotificationBellData {
  readonly unreadCount: number;
  readonly items: readonly NotificationBellItem[];
}
