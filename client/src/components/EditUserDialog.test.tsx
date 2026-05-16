import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { renderWithProviders } from "@/test/render";
import EditUserDialog from "./EditUserDialog";

// --- module mocks -----------------------------------------------------------

vi.mock("axios");
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// --- helpers ----------------------------------------------------------------

const mockedPatch = vi.spyOn(axios, "patch");
const onOpenChange = vi.fn();

const ALICE = { id: "user-1", name: "Alice Smith", email: "alice@example.com" };

function renderDialog(user = ALICE) {
  return renderWithProviders(
    <EditUserDialog user={user} open={true} onOpenChange={onOpenChange} />
  );
}

// --- tests ------------------------------------------------------------------

describe("EditUserDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- rendering ---

  it("pre-populates name and email from the user prop", () => {
    renderDialog();

    expect(screen.getByLabelText("Name")).toHaveValue("Alice Smith");
    expect(screen.getByLabelText("Email")).toHaveValue("alice@example.com");
  });

  it("password field is empty by default", () => {
    renderDialog();

    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("renders Save Changes and Cancel buttons", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    renderWithProviders(
      <EditUserDialog user={ALICE} open={false} onOpenChange={onOpenChange} />
    );

    expect(screen.queryByText("Edit User")).not.toBeInTheDocument();
  });

  // --- validation ---

  it("shows name error when name is too short", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Jo");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Name must be at least 3 characters")).toBeInTheDocument();
  });

  it("shows email error when email is invalid", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("A valid email is required")).toBeInTheDocument();
  });

  it("shows password error when password is typed but too short", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("does not show password error when password is left blank", async () => {
    mockedPatch.mockResolvedValue({ data: { user: {} } });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockedPatch).toHaveBeenCalled());
    expect(screen.queryByText("Password must be at least 8 characters")).not.toBeInTheDocument();
  });

  it("marks invalid fields with aria-invalid on submit", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    });
  });

  // --- submission ---

  it("calls PATCH /api/users/:id without password when password is blank", async () => {
    mockedPatch.mockResolvedValue({ data: { user: {} } });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockedPatch).toHaveBeenCalledWith(
        `/api/users/${ALICE.id}`,
        { name: ALICE.name, email: ALICE.email },
        { withCredentials: true }
      );
    });
  });

  it("calls PATCH /api/users/:id with password when password is provided", async () => {
    mockedPatch.mockResolvedValue({ data: { user: {} } });
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Password"), "newpassword1");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockedPatch).toHaveBeenCalledWith(
        `/api/users/${ALICE.id}`,
        { name: ALICE.name, email: ALICE.email, password: "newpassword1" },
        { withCredentials: true }
      );
    });
  });

  it("shows Saving… and disables button while submitting", async () => {
    mockedPatch.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /saving/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toBeDisabled();
    });
  });

  it("calls onOpenChange(false) on successful save", async () => {
    mockedPatch.mockResolvedValue({ data: { user: {} } });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // --- API errors ---

  it("shows server error message from API response", async () => {
    mockedPatch.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "A user with that email already exists." } },
    });
    vi.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("A user with that email already exists.")).toBeInTheDocument();
  });

  it("shows generic error message on unexpected failure", async () => {
    mockedPatch.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });

  // --- cancel ---

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
