import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import DOMPurify from "dompurify";
import { authClient } from "@/lib/auth-client";
import { fetchTicket, fetchAgents } from "@/lib/ticket-api";
import { STATUS_LABELS, CATEGORY_LABELS, statusVariant, formatDate } from "@/lib/ticket-utils";
import TicketProperties from "@/components/tickets/TicketProperties";
import ReplyThread from "@/components/tickets/ReplyThread";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronLeft } from "lucide-react";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = authClient.useSession();

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
    enabled: !!id,
  });

  const is404 = !!error && axios.isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={session?.user.name ?? ""} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to tickets
        </Link>

        {isLoading && (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-32 w-full mt-4" />
            </CardContent>
          </Card>
        )}

        {!isLoading && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {is404 ? "Ticket not found." : "Failed to load ticket. Please try again."}
            </AlertDescription>
          </Alert>
        )}

        {ticket && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl leading-snug">{ticket.subject}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant={statusVariant(ticket.status)}>
                    {STATUS_LABELS[ticket.status]}
                  </Badge>
                  {ticket.category && (
                    <Badge variant="secondary">{CATEGORY_LABELS[ticket.category]}</Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-[1fr_260px] gap-0 text-sm">
                  {/* Left — sender info + message */}
                  <div className="pr-8 space-y-5">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                        From
                      </p>
                      <p className="text-foreground">
                        {ticket.fromName ? (
                          <>
                            {ticket.fromName}{" "}
                            <span className="text-muted-foreground text-xs">
                              ({ticket.fromEmail})
                            </span>
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
                            __html: DOMPurify.sanitize(ticket.bodyHtml, {
                              USE_PROFILES: { html: true },
                            }),
                          }}
                        />
                      ) : (
                        <pre className="text-sm text-foreground whitespace-pre-wrap break-words font-sans bg-muted rounded-md p-4 max-h-[32rem] overflow-y-auto leading-relaxed">
                          {ticket.bodyText}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* Right — properties sidebar */}
                  <TicketProperties ticket={ticket} agents={agents} ticketId={id!} />
                </div>
              </CardContent>
            </Card>

            <ReplyThread ticketId={id!} />
          </div>
        )}
      </main>
    </div>
  );
}
