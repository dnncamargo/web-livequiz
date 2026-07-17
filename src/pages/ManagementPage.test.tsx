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
  activeWaitingRoomState: {
    waitingRoom: null as null | {
      room: {
        id: string;
        phase: "waiting";
        createdAt: number;
        participantCount: number;
      };
      participants: unknown[];
    },
    loading: false,
    error: null as string | null,
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

vi.mock("../features/live-game/use-managed-waiting-room", () => ({
  useManagedWaitingRoom: () => managementMocks.activeWaitingRoomState,
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
    managementMocks.activeWaitingRoomState.waitingRoom = null;
    managementMocks.activeWaitingRoomState.loading = false;
    managementMocks.activeWaitingRoomState.error = null;
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

  it("permite retomar a sala ativa depois de voltar ao gerenciamento", () => {
    managementMocks.activeWaitingRoomState.waitingRoom = {
      room: {
        id: "ABC234",
        phase: "waiting",
        createdAt: 1_000,
        participantCount: 2,
      },
      participants: [],
    };

    render(
      <MemoryRouter>
        <ManagementPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Retomar sala ABC234" }),
    ).toHaveAttribute("href", "/gerenciar/sala/ABC234");
    expect(
      screen.queryByRole("button", { name: "Criar sala de espera" }),
    ).not.toBeInTheDocument();
  });
});
