import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import TicketsPage from "./TicketsPage";

// --- module mocks -----------------------------------------------------------

vi.mock("axios");
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: "Agent User", role: "agent" } } }),
    signOut: vi.fn(),
  },
}));

// --- helpers ----------------------------------------------------------------

import axios from "axios";
const mockedGet = vi.spyOn(axios, "get");

function renderPage() {
  return renderWithProviders(<TicketsPage />);
}

const TICKETS = [
  {
    id: "1",
    subject: "My order is missing",
    fromEmail: "alice@example.com",
    fromName: "Alice",
    status: "open" as const,
    category: "general_question" as const,
    createdAt: "2024-03-15T10:00:00Z",
  },
  {
    id: "2",
    subject: "API returning 500 errors",
    fromEmail: "bob@example.com",
    fromName: null,
    status: "resolved" as const,
    category: "technical_question" as const,
    createdAt: "2024-03-10T08:30:00Z",
  },
  {
    id: "3",
    subject: "Request a refund",
    fromEmail: "carol@example.com",
    fromName: null,
    status: "closed" as const,
    category: null,
    createdAt: "2024-02-28T14:00:00Z",
  },
];

// --- tests ------------------------------------------------------------------

describe("TicketsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("shows loading skeleton rows while fetching", () => {
    mockedGet.mockReturnValue(new Promise(() => {}));

    renderPage();

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.getByText("Subject")).toBeInTheDocument();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders ticket count as plural when there are multiple tickets", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: TICKETS } });

    renderPage();

    expect(await screen.findByText("3 tickets")).toBeInTheDocument();
  });

  it("renders ticket count as singular when there is exactly one ticket", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [TICKETS[0]] } });

    renderPage();

    expect(await screen.findByText("1 ticket")).toBeInTheDocument();
  });

  it("renders subject and from email for each ticket", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: TICKETS } });

    renderPage();

    expect(await screen.findByText("My order is missing")).toBeInTheDocument();
    expect(screen.getByText("API returning 500 errors")).toBeInTheDocument();
    expect(screen.getByText("Request a refund")).toBeInTheDocument();
    // alice has fromName so her email appears as "(alice@example.com)" — use regex
    expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
    // bob and carol have no fromName — email shown as plain text
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("carol@example.com")).toBeInTheDocument();
  });

  it("shows fromName alongside email when the ticket has one", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [TICKETS[0]] } });

    renderPage();

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    // Email is rendered as "(alice@example.com)" inside a nested span
    expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
  });

  it("renders status badges — Open, Resolved, Closed", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: TICKETS } });

    renderPage();

    expect(await screen.findByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("renders category badges with human-readable labels", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: TICKETS } });

    renderPage();

    expect(await screen.findByText("General")).toBeInTheDocument();
    expect(screen.getByText("Technical")).toBeInTheDocument();
  });

  it("shows a dash when category is null", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [TICKETS[2]] } });

    renderPage();

    expect(await screen.findByText("—")).toBeInTheDocument();
  });

  it("formats the received date in human-readable form", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [TICKETS[0]] } });

    renderPage();

    expect(await screen.findByText("Mar 15, 2024")).toBeInTheDocument();
  });

  it("shows empty state message when no tickets match filters", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [] } });

    renderPage();

    expect(await screen.findByText("0 tickets")).toBeInTheDocument();
    expect(
      screen.getByText("No tickets match the selected filters.")
    ).toBeInTheDocument();
  });

  it("shows a destructive alert on API error", async () => {
    mockedGet.mockRejectedValue(new Error("Network error"));

    renderPage();

    expect(await screen.findByText("Network error")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ tickets?/)).not.toBeInTheDocument();
  });

  it("calls GET /api/tickets with default params (createdAt desc, no filters)", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [] } });

    renderPage();

    await screen.findByText("0 tickets");

    expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
      params: { sortBy: "createdAt", sortOrder: "desc" },
      withCredentials: true,
    });
  });

  it("renders the search input", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [] } });

    renderPage();

    await screen.findByText("0 tickets");

    expect(screen.getByRole("textbox", { name: /search tickets/i })).toBeInTheDocument();
  });

  it("re-fetches with search param after debounce when user types in the search box", async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ data: { tickets: TICKETS } });

    renderPage();

    await screen.findByText("3 tickets");

    await user.type(screen.getByRole("textbox", { name: /search tickets/i }), "order");

    // Wait long enough for the 300 ms debounce to fire
    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
        params: { sortBy: "createdAt", sortOrder: "desc", search: "order" },
        withCredentials: true,
      });
    }, { timeout: 1000 });
  });

  it("re-fetches with new sort params when a column header is clicked", async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ data: { tickets: TICKETS } });

    renderPage();

    await screen.findByText("3 tickets");

    // Click the Subject header to sort ascending
    await user.click(screen.getByRole("button", { name: /sort by subject/i }));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
        params: { sortBy: "subject", sortOrder: "asc" },
        withCredentials: true,
      });
    });
  });

  it("renders Status and Category filter dropdowns", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [] } });

    renderPage();

    await screen.findByText("0 tickets");

    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by category")).toBeInTheDocument();
  });

  it("re-fetches with status param when status filter is changed", async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ data: { tickets: TICKETS } });

    renderPage();

    await screen.findByText("3 tickets");

    await user.click(screen.getByLabelText("Filter by status"));
    await user.click(screen.getByRole("option", { name: "Open" }));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
        params: { sortBy: "createdAt", sortOrder: "desc", status: "open" },
        withCredentials: true,
      });
    });
  });

  it("re-fetches with category param when category filter is changed", async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ data: { tickets: TICKETS } });

    renderPage();

    await screen.findByText("3 tickets");

    await user.click(screen.getByLabelText("Filter by category"));
    await user.click(screen.getByRole("option", { name: "Technical" }));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
        params: { sortBy: "createdAt", sortOrder: "desc", category: "technical_question" },
        withCredentials: true,
      });
    });
  });

  it("renders the Tickets nav link in the navbar", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [] } });

    renderPage();

    await screen.findByText("0 tickets");

    expect(screen.getByRole("link", { name: /tickets/i })).toBeInTheDocument();
  });
});
