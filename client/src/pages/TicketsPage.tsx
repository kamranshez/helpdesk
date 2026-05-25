import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";
import type { Ticket, TicketStatus, TicketCategory } from "@helpdesk/core";
import { authClient } from "@/lib/auth-client";
import { fetchTickets } from "@/lib/ticket-api";
import { STATUS_LABELS, CATEGORY_LABELS, statusVariant } from "@/lib/ticket-utils";
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
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const columnHelper = createColumnHelper<Ticket>();

const columns = [
  columnHelper.accessor("subject", {
    header: "Subject",
    cell: (info) => (
      <Link
        to={`/tickets/${info.row.original.id}`}
        className="font-medium text-foreground hover:underline"
      >
        {info.getValue() as string}
      </Link>
    ),
  }),
  columnHelper.accessor("fromEmail", {
    header: "From",
    cell: (info) => {
      const ticket = info.row.original;
      return (
        <span className="text-muted-foreground">
          {ticket.fromName ? (
            <>
              {ticket.fromName} <span className="text-xs">({ticket.fromEmail})</span>
            </>
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
  columnHelper.accessor("assignedTo", {
    header: "Assigned",
    cell: (info) => {
      const agent = info.getValue() as Ticket["assignedTo"];
      return agent ? (
        <span className="text-foreground">{agent.name}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
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

const PAGE_SIZE = 10;

export default function TicketsPage() {
  const { data: session } = authClient.useSession();
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const sortBy = sorting[0]?.id ?? "createdAt";
  const sortOrder = sorting[0]?.desc ? "desc" : "asc";

  function handleSortingChange(updater: Parameters<typeof setSorting>[0]) {
    setSorting(updater);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }
  function handleStatusFilter(v: string | null) {
    setStatusFilter(v ?? "all");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }
  function handleCategoryFilter(v: string | null) {
    setCategoryFilter(v ?? "all");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets", sortBy, sortOrder, statusFilter, categoryFilter, search, pagination.pageIndex],
    queryFn: () =>
      fetchTickets(sortBy, sortOrder, statusFilter, categoryFilter, search, pagination.pageIndex + 1, PAGE_SIZE),
  });

  const tickets = data?.tickets ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const table = useReactTable({
    data: tickets,
    columns,
    state: { sorting, pagination },
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    rowCount: total,
    enableMultiSort: false,
  });

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={session?.user.name ?? ""} />
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-normal text-foreground" style={{ fontFamily: "var(--font-heading)" }}>Tickets</h1>
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
            <Select value={statusFilter} onValueChange={handleStatusFilter}>
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

            <Select value={categoryFilter} onValueChange={handleCategoryFilter}>
              <SelectTrigger className="w-40" aria-label="Filter by category">
                {categoryFilter === "all"
                  ? "All Categories"
                  : CATEGORY_LABELS[categoryFilter as TicketCategory]}
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
                    {["Subject", "From", "Category", "Status", "Assigned", "Received"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-6 py-3 text-muted-foreground font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-6 py-4">
                        <Skeleton className="h-4 w-48" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-4 w-36" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-5 w-14 rounded-full" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
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
                {total} {total === 1 ? "ticket" : "tickets"}
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

            {pageCount > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.pageIndex + 1} of {pageCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => table.setPageIndex(0)}
                    disabled={pagination.pageIndex === 0}
                    aria-label="First page"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                    First
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={pagination.pageIndex === 0}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={pagination.pageIndex >= pageCount - 1}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => table.setPageIndex(pageCount - 1)}
                    disabled={pagination.pageIndex >= pageCount - 1}
                    aria-label="Last page"
                  >
                    Last
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
