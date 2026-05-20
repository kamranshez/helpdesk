import type { TicketDetail } from "@helpdesk/core";
import { STATUS_LABELS, CATEGORY_LABELS, statusVariant } from "@/lib/ticket-utils";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = { ticket: TicketDetail };

export default function TicketHeader({ ticket }: Props) {
  return (
    <CardHeader className="pb-4">
      <CardTitle className="text-2xl font-normal leading-snug" style={{ fontFamily: "var(--font-heading)" }}>{ticket.subject}</CardTitle>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Badge variant={statusVariant(ticket.status)}>{STATUS_LABELS[ticket.status]}</Badge>
        {ticket.category && (
          <Badge variant="secondary">{CATEGORY_LABELS[ticket.category]}</Badge>
        )}
      </div>
    </CardHeader>
  );
}
