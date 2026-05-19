import DOMPurify from "dompurify";
import type { TicketDetail } from "@helpdesk/core";
import { formatDate } from "@/lib/ticket-utils";
import TicketSummary from "./TicketSummary";

type Props = { ticket: TicketDetail; ticketId: string };

export default function TicketBody({ ticket, ticketId }: Props) {
  return (
    <div className="pr-8 space-y-5">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
          From
        </p>
        <p className="text-foreground">
          {ticket.fromName ? (
            <>
              {ticket.fromName}{" "}
              <span className="text-muted-foreground text-xs">({ticket.fromEmail})</span>
            </>
          ) : (
            ticket.fromEmail
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Created
          </p>
          <p className="text-foreground">{formatDate(ticket.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Updated
          </p>
          <p className="text-foreground">{formatDate(ticket.updatedAt)}</p>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <p className="text-sm font-semibold text-foreground mb-3">Message</p>
        {ticket.bodyHtml ? (
          <div
            className="text-sm text-foreground bg-muted rounded-md p-4 max-h-[32rem] overflow-y-auto leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(ticket.bodyHtml, { USE_PROFILES: { html: true } }),
            }}
          />
        ) : (
          <pre className="text-sm text-foreground whitespace-pre-wrap break-words font-sans bg-muted rounded-md p-4 max-h-[32rem] overflow-y-auto leading-relaxed">
            {ticket.bodyText}
          </pre>
        )}
      </div>

      <TicketSummary ticketId={ticketId} />
    </div>
  );
}
