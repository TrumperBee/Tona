// GCC - known audit actions and human-readable descriptions.
//
// The audit log is append-only. New privileged actions must be registered here
// so the viewer's filter and the overview's activity feed stay honest.
export interface AuditActionDefinition {
  readonly action: string;
  readonly label: string;
}

export const AUDIT_ACTIONS: readonly AuditActionDefinition[] = [
  { action: "user.contact_revealed", label: "Contact number revealed" },
  { action: "user.role.set", label: "User role changed" },
  { action: "user.status.set", label: "Account status changed" },
  { action: "platform.settings.updated", label: "Platform settings updated" },
  { action: "announcement.created", label: "Announcement created" },
  { action: "announcement.updated", label: "Announcement edited" },
  { action: "announcement.published", label: "Announcement published" },
  { action: "announcement.unpublished", label: "Announcement unpublished" },
  { action: "announcement.deleted", label: "Announcement deleted" },
  { action: "application.submitted", label: "Organiser application submitted" },
  { action: "application.withdrawn", label: "Organiser application withdrawn" },
  { action: "application.approved", label: "Organiser application approved" },
  { action: "application.rejected", label: "Organiser application rejected" },
  { action: "application.revoked", label: "Organiser application revoked" },
  { action: "organiser_profile.updated", label: "Organiser profile updated" },
  { action: "tournament.created", label: "Tournament created" },
  { action: "tournament.updated", label: "Tournament details updated" },
  { action: "tournament.status.set", label: "Tournament status changed" },
  { action: "tournament.deleted", label: "Tournament draft deleted" },
  { action: "tournament.suspended", label: "Tournament suspended" },
  { action: "tournament.ownership_transferred", label: "Tournament ownership transferred" },
  { action: "tournament.contact_link_issued", label: "Registration contact link issued" },
  { action: "tournament.registration.created", label: "Player registered" },
  { action: "tournament.registration.withdrawn", label: "Player withdrew" },
  { action: "tournament.registration.removed", label: "Player removed from a tournament" },
  { action: "tournament.registration.added", label: "Player added to a tournament" },
  { action: "draw.confirmed", label: "Draw confirmed" },
  { action: "fixtures.published", label: "Fixtures published" },
  { action: "match.result.set", label: "Result entered" },
  { action: "match.result.corrected", label: "Result corrected" },
  { action: "result_report.resolved", label: "Result report resolved" },
  { action: "result_report.dismissed", label: "Result report dismissed" },
  { action: "hall_of_fame.inducted", label: "Hall of Fame induction" },
] as const;

const actionLabels = new Map(AUDIT_ACTIONS.map((item) => [item.action, item.label]));

/** Returns a readable label, falling back to the raw action code. */
export function describeAuditAction(action: string): string {
  return actionLabels.get(action) ?? action;
}

/** True when an action code is registered (used to reject unknown filters). */
export function isKnownAuditAction(action: string): boolean {
  return actionLabels.has(action);
}
