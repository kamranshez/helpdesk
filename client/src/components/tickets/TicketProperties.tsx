import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TicketDetail, TicketStatus, TicketCategory } from "@helpdesk/core";
import { patchTicket } from "@/lib/ticket-api";
import type { Agent } from "@/lib/ticket-api";
import { STATUS_LABELS, CATEGORY_LABELS } from "@/lib/ticket-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type Props = {
  ticket: TicketDetail;
  agents: Agent[];
  ticketId: string;
};

export default function TicketProperties({ ticket, agents, ticketId }: Props) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) => patchTicket(ticketId, { status }),
    onSuccess: invalidate,
  });

  const categoryMutation = useMutation({
    mutationFn: (category: TicketCategory | null) => patchTicket(ticketId, { category }),
    onSuccess: invalidate,
  });

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) => patchTicket(ticketId, { assignedToId }),
    onSuccess: invalidate,
  });

  return (
    <div className="border-l border-border pl-8 space-y-5">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
          Status
        </p>
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
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {statusMutation.isError && (
          <p className="text-xs text-destructive mt-1">Failed to save</p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
          Category
        </p>
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
            {(Object.entries(CATEGORY_LABELS) as [TicketCategory, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        {categoryMutation.isError && (
          <p className="text-xs text-destructive mt-1">Failed to save</p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
          Assigned to
        </p>
        <Select
          value={ticket.assignedTo?.id ?? "unassigned"}
          onValueChange={(val) => assignMutation.mutate(val === "unassigned" ? null : val)}
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
  );
}
