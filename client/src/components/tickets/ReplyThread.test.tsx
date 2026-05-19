import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import ReplyThread from "./ReplyThread";

// --- module mocks -----------------------------------------------------------

vi.mock("axios");

// --- helpers ----------------------------------------------------------------

import axios from "axios";
const mockedGet = vi.spyOn(axios, "get");
const mockedPost = vi.spyOn(axios, "post");

const TICKET_ID = "ticket-42";

const AGENT_REPLY = {
  id: "reply-1",
  ticketId: TICKET_ID,
  authorId: "user-1",
  author: { id: "user-1", name: "Bob Smith", email: "bob@example.com" },
  senderType: "agent" as const,
  body: "We are looking into this.",
  createdAt: "2024-03-15T11:00:00Z",
};

const CUSTOMER_REPLY = {
  id: "reply-2",
  ticketId: TICKET_ID,
  authorId: "user-2",
  author: { id: "user-2", name: "Alice Customer", email: "alice@example.com" },
  senderType: "customer" as const,
  body: "Thank you for the update.",
  createdAt: "2024-03-15T12:00:00Z",
};

function mockReplies(replies: typeof AGENT_REPLY[] = []) {
  mockedGet.mockResolvedValue({ data: { replies } });
}

function renderThread(ticketId = TICKET_ID) {
  return renderWithProviders(<ReplyThread ticketId={ticketId} />);
}

// --- tests ------------------------------------------------------------------

