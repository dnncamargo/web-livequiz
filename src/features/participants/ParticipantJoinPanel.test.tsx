// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantJoinPanel } from "./ParticipantJoinPanel";
import { ParticipantSessionRequestError } from "./participant-session";

const joinPanelMocks = vi.hoisted(() => ({
  joinParticipantSession: vi.fn(),
  restoreParticipantSession: vi.fn(),
  presence: { status: "connected" as const, error: null },
  presenceGameId: "" as string | null,
  moderation: {
    status: null as null | "waiting-approval" | "approved" | "removed",
    error: null as string | null,
  },
  publicRoom: {
    room: {
      id: "ABC234",
      phase: "waiting" as const,
      createdAt: 1_000,
      participantCount: 1,
    } as null | {
      id: string;
      phase: "waiting";
      createdAt: number;
      participantCount: number;
    },
    loading: false,
    error: null as string | null,
  },
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
  useParticipantPresence: (gameId: string | null) => {
    joinPanelMocks.presenceGameId = gameId;
    return joinPanelMocks.presence;
  },
}));

vi.mock("./use-participant-moderation-status", () => ({
  useParticipantModerationStatus: () => joinPanelMocks.moderation,
}));

vi.mock("../live-game/use-public-waiting-room", () => ({
  usePublicWaitingRoom: (gameId: string) =>
    gameId
      ? joinPanelMocks.publicRoom
      : { room: null, loading: false, error: null },
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
    joinPanelMocks.presenceGameId = "";
    joinPanelMocks.moderation.status = null;
    joinPanelMocks.moderation.error = null;
    joinPanelMocks.publicRoom.room = {
      id: "ABC234",
      phase: "waiting",
      createdAt: 1_000,
      participantCount: 1,
    };
    joinPanelMocks.publicRoom.loading = false;
    joinPanelMocks.publicRoom.error = null;
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

  it("encerra a presença quando o administrador remove o participante", async () => {
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);
    joinPanelMocks.moderation.status = "removed";

    render(<ParticipantJoinPanel user={participantUser} />);

    expect(
      await screen.findByText("Você foi removido desta sala"),
    ).toBeInTheDocument();
    expect(screen.getByText("Entrada removida")).toBeInTheDocument();
    expect(joinPanelMocks.presenceGameId).toBeNull();
    expect(
      screen.getByRole("button", { name: "Procurar outra sala" }),
    ).toBeInTheDocument();
  });

  it("diferencia o encerramento da sala da remoção individual", async () => {
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);
    joinPanelMocks.publicRoom.room = null;

    render(<ParticipantJoinPanel user={participantUser} />);

    expect(
      await screen.findByText("Esta sala foi encerrada"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sala encerrada")).toBeInTheDocument();
    expect(
      screen.queryByText("Você foi removido desta sala"),
    ).not.toBeInTheDocument();
    expect(joinPanelMocks.presenceGameId).toBeNull();
  });

  it("preenche o código identificado no link da sala", async () => {
    render(
      <ParticipantJoinPanel user={participantUser} initialGameId="ABC234" />,
    );

    expect(await screen.findByLabelText("Código da sala")).toHaveValue(
      "ABC234",
    );
  });

  it("apresenta a referência específica da falha de entrada", async () => {
    const browserUser = userEvent.setup();
    joinPanelMocks.joinParticipantSession.mockRejectedValue(
      new ParticipantSessionRequestError(
        "participant-api-unreachable",
        "Não foi possível conectar ao servidor de participantes.",
      ),
    );
    render(<ParticipantJoinPanel user={participantUser} />);

    await browserUser.type(
      await screen.findByLabelText("Código da sala"),
      "ABC234",
    );
    await browserUser.type(screen.getByLabelText("Seu nickname"), "Cometa");
    await browserUser.click(
      screen.getByRole("button", { name: "Entrar na sala" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Referência: participant-api-unreachable",
    );
  });
});
