// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PresentationPage } from "./PresentationPage";
import type { PublicWaitingRoom } from "../shared/waiting-room";

const presentationMock = vi.hoisted(() => ({
  gameId: "",
  isAdministrator: true,
  user: { uid: "administrador-1", getIdToken: vi.fn() },
  advanceWaitingRoomGame: vi.fn(),
  presentWaitingRoom: vi.fn(),
  state: {
    room: {
      id: "ABC234",
      name: "Quiz de Ciências",
      phase: "waiting" as const,
      presentationStatus: "active" as const,
      createdAt: 1_000,
      participantCount: 2,
      participants: [
        { nickname: "Estrela Azul", avatar: "🦊" as const },
        { nickname: "Cometa", avatar: "🚀" as const },
      ],
    } as PublicWaitingRoom | null,
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("../features/live-game/use-public-waiting-room", () => ({
  usePublicWaitingRoom: (gameId: string) => {
    presentationMock.gameId = gameId;
    return presentationMock.state;
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => ({
    user: presentationMock.isAdministrator ? presentationMock.user : null,
    isAdministrator: presentationMock.isAdministrator,
  }),
}));

vi.mock("../features/live-game/waiting-room", () => ({
  WaitingRoomRequestError: class WaitingRoomRequestError extends Error {},
  advanceWaitingRoomGame: presentationMock.advanceWaitingRoomGame,
  presentWaitingRoom: presentationMock.presentWaitingRoom,
}));

describe("PresentationPage", () => {
  beforeEach(() => {
    presentationMock.isAdministrator = true;
    presentationMock.advanceWaitingRoomGame.mockReset().mockResolvedValue({
      id: "ABC234",
      name: "Quiz de Ciências",
      quizId: "quiz-1",
      quizTitle: "Ciências",
      phase: "countdown",
      presentationStatus: "active",
      createdAt: 1_000,
      participantCount: 2,
      questionNumber: 1,
      totalQuestions: 1,
      phaseTiming: { startedAt: Date.now(), durationMs: 3_000 },
    });
    presentationMock.presentWaitingRoom.mockReset().mockResolvedValue({});
    presentationMock.state.room = {
      id: "ABC234",
      name: "Quiz de Ciências",
      phase: "waiting",
      presentationStatus: "active",
      quizId: "quiz-1",
      quizTitle: "Ciências",
      createdAt: 1_000,
      participantCount: 2,
      participants: [
        { nickname: "Estrela Azul", avatar: "🦊" },
        { nickname: "Cometa", avatar: "🚀" },
      ],
    };
  });

  afterEach(cleanup);

  it("apresenta nome, participantes e avatares da projeção pública", () => {
    render(
      <MemoryRouter initialEntries={["/?room=ABC234"]}>
        <PresentationPage />
      </MemoryRouter>,
    );

    expect(presentationMock.gameId).toBe("ABC234");
    expect(
      screen.getByRole("heading", { name: "Quiz de Ciências" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Estrela Azul")).toBeInTheDocument();
    expect(screen.getByText("Cometa")).toBeInTheDocument();
    expect(screen.getByText("🦊")).toBeInTheDocument();
    expect(screen.getByText("🚀")).toBeInTheDocument();
  });

  it("inicia o quiz somente pelo controle autenticado da apresentação", async () => {
    const browserUser = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/?room=ABC234"]}>
        <PresentationPage />
      </MemoryRouter>,
    );

    await browserUser.click(
      screen.getByRole("button", { name: "Iniciar quiz" }),
    );

    expect(presentationMock.advanceWaitingRoomGame).toHaveBeenCalledWith(
      presentationMock.user,
      { gameId: "ABC234", action: "advance-game" },
    );
    expect(
      await screen.findByLabelText("Contagem regressiva"),
    ).toBeInTheDocument();
  });

  it("mantém a apresentação pública sem controles administrativos", () => {
    presentationMock.isAdministrator = false;

    render(
      <MemoryRouter initialEntries={["/?room=ABC234"]}>
        <PresentationPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Iniciar quiz" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Aguardando participantes")).toBeInTheDocument();
  });

  it("exibe automaticamente a pergunta ao terminar a contagem", async () => {
    presentationMock.state.room = {
      id: "ABC234",
      name: "Quiz de Ciências",
      quizId: "quiz-1",
      phase: "countdown",
      presentationStatus: "active",
      createdAt: 1_000,
      participantCount: 2,
      questionNumber: 1,
      totalQuestions: 1,
      phaseTiming: { startedAt: Date.now() - 4_000, durationMs: 3_000 },
    };

    render(
      <MemoryRouter initialEntries={["/?room=ABC234"]}>
        <PresentationPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(presentationMock.advanceWaitingRoomGame).toHaveBeenCalledOnce();
    });
  });

  it("mostra a pergunta sem antecipar a resposta correta", () => {
    presentationMock.state.room = {
      id: "ABC234",
      phase: "question",
      presentationStatus: "active",
      createdAt: 1_000,
      participantCount: 2,
      questionNumber: 1,
      totalQuestions: 1,
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

    render(
      <MemoryRouter initialEntries={["/?room=ABC234"]}>
        <PresentationPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Qual é a capital do Brasil?")).toBeInTheDocument();
    expect(screen.getByText("1000 pontos")).toBeInTheDocument();
    expect(screen.queryByText("Brasília")).not.toBeInTheDocument();
    expect(screen.getByText("Pergunta 1 de 1")).toBeInTheDocument();
  });

  it("mostra a resposta correta somente durante a revelação", () => {
    presentationMock.state.room = {
      id: "ABC234",
      phase: "revealing",
      presentationStatus: "active",
      createdAt: 1_000,
      participantCount: 2,
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

    render(
      <MemoryRouter initialEntries={["/?room=ABC234"]}>
        <PresentationPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Resposta correta")).toBeInTheDocument();
    expect(screen.getByText("Brasília")).toBeInTheDocument();
  });
});
