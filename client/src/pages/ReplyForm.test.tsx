import { afterEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReplyForm } from "./TicketDetailPage";

function renderReplyForm() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <ReplyForm ticketId="ticket-1" />
    </QueryClientProvider>
  );
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  // @ts-expect-error -- restore fetch between tests
  delete globalThis.fetch;
});

describe("ReplyForm", () => {
  test("disables the submit button until non-whitespace text is entered", () => {
    renderReplyForm();

    const textarea = screen.getByPlaceholderText("Write a reply…");
    const button = screen.getByRole("button", { name: "Send Reply" });
    expect(button).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "   " } });
    expect(button).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "Thanks for reaching out" } });
    expect(button).toBeEnabled();
  });

  test("submits the reply body to the messages endpoint and clears the textarea on success", async () => {
    const fetchMock = mock((_url: string, _options: RequestInit) =>
      Promise.resolve(jsonResponse(201, { id: "ticket-1", messages: [] }))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderReplyForm();

    const textarea = screen.getByPlaceholderText("Write a reply…");
    fireEvent.change(textarea, { target: { value: "Can you share more details?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Reply" }));

    await waitFor(() => expect(textarea).toHaveValue(""));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/tickets/ticket-1/messages");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({ body: "Can you share more details?" });
  });

  test("shows a pending state while the request is in flight", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = mock(() => new Promise<Response>((resolve) => (resolveFetch = resolve)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderReplyForm();

    const textarea = screen.getByPlaceholderText("Write a reply…");
    fireEvent.change(textarea, { target: { value: "Looking into it now." } });
    fireEvent.click(screen.getByRole("button", { name: "Send Reply" }));

    const pendingButton = await screen.findByRole("button", { name: "Sending…" });
    expect(pendingButton).toBeDisabled();
    expect(textarea).toBeDisabled();

    resolveFetch(jsonResponse(201, { id: "ticket-1", messages: [] }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Send Reply" })).toBeInTheDocument());
  });

  test("shows an error message and preserves the draft when the request fails", async () => {
    const fetchMock = mock(() => Promise.resolve(jsonResponse(500, { error: "boom" })));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderReplyForm();

    const textarea = screen.getByPlaceholderText("Write a reply…");
    fireEvent.change(textarea, { target: { value: "Will this go through?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Reply" }));

    expect(await screen.findByText("Failed to send reply (500)")).toBeInTheDocument();
    expect(textarea).toHaveValue("Will this go through?");
    expect(screen.getByRole("button", { name: "Send Reply" })).toBeEnabled();
  });
});
