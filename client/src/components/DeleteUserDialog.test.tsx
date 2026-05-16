import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { renderWithProviders } from "@/test/render";
import DeleteUserDialog from "./DeleteUserDialog";

// --- module mocks -----------------------------------------------------------

vi.mock("axios");
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// --- helpers ----------------------------------------------------------------

const mockedDelete = vi.spyOn(axios, "delete");
const onOpenChange = vi.fn();

const BOB = { id: "user-2", name: "Bob Jones" };

function renderDialog(user = BOB) {
  return renderWithProviders(
    <DeleteUserDialog user={user} open={true} onOpenChange={onOpenChange} />
  );
}

// --- tests ------------------------------------------------------------------

describe("DeleteUserDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- rendering ---

  it("shows the user name in the confirmation message", () => {
    renderDialog();

    expect(screen.getByText(/Bob Jones/)).toBeInTheDocument();
  });

  it("renders Delete and Cancel buttons", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    renderWithProviders(
      <DeleteUserDialog user={BOB} open={false} onOpenChange={onOpenChange} />
    );

    expect(screen.queryByText("Delete User")).not.toBeInTheDocument();
  });

  // --- submission ---

  it("calls DELETE /api/users/:id on confirm", async () => {
    mockedDelete.mockResolvedValue({});
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledWith(`/api/users/${BOB.id}`, {
        withCredentials: true,
      });
    });
  });

  it("shows Deleting… and disables button while pending", async () => {
    mockedDelete.mockReturnValue(new Promise(() => {}));
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /deleting/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toBeDisabled();
    });
  });

  it("calls onOpenChange(false) on successful delete", async () => {
    mockedDelete.mockResolvedValue({});
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // --- errors ---

  it("shows server error message on failure", async () => {
    mockedDelete.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Admin users cannot be deleted." } },
    });
    vi.spyOn(axios, "isAxiosError").mockReturnValue(true);
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(await screen.findByText("Admin users cannot be deleted.")).toBeInTheDocument();
  });

  it("shows generic error message on unexpected failure", async () => {
    mockedDelete.mockRejectedValue(new Error("Network error"));
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(
      await screen.findByText("Something went wrong. Please try again.")
    ).toBeInTheDocument();
  });

  // --- cancel ---

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
