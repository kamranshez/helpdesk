import { useParams, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { TicketDetail, TicketStatus, TicketCategory } from "@helpdesk/core";
import { authClient } from "@/lib/auth-client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { AlertCircle, ChevronLeft } from "lucide-react";

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

type Agent = { id: string; name: string; email: string };

async function fetchTicket(id: string): Promise<TicketDetail> {
  const { data } = await axios.get<{ ticket: TicketDetail }>(`/api/tickets/${id}`, {
    withCredentials: true,
  });
  return data.ticket;
}

async function fetchAgents(): Promise<Agent[]> {
  const { data } = await axios.get<{ agents: Agent[] }>("/api/users/agents", {
    withCredentials: true,
  });
  return data.agents;
}

async function assignTicket(ticketId: string, assignedToId: string | null): Promise<void> {
  await axios.patch(`/api/tickets/${ticketId}`, { assignedToId }, { withCredentials: true });
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();

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

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) => assignTicket(id!, assignedToId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", id] }),
  });

  const is404 = !!error && axios.isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={session?.user.name ?? ""} />
      <main className="max-w-3xl mx-auto px-4 py-8">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{ticket.subject}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant={statusVariant(ticket.status)}>
                  {STATUS_LABELS[ticket.status]}
                </Badge>
                {ticket.category && (
                  <Badge variant="secondary">{CATEGORY_LABELS[ticket.category]}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-3">
                <p>
                  <span className="font-medium text-foreground">From:</span>{" "}
                  {ticket.fromName ? (
                    <>
                      {ticket.fromName}{" "}
                      <span className="text-xs">({ticket.fromEmail})</span>
                    </>
                  ) : (
                    ticket.fromEmail
                  )}
                </p>
                <p>
                  <span className="font-medium text-foreground">Received:</span>{" "}
                  {new Date(ticket.createdAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Assigned to:</span>
                  <Select
                    value={ticket.assignedTo?.id ?? "unassigned"}
                    onValueChange={(val) =>
                      assignMutation.mutate(val === "unassigned" ? null : val)
                    }
                    disabled={assignMutation.isPending}
                  >
                    <SelectTrigger className="h-7 w-48 text-xs">
                      {assignMutation.isPending
                        ? "Saving…"
                        : ticket.assignedTo
                          ? ticket.assignedTo.name
                          : "Unassigned"}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignMutation.isError && (
                    <span className="text-xs text-destructive">Failed to save</span>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-2">Message</p>
                <pre className="text-sm text-foreground whitespace-pre-wrap break-words font-sans bg-muted rounded-md p-4 max-h-[32rem] overflow-y-auto">
                  {ticket.bodyText}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
