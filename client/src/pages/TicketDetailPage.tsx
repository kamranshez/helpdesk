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

async function patchTicket(
  ticketId: string,
  data: { assignedToId?: string | null; status?: TicketStatus; category?: TicketCategory | null }
): Promise<void> {
  await axios.patch(`/api/tickets/${ticketId}`, data, { withCredentials: true });
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ticket", id] });

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) => patchTicket(id!, { assignedToId }),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) => patchTicket(id!, { status }),
    onSuccess: invalidate,
  });

  const categoryMutation = useMutation({
    mutationFn: (category: TicketCategory | null) => patchTicket(id!, { category }),
    onSuccess: invalidate,
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
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">From</p>
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
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Created</p>
                      <p className="text-foreground">
                        {new Date(ticket.createdAt).toLocaleString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Updated</p>
                      <p className="text-foreground">
                        {new Date(ticket.updatedAt).toLocaleString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-5">
                    <p className="text-sm font-semibold text-foreground mb-3">Message</p>
                    <pre className="text-sm text-foreground whitespace-pre-wrap break-words font-sans bg-muted rounded-md p-4 max-h-[32rem] overflow-y-auto leading-relaxed">
                      {ticket.bodyText}
                    </pre>
                  </div>
                </div>

                {/* Right — properties sidebar */}
                <div className="border-l border-border pl-8 space-y-5">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Status</p>
                    <Select
                      value={ticket.status}
                      onValueChange={(val) => statusMutation.mutate(val as TicketStatus)}
                      disabled={statusMutation.isPending}
                    >
                      <SelectTrigger className="h-8 w-full text-sm" aria-label="Status">
                        {statusMutation.isPending ? "Saving…" : STATUS_LABELS[ticket.status]}
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(STATUS_LABELS) as [TicketStatus, string][]).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {statusMutation.isError && (
                      <p className="text-xs text-destructive mt-1">Failed to save</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Category</p>
                    <Select
                      value={ticket.category ?? "none"}
                      onValueChange={(val) =>
                        categoryMutation.mutate(val === "none" ? null : (val as TicketCategory))
                      }
                      disabled={categoryMutation.isPending}
                    >
                      <SelectTrigger className="h-8 w-full text-sm" aria-label="Category">
                        {categoryMutation.isPending
                          ? "Saving…"
                          : ticket.category
                            ? CATEGORY_LABELS[ticket.category]
                            : "None"}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {(Object.entries(CATEGORY_LABELS) as [TicketCategory, string][]).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {categoryMutation.isError && (
                      <p className="text-xs text-destructive mt-1">Failed to save</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Assigned to</p>
                    <Select
                      value={ticket.assignedTo?.id ?? "unassigned"}
                      onValueChange={(val) =>
                        assignMutation.mutate(val === "unassigned" ? null : val)
                      }
                      disabled={assignMutation.isPending}
                    >
                      <SelectTrigger className="h-8 w-full text-sm" aria-label="Assigned to">
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
                      <p className="text-xs text-destructive mt-1">Failed to save</p>
                    )}
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
