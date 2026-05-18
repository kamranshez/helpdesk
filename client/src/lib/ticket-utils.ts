import type { TicketStatus, TicketCategory } from "@helpdesk/core";

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  closed: "Closed",
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  general_question: "General",
  technical_question: "Technical",
  refund_request: "Refund",
};

export function statusVariant(status: TicketStatus): "default" | "secondary" | "outline" {
  if (status === "open") return "default";
  if (status === "resolved") return "secondary";
  return "outline";
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
