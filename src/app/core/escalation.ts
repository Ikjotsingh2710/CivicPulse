import type { GrievanceTicket } from './models';

/** Matches the threshold the pg_cron job checks (migration 0002). */
export const ESCALATION_HOURS = 24;

const ESCALATION_MS = ESCALATION_HOURS * 60 * 60 * 1000;

export type EscalationState = 'resolved' | 'rejected' | 'unrouted' | 'pending' | 'overdue';

export interface EscalationStatus {
  state: EscalationState;
  /** When the department is next emailed. Null when no clock is running. */
  dueAt: Date | null;
  /** Negative once the deadline has passed. */
  msRemaining: number;
  /** How many reminders have already gone out (0 or 1+, best effort). */
  escalated: boolean;
  label: string;
}

/**
 * Mirrors the server-side rule: the clock starts at `last_escalated_at`, or at
 * `created_at` if no reminder has been sent yet, and fires 24 hours later. The
 * cron job runs hourly, so a countdown reaching zero means "in the next sweep",
 * not "this second".
 */
export function escalationStatus(
  ticket: GrievanceTicket,
  now: number = Date.now(),
): EscalationStatus {
  if (ticket.status === 'Resolved') {
    return {
      state: 'resolved',
      dueAt: null,
      msRemaining: 0,
      escalated: Boolean(ticket.last_escalated_at),
      label: 'Resolved — no escalation needed',
    };
  }

  // A rejected report is closed. Chasing a department about one would be worse
  // than useless, so the clock stops here too.
  if (ticket.status === 'Rejected') {
    return {
      state: 'rejected',
      dueAt: null,
      msRemaining: 0,
      escalated: Boolean(ticket.last_escalated_at),
      label: ticket.rejection_reason ?? 'Rejected — no escalation needed',
    };
  }

  // Without a department address there is nobody for the job to email.
  if (!ticket.department_email) {
    return {
      state: 'unrouted',
      dueAt: null,
      msRemaining: 0,
      escalated: false,
      label: 'No department email on this ticket — escalation is not scheduled',
    };
  }

  const since = new Date(ticket.last_escalated_at ?? ticket.created_at).getTime();
  const dueAt = new Date(since + ESCALATION_MS);
  const msRemaining = dueAt.getTime() - now;
  const escalated = Boolean(ticket.last_escalated_at);

  if (msRemaining <= 0) {
    return {
      state: 'overdue',
      dueAt,
      msRemaining,
      escalated,
      label: escalated ? 'Reminder due again in the next sweep' : 'Reminder due in the next sweep',
    };
  }

  return {
    state: 'pending',
    dueAt,
    msRemaining,
    escalated,
    label: escalated
      ? `Next reminder in ${formatCountdown(msRemaining)}`
      : `Escalates in ${formatCountdown(msRemaining)}`,
  };
}

/** "6h 12m", or "48m" under an hour — never a bare millisecond count. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
