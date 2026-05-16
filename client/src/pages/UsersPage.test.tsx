import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import UsersPage from "./UsersPage";

// --- module mocks --------------------------------------------------------

vi.mock("axios");
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: "Admin User", role: "admin" } } }),
    signOut: vi.fn(),
  },
}));

// --- helpers -------------------------------------------------------------

import axios from "axios";
const mockedGet = vi.spyOn(axios, "get");

function renderPage() {
  return renderWithProviders(<UsersPage />);
}

const USERS = [
  { id: "1", name: "Alice Smith", email: "alice@example.com", role: "admin" as const, createdAt: "2024-01-15T00:00:00Z" },
  { id: "2", name: "Bob Jones",  email: "bob@example.com",   role: "agent" as const, createdAt: "2024-03-22T00:00:00Z" },
];

// --- tests ---------------------------------------------------------------

describe("UsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton rows while fetching", () => {
    // Never resolve so we stay in loading state
    mockedGet.mockReturnValue(new Promise(() => {}));

    renderPage();

    // 5 skeleton rows × 4 cells plus 1 header skeleton = 21 total
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    // Table headers should still be visible
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Joined")).toBeInTheDocument();
  });

  it("renders the user count summary", async () => {
    mockedGet.mockResolvedValue({ data: { users: USERS } });

    renderPage();

    expect(await screen.findByText("2 users")).toBeInTheDocument();
  });

  it("renders a row for each user with name, email, and role badge", async () => {
    mockedGet.mockResolvedValue({ data: { users: USERS } });

    renderPage();

    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();

    const badges = screen.getAllByText(/admin|agent/);
    expect(badges).toHaveLength(2);
  });

  it("formats the joined date in human-readable form", async () => {
    mockedGet.mockResolvedValue({ data: { users: USERS } });

    renderPage();

    // Jan 15, 2024
    expect(await screen.findByText("Jan 15, 2024")).toBeInTheDocument();
    // Mar 22, 2024
    expect(screen.getByText("Mar 22, 2024")).toBeInTheDocument();
  });

  it("shows singular 'user' when there is exactly one user", async () => {
    mockedGet.mockResolvedValue({ data: { users: [USERS[0]] } });

    renderPage();

    expect(await screen.findByText("1 user")).toBeInTheDocument();
  });

  it("shows an empty table (0 users) without crashing", async () => {
    mockedGet.mockResolvedValue({ data: { users: [] } });

    renderPage();

    expect(await screen.findByText("0 users")).toBeInTheDocument();
    // No data rows — only header row columns remain
    expect(screen.queryByRole("cell")).not.toBeInTheDocument();
  });

  it("shows a destructive alert on API error", async () => {
    mockedGet.mockRejectedValue(new Error("Network error"));

    renderPage();

    expect(await screen.findByText("Network error")).toBeInTheDocument();
    // The user count summary should not appear when there is an error
    expect(screen.queryByText(/\d+ users?/)).not.toBeInTheDocument();
  });

  it("calls GET /api/users with credentials", async () => {
    mockedGet.mockResolvedValue({ data: { users: [] } });

    renderPage();

    await screen.findByText("0 users");

    expect(mockedGet).toHaveBeenCalledWith("/api/users", { withCredentials: true });
  });
});
