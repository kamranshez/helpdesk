import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { Ticket, TicketStatus, TicketCategory } from "@helpdesk/core";
import { authClient } from "@/lib/auth-client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

async function fetchTickets(): Promise<Ticket[]> {
  const { data } = await axios.get<{ tickets: Ticket[] }>("/api/tickets", { withCredentials: true });
  return data.tickets;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  closed: "Closed",
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  general_question: "General",
  technical_question: "Technical",
  refund_request: "Refund",
};

function statusVariant(status: TicketStatus): "default" | "secondary" | "outline" {
  if (status === "open") return "default";
  if (status === "resolved") return "secondary";
  return "outline";
}

export default function TicketsPage() {
  const { data: session } = authClient.useSession();
  const { data: tickets = [], isLoading, error } = useQuery({
    queryKey: ["tickets"],
    queryFn: fetchTickets,
  });

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={session?.user.name ?? ""} />
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Subject</th>
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">From</th>
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Category</th>
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-6 py-4"><Skeleton className="h-4 w-48" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium text-muted-foreground">
                {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tickets.length === 0 ? (
                <p className="px-6 py-8 text-sm text-center text-muted-foreground">
                  No tickets yet. They will appear here once received via email.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-6 py-3 text-muted-foreground font-medium">Subject</th>
                      <th className="text-left px-6 py-3 text-muted-foreground font-medium">From</th>
                      <th className="text-left px-6 py-3 text-muted-foreground font-medium">Category</th>
                      <th className="text-left px-6 py-3 text-muted-foreground font-medium">Status</th>
                      <th className="text-left px-6 py-3 text-muted-foreground font-medium">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-foreground max-w-xs truncate">
                          {ticket.subject}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {ticket.fromName ? (
                            <span>{ticket.fromName} <span className="text-xs">({ticket.fromEmail})</span></span>
                          ) : (
                            ticket.fromEmail
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {ticket.category ? (
                            <Badge variant="secondary">{CATEGORY_LABELS[ticket.category]}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant(ticket.status)}>
                            {STATUS_LABELS[ticket.status]}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                          {new Date(ticket.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
