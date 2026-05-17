import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import type { Ticket, TicketStatus, TicketCategory } from "@helpdesk/core";
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
import { Input } from "@/components/ui/input";
import { AlertCircle, ArrowUp, ArrowDown, ArrowUpDown, Search } from "lucide-react";

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

async function fetchTickets(
  sortBy: string,
  sortOrder: string,
  status: string,
  category: string,
  search: string,
): Promise<Ticket[]> {
  const { data } = await axios.get<{ tickets: Ticket[] }>("/api/tickets", {
    params: {
      sortBy,
      sortOrder,
      ...(status !== "all" && { status }),
      ...(category !== "all" && { category }),
      ...(search && { search }),
    },
    withCredentials: true,
  });
  return data.tickets;
}

const columnHelper = createColumnHelper<Ticket>();

const columns = [
  columnHelper.accessor("subject", {
    header: "Subject",
    cell: (info) => (
      <span className="font-medium text-foreground">{info.getValue() as string}</span>
    ),
  }),
  columnHelper.accessor("fromEmail", {
    header: "From",
    cell: (info) => {
      const ticket = info.row.original;
      return (
        <span className="text-muted-foreground">
          {ticket.fromName ? (
            <>{ticket.fromName} <span className="text-xs">({ticket.fromEmail})</span></>
          ) : (
            ticket.fromEmail
          )}
        </span>
      );
    },
  }),
  columnHelper.accessor("category", {
    header: "Category",
    cell: (info) => {
      const category = info.getValue() as TicketCategory | null;
      return category ? (
        <Badge variant="secondary">{CATEGORY_LABELS[category]}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const status = info.getValue() as TicketStatus;
      return <Badge variant={statusVariant(status)}>{STATUS_LABELS[status]}</Badge>;
    },
  }),
  columnHelper.accessor("createdAt", {
    header: "Received",
    cell: (info) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {new Date(info.getValue() as string).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </span>
    ),
  }),
];

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="h-3.5 w-3.5 ml-1 shrink-0" />;
  if (sorted === "desc") return <ArrowDown className="h-3.5 w-3.5 ml-1 shrink-0" />;
  return <ArrowUpDown className="h-3.5 w-3.5 ml-1 shrink-0 opacity-40" />;
}

export default function TicketsPage() {
  const { data: session } = authClient.useSession();
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce the search input by 300 ms before sending to the server
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const sortBy = sorting[0]?.id ?? "createdAt";
  const sortOrder = sorting[0]?.desc ? "desc" : "asc";

  const { data: tickets = [], isLoading, error } = useQuery({
    queryKey: ["tickets", sortBy, sortOrder, statusFilter, categoryFilter, search],
    queryFn: () => fetchTickets(sortBy, sortOrder, statusFilter, categoryFilter, search),
  });

  const table = useReactTable({
    data: tickets,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
  });

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={session?.user.name ?? ""} />
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 w-56"
                placeholder="Search tickets…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Search tickets"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
              <SelectTrigger className="w-36" aria-label="Filter by status">
                {statusFilter === "all" ? "All Statuses" : STATUS_LABELS[statusFilter as TicketStatus]}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
              <SelectTrigger className="w-40" aria-label="Filter by category">
                {categoryFilter === "all" ? "All Categories" : CATEGORY_LABELS[categoryFilter as TicketCategory]}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="general_question">General</SelectItem>
                <SelectItem value="technical_question">Technical</SelectItem>
                <SelectItem value="refund_request">Refund</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                    {["Subject", "From", "Category", "Status", "Received"].map((h) => (
                      <th key={h} className="text-left px-6 py-3 text-muted-foreground font-medium">{h}</th>
                    ))}
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
                  No tickets match the selected filters.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b border-border">
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="text-left px-6 py-3 text-muted-foreground font-medium"
                          >
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="flex items-center hover:text-foreground transition-colors"
                              aria-label={`Sort by ${header.column.id}`}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <SortIcon sorted={header.column.getIsSorted()} />
                            </button>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-6 py-4">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
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
