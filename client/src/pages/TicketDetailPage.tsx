import { useParams, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import type { TicketDetail, TicketStatus, TicketCategory, Reply, CreateReplyInput } from "@helpdesk/core";
import { createReplySchema } from "@helpdesk/core";
import type { ReplySenderType } from "@helpdesk/core";
import { authClient } from "@/lib/auth-client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { AlertCircle, ChevronLeft, MessageSquare } from "lucide-react";

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

async function fetchReplies(ticketId: string): Promise<Reply[]> {
  const { data } = await axios.get<{ replies: Reply[] }>(`/api/tickets/${ticketId}/replies`, {
    withCredentials: true,
  });
  return data.replies;
}

async function patchTicket(
  ticketId: string,
  data: { assignedToId?: string | null; status?: TicketStatus; category?: TicketCategory | null }
): Promise<void> {
  await axios.patch(`/api/tickets/${ticketId}`, data, { withCredentials: true });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ReplyBubble({ reply }: { reply: Reply }) {
  const isAgent = reply.senderType === ("agent" satisfies ReplySenderType);
  return (
    <div className={`flex gap-3 ${isAgent ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold ${isAgent ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground"}`}>
        {getInitials(reply.author.name)}
      </div>
      <div className={`flex-1 min-w-0 max-w-[80%] ${isAgent ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`flex items-baseline gap-2 mb-1 ${isAgent ? "flex-row-reverse" : "flex-row"}`}>
          <span className="text-sm font-medium text-foreground">{reply.author.name}</span>
          <span className="text-xs text-muted-foreground">{formatDate(reply.createdAt)}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isAgent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {isAgent ? "Agent" : "Customer"}
          </span>
        </div>
        <pre className={`text-sm text-foreground whitespace-pre-wrap break-words font-sans rounded-lg px-3 py-2 leading-relaxed ${isAgent ? "bg-primary/10" : "bg-muted"}`}>
          {reply.body}
        </pre>
      </div>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const threadEndRef = useRef<HTMLDivElement>(null);

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

  const { data: replies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ["replies", id],
    queryFn: () => fetchReplies(id!),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setError,
  } = useForm<CreateReplyInput>({
    resolver: zodResolver(createReplySchema),
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

  const replyMutation = useMutation({
    mutationFn: (data: CreateReplyInput) =>
      axios.post(`/api/tickets/${id}/replies`, data, { withCredentials: true }),
    onSuccess: () => {
      reset();
      queryClient.invalidateQueries({ queryKey: ["replies", id] });
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (err) => {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? (err.response.data.error as string)
          : "Failed to send reply.";
      setError("root", { message });
    },
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
                        <p className="text-foreground">{formatDate(ticket.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Updated</p>
                        <p className="text-foreground">{formatDate(ticket.updatedAt)}</p>
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

            {/* Reply thread */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Replies
                  {replies.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">({replies.length})</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {repliesLoading && (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                )}

                {!repliesLoading && replies.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No replies yet.
                  </p>
                )}

                {!repliesLoading && replies.length > 0 && (
                  <div className="space-y-4">
                    {replies.map((reply) => (
                      <ReplyBubble key={reply.id} reply={reply} />
                    ))}
                    <div ref={threadEndRef} />
                  </div>
                )}

                {/* Reply form */}
                <div className="border-t border-border pt-4 mt-4">
                  <form onSubmit={handleSubmit((data) => replyMutation.mutate(data))} className="space-y-3">
                    <Textarea
                      {...register("body")}
                      placeholder="Write a reply…"
                      rows={4}
                      aria-invalid={!!errors.body}
                      className="resize-none"
                    />
                    {errors.body && (
                      <p className="text-xs text-destructive">{errors.body.message}</p>
                    )}
                    {errors.root && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{errors.root.message}</AlertDescription>
                      </Alert>
                    )}
                    <div className="flex justify-end">
                      <Button type="submit" disabled={replyMutation.isPending}>
                        {replyMutation.isPending ? "Sending…" : "Send Reply"}
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
