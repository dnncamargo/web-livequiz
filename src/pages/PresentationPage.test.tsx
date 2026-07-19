// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PresentationPage } from "./PresentationPage";
import type { PublicWaitingRoom } from "../shared/waiting-room";

const presentationMock = vi.hoisted(() => ({
  gameId: "",
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

describe("PresentationPage", () => {
  beforeEach(() => {
    presentationMock.state.room = {
      id: "ABC234",
      name: "Quiz de Ciências",
      phase: "waiting",
      presentationStatus: "active",
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
