// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantJoinPanel } from "./ParticipantJoinPanel";
import { ParticipantSessionRequestError } from "./participant-session";
import type { PublicWaitingRoom } from "../../shared/waiting-room";

const joinPanelMocks = vi.hoisted(() => ({
  joinParticipantSession: vi.fn(),
  restoreParticipantSession: vi.fn(),
  getAnswerStatus: vi.fn(),
  submitAnswer: vi.fn(),
  presence: { status: "connected" as const, error: null },
  presenceGameId: "" as string | null,
  moderation: {
    status: null as null | "waiting-approval" | "approved" | "removed",
    error: null as string | null,
  },
  onRemoved: null as null | (() => void),
  publicRoom: {
    room: {
      id: "ABC234",
      phase: "waiting" as const,
      createdAt: 1_000,
      participantCount: 1,
    } as PublicWaitingRoom | null,
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

vi.mock("./participant-answer", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./participant-answer")>();

  return {
    ...original,
    getAnswerStatus: joinPanelMocks.getAnswerStatus,
    submitAnswer: joinPanelMocks.submitAnswer,
  };
});

vi.mock("./use-participant-presence", () => ({
  useParticipantPresence: (gameId: string | null) => {
    joinPanelMocks.presenceGameId = gameId;
    return joinPanelMocks.presence;
  },
}));

vi.mock("./use-participant-moderation-status", () => ({
  useParticipantModerationStatus: (
    gameId: string | null,
    _participantId: string,
    onRemoved?: () => void,
  ) => {
    joinPanelMocks.onRemoved = onRemoved ?? null;
    useEffect(() => {
      if (gameId && joinPanelMocks.moderation.status === "removed") {
        onRemoved?.();
      }
    }, [gameId, onRemoved]);
    return joinPanelMocks.moderation;
  },
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
  avatar: "🦊",
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
    joinPanelMocks.getAnswerStatus.mockReset().mockResolvedValue(null);
    joinPanelMocks.submitAnswer.mockReset().mockResolvedValue({
      questionId: "pergunta-1",
      selectedOptionIds: ["opcao-a"],
      answeredAt: 2_000,
    });
    joinPanelMocks.presenceGameId = "";
    joinPanelMocks.moderation.status = null;
    joinPanelMocks.moderation.error = null;
    joinPanelMocks.onRemoved = null;
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
    expect(screen.getByText("Pronto")).toBeInTheDocument();
    expect(joinPanelMocks.joinParticipantSession).toHaveBeenCalledWith(
      participantUser,
      { gameId: "ABC234", nickname: "Estrela Azul", avatar: "🦊" },
    );
  });

  it("restaura a participação persistida", async () => {
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);

    render(<ParticipantJoinPanel user={participantUser} />);

    expect(await screen.findByText("Estrela Azul")).toBeInTheDocument();
    expect(screen.getByText("ABC234")).toBeInTheDocument();
  });

  it("sai da sala e retorna diretamente ao formulário de entrada", async () => {
    const browserUser = userEvent.setup();
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);

    render(<ParticipantJoinPanel user={participantUser} />);

    await browserUser.click(
      await screen.findByRole("button", { name: "Sair da sala" }),
    );

    expect(
      screen.getByRole("button", { name: "Entrar na sala" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Código da sala")).toBeInTheDocument();
    expect(screen.getByLabelText("Seu nickname")).toBeInTheDocument();
    expect(screen.getByLabelText("Código da sala")).toHaveValue("");
    expect(screen.getByLabelText("Seu nickname")).toHaveValue("");
    expect(joinPanelMocks.presenceGameId).toBeNull();
    expect(
      screen.queryByText("Falha ao acompanhar sua entrada"),
    ).not.toBeInTheDocument();
  });

  it("permite entrar novamente com outro nickname no mesmo UID", async () => {
    const browserUser = userEvent.setup();
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);
    joinPanelMocks.joinParticipantSession.mockImplementation(
      (_user: unknown, input: { nickname: string }) =>
        Promise.resolve({ ...participant, nickname: input.nickname }),
    );

    render(<ParticipantJoinPanel user={participantUser} />);

    await browserUser.click(
      await screen.findByRole("button", { name: "Sair da sala" }),
    );
    await browserUser.type(screen.getByLabelText("Código da sala"), "ABC234");
    await browserUser.type(screen.getByLabelText("Seu nickname"), "Cometa");
    await browserUser.click(
      screen.getByRole("button", { name: "Entrar na sala" }),
    );

    expect(joinPanelMocks.joinParticipantSession).toHaveBeenCalledWith(
      participantUser,
      { gameId: "ABC234", nickname: "Cometa", avatar: "🦊" },
    );
    expect(await screen.findByText("Cometa")).toBeInTheDocument();
  });

  it("limpa a sessão e retorna ao formulário quando o participante é removido", async () => {
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);
    joinPanelMocks.moderation.status = "removed";

    render(<ParticipantJoinPanel user={participantUser} />);

    expect(
      await screen.findByRole("button", { name: "Entrar na sala" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Código da sala")).toHaveValue("");
    expect(screen.getByLabelText("Seu nickname")).toHaveValue("");
    expect(
      screen.queryByText("Você foi removido desta sala"),
    ).not.toBeInTheDocument();
    expect(joinPanelMocks.presenceGameId).toBeNull();
  });

  it("diferencia o encerramento da sala da remoção individual", async () => {
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);
    joinPanelMocks.publicRoom.room = null;

    render(<ParticipantJoinPanel user={participantUser} />);

    expect(
      await screen.findByText("Esta apresentação foi encerrada"),
    ).toBeInTheDocument();
    expect(screen.getByText("Apresentação encerrada")).toBeInTheDocument();
    expect(
      screen.queryByText("Você foi removido desta sala"),
    ).not.toBeInTheDocument();
    expect(joinPanelMocks.presenceGameId).toBeNull();
  });

  it("trata a fase finalizada como encerramento da apresentação", async () => {
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);
    joinPanelMocks.publicRoom.room = {
      id: "ABC234",
      phase: "finished",
      createdAt: 1_000,
      participantCount: 1,
    };

    render(<ParticipantJoinPanel user={participantUser} />);

    expect(
      await screen.findByText("Esta apresentação foi encerrada"),
    ).toBeInTheDocument();
    expect(joinPanelMocks.presenceGameId).toBeNull();
  });

  it("apresenta as alternativas da pergunta ativa sem marcar o gabarito", async () => {
    const browserUser = userEvent.setup();
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);
    joinPanelMocks.publicRoom.room = {
      id: "ABC234",
      name: "Turma 8A",
      phase: "question",
      presentationStatus: "active",
      createdAt: 1_000,
      participantCount: 1,
      questionNumber: 1,
      totalQuestions: 2,
      phaseTiming: { startedAt: Date.now(), durationMs: 20_000 },
      currentQuestion: {
        id: "pergunta-1",
        type: "single-choice",
        prompt: "Qual é a capital do Brasil?",
        position: 0,
        durationMs: 20_000,
        points: 1_000,
        options: [
          { id: "opcao-a", label: "Brasília" },
          { id: "opcao-b", label: "Salvador" },
        ],
      },
    };

    render(<ParticipantJoinPanel user={participantUser} />);

    expect(
      await screen.findByText("Qual é a capital do Brasil?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Brasília")).toBeInTheDocument();
    expect(screen.getByText("Salvador")).toBeInTheDocument();
    expect(screen.queryByText("Resposta correta")).not.toBeInTheDocument();
    expect(screen.queryByText("Você está na sala")).not.toBeInTheDocument();
    expect(screen.queryByText("Entrar em uma sala")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "triângulo: Brasília" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /alternativa 1/i }),
    ).not.toBeInTheDocument();

    await browserUser.click(
      screen.getByRole("button", { name: "triângulo: Brasília" }),
    );

    expect(joinPanelMocks.submitAnswer).toHaveBeenCalledWith(participantUser, {
      gameId: "ABC234",
      questionId: "pergunta-1",
      selectedOptionIds: ["opcao-a"],
    });
    expect(await screen.findByText(/Resposta enviada/)).toBeInTheDocument();
    expect(joinPanelMocks.presenceGameId).toBe("ABC234");
  });

  it("mostra pontos somente quando a resposta é revelada", async () => {
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);
    joinPanelMocks.getAnswerStatus.mockResolvedValue({
      questionId: "pergunta-1",
      selectedOptionIds: ["opcao-a"],
      answeredAt: 2_000,
      result: { isCorrect: true, pointsAwarded: 900, totalScore: 900 },
    });
    joinPanelMocks.publicRoom.room = {
      id: "ABC234",
      phase: "revealing",
      presentationStatus: "active",
      createdAt: 1_000,
      participantCount: 1,
      questionNumber: 1,
      totalQuestions: 1,
      revealedCorrectOptionIds: ["opcao-a"],
      currentQuestion: {
        id: "pergunta-1",
        type: "single-choice",
        prompt: "Qual é a capital do Brasil?",
        position: 0,
        durationMs: 20_000,
        points: 1_000,
        options: [
          { id: "opcao-a", label: "Brasília" },
          { id: "opcao-b", label: "Salvador" },
        ],
      },
    };

    render(<ParticipantJoinPanel user={participantUser} />);

    expect(await screen.findByText("Resposta correta!")).toBeInTheDocument();
    expect(screen.getByText("+900 pontos")).toBeInTheDocument();
    expect(screen.getByText("Total: 900 pontos")).toBeInTheDocument();
  });

  it("orienta o participante durante ranking e pódio", async () => {
    joinPanelMocks.restoreParticipantSession.mockResolvedValue(participant);
    joinPanelMocks.publicRoom.room = {
      id: "ABC234",
      phase: "ranking",
      presentationStatus: "active",
      createdAt: 1_000,
      participantCount: 2,
      questionNumber: 1,
      totalQuestions: 2,
      ranking: [
        { position: 1, nickname: "Estrela Azul", avatar: "🦊", score: 900 },
      ],
    };

    const { rerender } = render(
      <ParticipantJoinPanel user={participantUser} />,
    );

    expect(await screen.findByText("Ranking atualizado")).toBeInTheDocument();

    joinPanelMocks.publicRoom.room = {
      id: "ABC234",
      phase: "podium",
      presentationStatus: "active",
      createdAt: 1_000,
      participantCount: 2,
      questionNumber: 2,
      totalQuestions: 2,
      podium: [
        { position: 1, nickname: "Estrela Azul", avatar: "🦊", score: 1_800 },
      ],
    };
    rerender(<ParticipantJoinPanel user={participantUser} />);

    expect(await screen.findByText("Resultado final")).toBeInTheDocument();
    expect(
      screen.getByText("Confira o pódio na apresentação."),
    ).toBeInTheDocument();
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
