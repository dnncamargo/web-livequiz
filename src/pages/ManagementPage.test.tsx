// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ManagementPage } from "./ManagementPage";

const managementMocks = vi.hoisted(() => ({
  createWaitingRoom: vi.fn(),
  logout: vi.fn(),
  user: {
    uid: "administrador-1",
    displayName: "Professora Ana",
    email: "ana@example.com",
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => ({
    user: managementMocks.user,
    logout: managementMocks.logout,
  }),
}));

vi.mock("../features/live-game/waiting-room", () => ({
  createWaitingRoom: managementMocks.createWaitingRoom,
  WaitingRoomRequestError: class WaitingRoomRequestError extends Error {},
}));

describe("ManagementPage", () => {
  beforeEach(() => {
    managementMocks.logout.mockReset().mockResolvedValue(undefined);
    managementMocks.createWaitingRoom.mockReset().mockResolvedValue({
      id: "ABC234",
      phase: "waiting",
      createdAt: 1_000,
      participantCount: 0,
    });
  });

  afterEach(cleanup);

  it("cria a sala e abre sua rota administrativa", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/gerenciar"]}>
        <Routes>
          <Route path="/gerenciar" element={<ManagementPage />} />
          <Route
            path="/gerenciar/sala/:id"
            element={<p>Sala ABC234 aberta</p>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Criar sala de espera" }),
    );

    expect(await screen.findByText("Sala ABC234 aberta")).toBeInTheDocument();
    expect(managementMocks.createWaitingRoom).toHaveBeenCalledWith(
      managementMocks.user,
    );
  });
});
