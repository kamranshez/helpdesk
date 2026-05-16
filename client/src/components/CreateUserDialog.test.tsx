import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { renderWithProviders } from "@/test/render";
import CreateUserDialog from "./CreateUserDialog";

// --- module mocks -----------------------------------------------------------

vi.mock("axios");
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// --- helpers ----------------------------------------------------------------

const mockedPost = vi.spyOn(axios, "post");

const onOpenChange = vi.fn();

function renderDialog(open = true) {
  return renderWithProviders(
    <CreateUserDialog open={open} onOpenChange={onOpenChange} />
  );
}

async function fillForm({
  name = "Jane Smith",
  email = "jane@example.com",
  password = "password123",
}: { name?: string; email?: string; password?: string } = {}) {
  const user = userEvent.setup();
  if (name)     await user.type(screen.getByLabelText("Name"), name);
  if (email)    await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  return user;
}

// --- tests ------------------------------------------------------------------

describe("CreateUserDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- rendering ---

  it("renders all form fields and action buttons", () => {
    renderDialog();

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create user/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    renderDialog(false);

    expect(screen.queryByText("Create New User")).not.toBeInTheDocument();
  });

  // --- validation ---

  it("shows name error when name is too short", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Name"), "Jo");
    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByText("Name must be at least 3 characters")).toBeInTheDocument();
  });

  it("shows email error when email is invalid", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Name"), "Jane Smith");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByText("A valid email is required")).toBeInTheDocument();
  });

  it("shows password error when password is too short", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Name"), "Jane Smith");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("marks invalid fields with aria-invalid", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /create user/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("does not submit when validation fails", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /create user/i }));

    await screen.findByText("Name must be at least 3 characters");
    expect(mockedPost).not.toHaveBeenCalled();
  });

  // --- submission ---

  it("calls POST /api/users with correct payload on valid submit", async () => {
    mockedPost.mockResolvedValue({ data: { user: {} } });
    renderDialog();

    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: /create user/i }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        "/api/users",
        { name: "Jane Smith", email: "jane@example.com", password: "password123" },
        { withCredentials: true }
      );
    });
  });

  it("shows Creating… and disables the button while submitting", async () => {
    mockedPost.mockReturnValue(new Promise(() => {}));
    renderDialog();

    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: /create user/i }));

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /creating/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toBeDisabled();
    });
  });

  it("calls onOpenChange(false) on successful submission", async () => {
    mockedPost.mockResolvedValue({ data: { user: {} } });
    renderDialog();

    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: /create user/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // --- API errors ---

  it("shows server error message when the API returns an error", async () => {
    mockedPost.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "A user with that email already exists." } },
    });
    vi.spyOn(axios, "isAxiosError").mockReturnValue(true);
    renderDialog();

    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByText("A user with that email already exists.")).toBeInTheDocument();
  });

  it("shows a generic error message on unexpected failure", async () => {
    mockedPost.mockRejectedValue(new Error("Network error"));
    renderDialog();

    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });

  // --- cancel ---

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