describe("ReplyThread", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // --- loading ----------------------------------------------------------------

  it("shows skeleton rows while replies are loading", () => {
    mockedGet.mockReturnValue(new Promise(() => {}));
    renderThread();
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // --- empty state ------------------------------------------------------------

  it("shows empty state message when there are no replies", async () => {
    mockReplies([]);
    renderThread();
    expect(await screen.findByText("No replies yet.")).toBeInTheDocument();
  });

  it("does not show a reply count when there are no replies", async () => {
    mockReplies([]);
    renderThread();
    await screen.findByText("No replies yet.");
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
  });

  // --- reply rendering --------------------------------------------------------

  it("renders each reply body and author name", async () => {
    mockReplies([AGENT_REPLY, CUSTOMER_REPLY]);
    renderThread();

    expect(await screen.findByText("We are looking into this.")).toBeInTheDocument();
    expect(screen.getByText("Thank you for the update.")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.getByText("Alice Customer")).toBeInTheDocument();
  });

  it("shows Agent badge for agent replies and Customer badge for customer replies", async () => {
    mockReplies([AGENT_REPLY, CUSTOMER_REPLY]);
    renderThread();

    await screen.findByText("We are looking into this.");
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
  });

  it("shows reply count in the section header", async () => {
    mockReplies([AGENT_REPLY, CUSTOMER_REPLY]);
    renderThread();

    await screen.findByText("We are looking into this.");
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("shows author initials in the avatar", async () => {
    mockReplies([AGENT_REPLY]);
    renderThread();

    await screen.findByText("We are looking into this.");
    expect(screen.getByText("BS")).toBeInTheDocument();
  });

  // --- reply form always present ----------------------------------------------

  it("always renders the reply textarea and Send Reply button", async () => {
    mockReplies([]);
    renderThread();
    await screen.findByText("No replies yet.");
    expect(screen.getByPlaceholderText("Write a reply…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reply/i })).toBeInTheDocument();
  });

  // --- disabled state ---------------------------------------------------------

  it("Send Reply is disabled when the textarea is empty", async () => {
    mockReplies([]);
    renderThread();

    await screen.findByText("No replies yet.");
    expect(screen.getByRole("button", { name: /send reply/i })).toBeDisabled();
  });

  it("Polish is disabled when the textarea is empty", async () => {
    mockReplies([]);
    renderThread();

    await screen.findByText("No replies yet.");
    expect(screen.getByRole("button", { name: /^polish$/i })).toBeDisabled();
  });

  it("both buttons are disabled when the textarea contains only whitespace", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    renderThread();

    await screen.findByText("No replies yet.");
    await user.type(screen.getByPlaceholderText("Write a reply…"), "   ");
    expect(screen.getByRole("button", { name: /send reply/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^polish$/i })).toBeDisabled();
  });

  it("both buttons are enabled after typing a non-empty reply", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    renderThread();

    await screen.findByText("No replies yet.");
    await user.type(screen.getByPlaceholderText("Write a reply…"), "Hello");
    expect(screen.getByRole("button", { name: /send reply/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^polish$/i })).not.toBeDisabled();
  });

  // --- submission -------------------------------------------------------------

  it("calls POST with the reply body and withCredentials on submit", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    mockedPost.mockResolvedValue({ data: { reply: AGENT_REPLY } });
    renderThread();

    await screen.findByText("No replies yet.");
    await user.type(screen.getByPlaceholderText("Write a reply…"), "Hello there");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        `/api/tickets/${TICKET_ID}/replies`,
        { body: "Hello there" },
        { withCredentials: true }
      );
    });
  });

  it("disables the Send Reply button while the mutation is in flight", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    mockedPost.mockReturnValue(new Promise(() => {}));
    renderThread();

    await screen.findByText("No replies yet.");
    await user.type(screen.getByPlaceholderText("Write a reply…"), "Hello there");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    expect(await screen.findByRole("button", { name: /sending/i })).toBeDisabled();
  });

  it("clears the textarea after a successful reply", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    mockedPost.mockResolvedValue({ data: { reply: AGENT_REPLY } });
    renderThread();

    await screen.findByText("No replies yet.");
    const textarea = screen.getByPlaceholderText("Write a reply…");
    await user.type(textarea, "Hello there");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });

  it("refetches replies after a successful submission", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    mockedPost.mockResolvedValue({ data: { reply: AGENT_REPLY } });
    renderThread();

    await screen.findByText("No replies yet.");
    const initialGetCount = mockedGet.mock.calls.length;

    await user.type(screen.getByPlaceholderText("Write a reply…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(mockedGet.mock.calls.length).toBeGreaterThan(initialGetCount);
    });
  });

  // --- error states -----------------------------------------------------------

  it("shows generic error message when POST fails without a server body", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    mockedPost.mockRejectedValue(new Error("Network error"));
    renderThread();

    await screen.findByText("No replies yet.");
    await user.type(screen.getByPlaceholderText("Write a reply…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    expect(await screen.findByText("Failed to send reply.")).toBeInTheDocument();
  });

  it("surfaces the server error message from the API response", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    const err = Object.assign(new Error("Bad request"), {
      isAxiosError: true,
      response: { data: { error: "Reply body is too long." } },
    });
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockedPost.mockRejectedValue(err);
    renderThread();

    await screen.findByText("No replies yet.");
    await user.type(screen.getByPlaceholderText("Write a reply…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    expect(await screen.findByText("Reply body is too long.")).toBeInTheDocument();
  });

  // --- polish button ----------------------------------------------------------

  it("renders the Polish button", async () => {
    mockReplies([]);
    renderThread();

    await screen.findByText("No replies yet.");
    expect(screen.getByRole("button", { name: /^polish$/i })).toBeInTheDocument();
  });

  it("calls POST /api/tickets/:id/polish with the draft body and withCredentials", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    mockedPost.mockResolvedValue({ data: { polished: "Polished text." } });
    renderThread();

    await screen.findByText("No replies yet.");
    await user.type(screen.getByPlaceholderText("Write a reply…"), "rough draft");
    await user.click(screen.getByRole("button", { name: /^polish$/i }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        `/api/tickets/${TICKET_ID}/polish`,
        { body: "rough draft" },
        { withCredentials: true }
      );
    });
  });

  it("replaces the textarea content with the polished text on success", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    mockedPost.mockResolvedValue({ data: { polished: "This is the polished reply." } });
    renderThread();

    await screen.findByText("No replies yet.");
    await user.type(screen.getByPlaceholderText("Write a reply…"), "rough draft");
    await user.click(screen.getByRole("button", { name: /^polish$/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Write a reply…")).toHaveValue(
        "This is the polished reply."
      );
    });
  });

  it("shows 'Polishing…' and disables both buttons while the request is in flight", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    mockedPost.mockReturnValue(new Promise(() => {}));
    renderThread();

    await screen.findByText("No replies yet.");
    await user.type(screen.getByPlaceholderText("Write a reply…"), "rough draft");
    await user.click(screen.getByRole("button", { name: /^polish$/i }));

    expect(await screen.findByRole("button", { name: /polishing/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /send reply/i })).toBeDisabled();
  });

  it("shows an error alert when the polish request fails", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    mockedPost.mockRejectedValue(new Error("Network error"));
    renderThread();

    await screen.findByText("No replies yet.");
    await user.type(screen.getByPlaceholderText("Write a reply…"), "rough draft");
    await user.click(screen.getByRole("button", { name: /^polish$/i }));

    expect(
      await screen.findByText("Failed to polish reply. Please try again.")
    ).toBeInTheDocument();
  });

  it("re-enables the Polish button after a failed polish request", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    mockedPost.mockRejectedValue(new Error("Network error"));
    renderThread();

    await screen.findByText("No replies yet.");
    await user.type(screen.getByPlaceholderText("Write a reply…"), "rough draft");
    await user.click(screen.getByRole("button", { name: /^polish$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^polish$/i })).not.toBeDisabled();
    });
  });

  it("does not call the polish endpoint when the textarea is empty", async () => {
    const user = userEvent.setup();
    mockReplies([]);
    renderThread();

    await screen.findByText("No replies yet.");
    // button is disabled — click should have no effect
    await user.click(screen.getByRole("button", { name: /^polish$/i }));

    expect(mockedPost).not.toHaveBeenCalled();
  });

  // --- API calls --------------------------------------------------------------

  it("fetches replies with withCredentials", async () => {
    mockReplies([]);
    renderThread();

    await screen.findByText("No replies yet.");
    expect(mockedGet).toHaveBeenCalledWith(
      `/api/tickets/${TICKET_ID}/replies`,
      { withCredentials: true }
    );
  });
});
