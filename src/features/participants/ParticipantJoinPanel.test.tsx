// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantJoinPanel } from "./ParticipantJoinPanel";

const joinPanelMocks = vi.hoisted(() => ({
  joinParticipantSession: vi.fn(),
  restoreParticipantSession: vi.fn(),
  presence: { status: "connected" as const, error: null },
}));

vi.mock("./participant-session", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./participant-session")>();

  return {
    ...original,
    joinParticipantSession: joinPanelMocks.joinParticipantSession,
    restoreParticipantSession: joinPanelMocks.restoreParticipantSession,
  };
});

vi.mock("./use-participant-presence", () => ({
  useParticipantPresence: () => joinPanelMocks.presence,
}));

const participantUser = {
  uid: "participante-1",
  isAnonymous: true,
  getIdToken: vi.fn(),
} as unknown as User;

const participant = {
  gameId: "ABC234",
  participantId: "participante-1",
  nickname: "Estrela Azul",
  moderationStatus: "waiting-approval",
  joinedAt: 1_000,
};

describe("ParticipantJoinPanel", () => {
  beforeEach(() => {
    joinPanelMocks.restoreParticipantSession
      .mockReset()
      .mockResolvedValue(null);
    joinPanelMocks.joinParticipantSession
      .mockReset()
      .mockResolvedValue(participant);
  });

  afterEach(cleanup);

  it("envia código e nickname e apresenta a sessão criada", async () => {
    const browserUser = userEvent.setup();
    render(<ParticipantJoinPanel user={participantUser} />);

    await browserUser.type(
      await screen.findByLabelText("Código da sala"),
      "abc234",
    );
    await browserUser.type(
      screen.getByLabelText("Seu nickname"),
      "Estrela Azul",
    );
    await browserUser.click(
      screen.getByRole("button", { name: "Entrar na sala" }),
    );

    expect(await screen.findByText("Estrela Azul")).toBeInTheDocument();
    expect(screen.getByText("Aguardando aprovação")).toBeInTheDocument();
    expect(joinPanelMocks.joinParticipantSession).toHaveBeenCalledWith(
      participantUser,
      { gameId: "ABC234", nickname: "Estrela Azul" },
    );
  });

  it("restaura a participação persistida", async () => {
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);

    render(<ParticipantJoinPanel user={participantUser} />);

    expect(await screen.findByText("Estrela Azul")).toBeInTheDocument();
    expect(screen.getByText("ABC234")).toBeInTheDocument();
  });
});
