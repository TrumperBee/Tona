// GCC - shared status and role badges for the Super Admin console.
import { Badge, type BadgeTone } from "@/components/ui/card";
import type { AccountStatus, TournamentStatus, UserRole } from "@/types/domain";

const roleTone: Record<UserRole, BadgeTone> = {
  user: "neutral",
  organiser: "gold",
  super_admin: "danger",
};

const statusTone: Record<AccountStatus, BadgeTone> = {
  active: "success",
  suspended: "warning",
  banned: "danger",
};

const tournamentTone: Record<TournamentStatus, BadgeTone> = {
  draft: "neutral",
  registration_open: "info",
  registration_closed: "info",
  pots_confirmed: "info",
  fixtures_published: "success",
  league_phase: "success",
  knockout: "success",
  completed: "gold",
  archived: "neutral",
  cancelled: "danger",
  suspended: "danger",
};

function labelFrom(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RoleBadge({ role }: { readonly role: UserRole }) {
  return <Badge tone={roleTone[role]}>{labelFrom(role)}</Badge>;
}

export function StatusBadge({ status }: { readonly status: AccountStatus }) {
  return <Badge tone={statusTone[status]}>{labelFrom(status)}</Badge>;
}

export function TournamentStatusBadge({ status }: { readonly status: TournamentStatus }) {
  return <Badge tone={tournamentTone[status]}>{labelFrom(status)}</Badge>;
}
