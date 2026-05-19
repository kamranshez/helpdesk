import axios from "axios";
import type { Ticket, TicketDetail, TicketStatus, TicketCategory, Reply, CreateReplyInput } from "@helpdesk/core";

export type Agent = { id: string; name: string; email: string };
export type TicketsResponse = { tickets: Ticket[]; total: number; page: number; limit: number };

const OPTS = { withCredentials: true } as const;

export async function fetchTickets(
  sortBy: string,
  sortOrder: string,
  status: string,
  category: string,
  search: string,
  page: number,
  limit: number,
): Promise<TicketsResponse> {
  const { data } = await axios.get<TicketsResponse>("/api/tickets", {
    params: {
      sortBy,
      sortOrder,
      page,
      limit,
      ...(status !== "all" && { status }),
      ...(category !== "all" && { category }),
      ...(search && { search }),
    },
    ...OPTS,
  });
  return data;
}

export async function fetchTicket(id: string): Promise<TicketDetail> {
  const { data } = await axios.get<{ ticket: TicketDetail }>(`/api/tickets/${id}`, OPTS);
  return data.ticket;
}

export async function patchTicket(
  id: string,
  payload: { assignedToId?: string | null; status?: TicketStatus; category?: TicketCategory | null },
): Promise<void> {
  await axios.patch(`/api/tickets/${id}`, payload, OPTS);
}

export async function fetchAgents(): Promise<Agent[]> {
  const { data } = await axios.get<{ agents: Agent[] }>("/api/users/agents", OPTS);
  return data.agents;
}

export async function fetchReplies(ticketId: string): Promise<Reply[]> {
  const { data } = await axios.get<{ replies: Reply[] }>(`/api/tickets/${ticketId}/replies`, OPTS);
  return data.replies;
}

export async function postReply(ticketId: string, body: CreateReplyInput): Promise<Reply> {
  const { data } = await axios.post<{ reply: Reply }>(`/api/tickets/${ticketId}/replies`, body, OPTS);
  return data.reply;
}

export async function summarizeTicket(ticketId: string): Promise<string> {
  const { data } = await axios.post<{ summary: string }>(`/api/tickets/${ticketId}/summarize`, {}, OPTS);
  return data.summary;
}
