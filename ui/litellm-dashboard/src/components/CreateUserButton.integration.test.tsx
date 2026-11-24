import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateUserButton } from "./CreateUserButton";

const linkEmployee = vi.fn<(body: Record<string, unknown>) => Response>();
let enrollmentEnabled = false;
let guestEnabled = false;
const guestOperation = vi.fn<(body: Record<string, unknown>) => Response>();
const createUser = vi.fn<(body: Record<string, unknown>) => Response>();
const unexpectedRequest = vi.fn((path: string) =>
  Response.json({ error: `Unexpected request ${path}` }, { status: 500 }),
);

beforeEach(() => {
  unexpectedRequest.mockClear();
  enrollmentEnabled = false;
  guestEnabled = false;
  guestOperation.mockReset();
  linkEmployee.mockReset();
  linkEmployee.mockImplementation(() => Response.json({ user_id: "linked" }));
  createUser.mockReset();
  createUser.mockImplementation((body) => Response.json({ user_id: body.user_id ?? "generated-id" }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(input instanceof Request ? input.url : String(input), "http://localhost").pathname;
      if (path === "/user/new") return createUser(JSON.parse(String(init?.body)));
      if (path === "/models") return Response.json({ data: [] });
      if (path === "/sso/users/guest") return guestOperation(JSON.parse(String(init?.body)));
      if (path === "/sso/users/link") return linkEmployee(JSON.parse(String(init?.body)));
      if (path === "/sso/get/ui_settings") {
        return Response.json({
          SSO_ENABLED: true,
          UNIFIED_OIDC_EMPLOYEE_ENROLLMENT: enrollmentEnabled,
          UNIFIED_OIDC_GUEST_ENROLLMENT: guestEnabled,
        });
      }
      if (path === "/v2/team/list") return Response.json({ teams: [], total: 0, total_pages: 0 });
      return unexpectedRequest(path);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(unexpectedRequest).not.toHaveBeenCalled();
});

const renderForm = (isEmbedded: boolean, onUserCreated = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <CreateUserButton
        userID="admin"
        accessToken="test-token"
        possibleUIRoles={null}
        isEmbedded={isEmbedded}
        onUserCreated={onUserCreated}
      />
    </QueryClientProvider>,
  );
  return onUserCreated;
};

describe("custom User ID invitation", () => {
  it.each([true, false])("sends the custom ID from the form (embedded=%s)", async (embedded) => {
    const user = userEvent.setup();
    const onCreated = renderForm(embedded);
    if (!embedded) await user.click(screen.getByRole("button", { name: "+ Invite User" }));
    await user.click(screen.getByRole("checkbox", { name: "Supply custom User ID" }));
    fireEvent.change(screen.getByRole("textbox", { name: "User ID", exact: true }), {
      target: { value: "  employee-42  " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "User Email" }), {
      target: { value: "employee@example.test" },
    });
    await user.click(screen.getByRole("button", { name: embedded ? "Create User" : "Invite User", exact: true }));
    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "employee-42",
          user_email: "employee@example.test",
          auto_create_key: false,
        }),
      ),
    );
    expect(createUser.mock.calls[0][0]).not.toHaveProperty("supply_user_id");
    if (embedded) {
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith("employee-42"));
      expect(screen.getByRole("checkbox", { name: "Supply custom User ID" })).not.toBeChecked();
      expect(screen.queryByRole("textbox", { name: "User ID", exact: true })).not.toBeInTheDocument();
    }
  });

  it("blocks whitespace and clears the custom ID when automatic generation is selected", async () => {
    const user = userEvent.setup();
    renderForm(true);
    await user.click(screen.getByRole("checkbox", { name: "Supply custom User ID" }));
    fireEvent.change(screen.getByRole("textbox", { name: "User ID", exact: true }), { target: { value: "   " } });
    await user.click(screen.getByRole("button", { name: "Create User" }));
    expect(await screen.findByText("Enter a User ID")).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "User ID", exact: true }), {
      target: { value: "discard-me" },
    });
    await user.click(screen.getByRole("checkbox", { name: "Supply custom User ID" }));
    await user.click(screen.getByRole("button", { name: "Create User" }));
    await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ user_id: null })));
    expect(createUser.mock.calls[0][0]).not.toHaveProperty("supply_user_id");
  });

  it("discards a custom ID when an invitation is cancelled", async () => {
    const user = userEvent.setup();
    renderForm(false);
    await user.click(screen.getByRole("button", { name: "+ Invite User" }));
    await user.click(screen.getByRole("checkbox", { name: "Supply custom User ID" }));
    fireEvent.change(screen.getByRole("textbox", { name: "User ID", exact: true }), { target: { value: "cancelled" } });
    await user.click(
      within(screen.getByRole("dialog", { name: "Invite User" })).getByRole("button", { name: "Close" }),
    );
    await user.click(screen.getByRole("button", { name: "+ Invite User" }));
    expect(screen.getByRole("checkbox", { name: "Supply custom User ID" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Supply custom User ID" }));
    expect(screen.getByRole("textbox", { name: "User ID", exact: true })).toHaveValue("");
  });
});

it("links the realm subject through the employee enrollment route", async () => {
  enrollmentEnabled = true;
  renderForm(false);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "+ Invite User" }));
  await user.click(await screen.findByRole("button", { name: "Link existing employee" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Keycloak user ID" }), { target: { value: " realm-user-1 " } });
  await user.click(screen.getByRole("button", { name: "Confirm employee link" }));
  await waitFor(() => expect(linkEmployee).toHaveBeenCalledWith({ subject: "realm-user-1" }));
  expect(createUser).not.toHaveBeenCalled();
});

it("prepares guest enrollment before allowing a separate activation request", async () => {
  guestEnabled = true;
  guestOperation.mockImplementation(({ action }) =>
    Response.json({ operation_id: "op-1", state: action === "send" ? "activation_requested" : "awaiting_activation" }),
  );
  renderForm(false);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "+ Invite User" }));
  await user.click(await screen.findByRole("button", { name: "Invite a guest" }));
  expect(screen.queryByRole("button", { name: "Send activation email" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Guest email" }), { target: { value: "guest@example.test" } });
  await user.click(screen.getByRole("button", { name: "Prepare guest" }));
  await user.click(await screen.findByRole("button", { name: "Send activation email" }));
  expect(await screen.findByText("The identity platform accepted the activation email request.")).toBeInTheDocument();
  expect(guestOperation.mock.calls).toEqual([
    [{ email: "guest@example.test", action: "prepare" }],
    [{ email: "guest@example.test", action: "send" }],
  ]);
});
