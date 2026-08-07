import type { Duty } from "@/types/domain";

function timeValue(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function shiftKey(duty: Pick<Duty, "startsAt" | "dueDate">) {
  if (!duty.startsAt || !duty.dueDate) return null;
  const start = new Date(duty.startsAt);
  const end = new Date(duty.dueDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return `${start.toISOString()}|${end.toISOString()}`;
}

export function getShiftDuties(duties: Duty[], nowValue = Date.now()) {
  const activeAnchor = duties
    .filter((duty) => {
      const start = timeValue(duty.startsAt);
      const end = timeValue(duty.dueDate);
      return start !== null
        && end !== null
        && start <= nowValue
        && end > nowValue
        && ["Pending", "In Progress", "Completed"].includes(duty.status);
    })
    .sort((a, b) => (timeValue(b.startsAt) ?? 0) - (timeValue(a.startsAt) ?? 0))[0];

  const nextAnchor = activeAnchor ?? duties
    .filter((duty) => duty.status === "Scheduled" && (timeValue(duty.startsAt) ?? 0) > nowValue)
    .sort((a, b) => (timeValue(a.startsAt) ?? 0) - (timeValue(b.startsAt) ?? 0))[0];

  const key = nextAnchor ? shiftKey(nextAnchor) : null;
  if (!key) return [];

  const allowedStatuses = activeAnchor
    ? ["Pending", "In Progress", "Completed"]
    : ["Scheduled"];

  return duties.filter((duty) => shiftKey(duty) === key && allowedStatuses.includes(duty.status));
}

export function getActiveShift(duties: Duty[], nowValue = Date.now()) {
  const duty = duties
    .filter((item) => {
      const start = timeValue(item.startsAt);
      const end = timeValue(item.dueDate);
      return start !== null
        && end !== null
        && start <= nowValue
        && end > nowValue
        && ["Scheduled", "Pending", "In Progress", "Completed"].includes(item.status);
    })
    .sort((a, b) => (timeValue(b.startsAt) ?? 0) - (timeValue(a.startsAt) ?? 0))[0];

  return duty?.startsAt && duty.dueDate
    ? { startsAt: duty.startsAt, endsAt: duty.dueDate }
    : null;
}
