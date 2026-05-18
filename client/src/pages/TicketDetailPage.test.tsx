import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import TicketDetailPage from "./TicketDetailPage";

// --- module mocks -----------------------------------------------------------

vi.mock("axios");
vi.mock("react-router", () => ({
  useParams: () => ({ id: "ticket-1" }),
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
const mockedPatch = vi.spyOn(axios, "patch");

const TICKET_UNASSIGNED = {
  id: "ticket-1",
  subject: "My order is missing",
  bodyText: "Hi, I placed order #123 and it has not arrived.",
  bodyHtml: null,
  fromEmail: "alice@example.com",
  fromName: "Alice",
  toEmail: null,
  status: "open" as const,
  category: "general_question" as const,
  createdAt: "2024-03-15T10:00:00Z",
  updatedAt: "2024-03-15T10:00:00Z",
  assignedTo: null,
};

const TICKET_ASSIGNED = {
  ...TICKET_UNASSIGNED,
  assignedTo: { id: "agent-1", name: "Bob Smith", email: "bob@example.com" },
};

const AGENTS = [
  { id: "agent-1", name: "Bob Smith", email: "bob@example.com" },
  { id: "agent-2", name: "Carol Jones", email: "carol@example.com" },
];

function mockGetSuccess(ticket: typeof TICKET_UNASSIGNED | typeof TICKET_ASSIGNED = TICKET_UNASSIGNED, agents = AGENTS) {
  mockedGet.mockImplementation((url: unknown) => {
    if (url === "/api/tickets/ticket-1") return Promise.resolve({ data: { ticket } });
    if (url === "/api/users/agents") return Promise.resolve({ data: { agents } });
    if (url === "/api/tickets/ticket-1/replies") return Promise.resolve({ data: { replies: [] } });
    return Promise.reject(new Error(`Unexpected GET: ${url}`));
  });
}

function renderPage() {
  return renderWithProviders(<TicketDetailPage />);
}

// --- tests ------------------------------------------------------------------

describe("TicketDetailPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // --- loading ----------------------------------------------------------------

  it("shows skeleton while ticket is loading", () => {
    mockedGet.mockReturnValue(new Promise(() => {}));
    renderPage();
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // --- ticket data rendering --------------------------------------------------

  it("renders subject, sender, status badge, category badge and body", async () => {
    mockGetSuccess();
    renderPage();

    expect(await screen.findByText("My order is missing")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
    expect(screen.getAllByText("General").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Hi, I placed order #123 and it has not arrived.")
    ).toBeInTheDocument();
  });

  it("renders a back link to /tickets", async () => {
    mockGetSuccess();
    renderPage();

    await screen.findByText("My order is missing");
    expect(screen.getByRole("link", { name: /back to tickets/i })).toHaveAttribute(
      "href",
      "/tickets"
    );
  });

  it("formats the received date in human-readable form", async () => {
    mockGetSuccess();
    renderPage();

    await screen.findByText("My order is missing");
    expect(screen.getAllByText(/Mar 15, 2024/).length).toBeGreaterThan(0);
  });

  // --- assigned-to display ----------------------------------------------------

  it("shows Unassigned when ticket has no agent", async () => {
    mockGetSuccess(TICKET_UNASSIGNED);
    renderPage();

    await screen.findByText("My order is missing");
    expect(screen.getByRole("combobox", { name: /assigned to/i })).toHaveTextContent("Unassigned");
  });

  it("shows the assigned agent name in the dropdown trigger", async () => {
    mockGetSuccess(TICKET_ASSIGNED);
    renderPage();

    await screen.findByText("My order is missing");
    expect(screen.getByRole("combobox", { name: /assigned to/i })).toHaveTextContent("Bob Smith");
  });

  // --- agents dropdown --------------------------------------------------------

  it("lists all agents in the dropdown", async () => {
    const user = userEvent.setup();
    mockGetSuccess();
    renderPage();

    await screen.findByText("My order is missing");

    await user.click(screen.getByRole("combobox", { name: /assigned to/i }));

    expect(await screen.findByRole("option", { name: "Bob Smith" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Carol Jones" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Unassigned" })).toBeInTheDocument();
  });

  // --- assignment mutation ----------------------------------------------------

  it("calls PATCH with the agent id when an agent is selected", async () => {
    const user = userEvent.setup();
    mockGetSuccess();
    mockedPatch.mockResolvedValue({ data: { ticket: TICKET_ASSIGNED } });
    renderPage();

    await screen.findByText("My order is missing");

    await user.click(screen.getByRole("combobox", { name: /assigned to/i }));
    await user.click(await screen.findByRole("option", { name: "Bob Smith" }));

    await waitFor(() => {
      expect(mockedPatch).toHaveBeenCalledWith(
        "/api/tickets/ticket-1",
        { assignedToId: "agent-1" },
        { withCredentials: true }
      );
    });
  });

  it("calls PATCH with null when Unassigned is selected", async () => {
    const user = userEvent.setup();
    mockGetSuccess(TICKET_ASSIGNED);
    mockedPatch.mockResolvedValue({ data: { ticket: TICKET_UNASSIGNED } });
    renderPage();

    await screen.findByText("My order is missing");

    await user.click(screen.getByRole("combobox", { name: /assigned to/i }));
    await user.click(await screen.findByRole("option", { name: "Unassigned" }));

    await waitFor(() => {
      expect(mockedPatch).toHaveBeenCalledWith(
        "/api/tickets/ticket-1",
        { assignedToId: null },
        { withCredentials: true }
      );
    });
  });

  it("refetches the ticket after a successful assignment", async () => {
    const user = userEvent.setup();
    mockGetSuccess();
    mockedPatch.mockResolvedValue({ data: { ticket: TICKET_ASSIGNED } });
    renderPage();

    await screen.findByText("My order is missing");
    const initialGetCount = mockedGet.mock.calls.length;

    await user.click(screen.getByRole("combobox", { name: /assigned to/i }));
    await user.click(await screen.findByRole("option", { name: "Bob Smith" }));

    await waitFor(() => {
      expect(mockedGet.mock.calls.length).toBeGreaterThan(initialGetCount);
    });
  });

  it("shows Failed to save inline when the PATCH request errors", async () => {
    const user = userEvent.setup();
    mockGetSuccess();
    mockedPatch.mockRejectedValue(new Error("Server error"));
    renderPage();

    await screen.findByText("My order is missing");

    await user.click(screen.getByRole("combobox", { name: /assigned to/i }));
    await user.click(await screen.findByRole("option", { name: "Bob Smith" }));

    expect(await screen.findByText("Failed to save")).toBeInTheDocument();
  });

  it("disables the dropdown while the mutation is in flight", async () => {
    const user = userEvent.setup();
    mockGetSuccess();
    mockedPatch.mockReturnValue(new Promise(() => {}));
    renderPage();

    await screen.findByText("My order is missing");

    await user.click(screen.getByRole("combobox", { name: /assigned to/i }));
    await user.click(await screen.findByRole("option", { name: "Bob Smith" }));

    expect(screen.getByRole("combobox", { name: /assigned to/i })).toBeDisabled();
  });

  // --- error states -----------------------------------------------------------

  it("shows a destructive alert when ticket fetch fails", async () => {
    mockedGet.mockRejectedValue(new Error("Network error"));
    renderPage();

    expect(
      await screen.findByText("Failed to load ticket. Please try again.")
    ).toBeInTheDocument();
  });

  it("shows Ticket not found for a 404 response", async () => {
    const err = Object.assign(new Error("Not found"), {
      isAxiosError: true,
      response: { status: 404 },
    });
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockedGet.mockRejectedValue(err);
    renderPage();

    expect(await screen.findByText("Ticket not found.")).toBeInTheDocument();
  });

  // --- API calls --------------------------------------------------------------

  it("fetches ticket and agents with withCredentials", async () => {
    mockGetSuccess();
    renderPage();

    await screen.findByText("My order is missing");

    expect(mockedGet).toHaveBeenCalledWith("/api/tickets/ticket-1", {
      withCredentials: true,
    });
    expect(mockedGet).toHaveBeenCalledWith("/api/users/agents", {
      withCredentials: true,
    });
  });
});
