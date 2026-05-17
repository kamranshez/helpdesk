import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
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

  it("shows empty state message when there are no tickets", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [] } });

    renderPage();

    expect(await screen.findByText("0 tickets")).toBeInTheDocument();
    expect(
      screen.getByText("No tickets yet. They will appear here once received via email.")
    ).toBeInTheDocument();
  });

  it("shows a destructive alert on API error", async () => {
    mockedGet.mockRejectedValue(new Error("Network error"));

    renderPage();

    expect(await screen.findByText("Network error")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ tickets?/)).not.toBeInTheDocument();
  });

  it("calls GET /api/tickets with credentials", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [] } });

    renderPage();

    await screen.findByText("0 tickets");

    expect(mockedGet).toHaveBeenCalledWith("/api/tickets", { withCredentials: true });
  });

  it("renders the Tickets nav link in the navbar", async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [] } });

    renderPage();

    await screen.findByText("0 tickets");

    expect(screen.getByRole("link", { name: /tickets/i })).toBeInTheDocument();
  });
});
