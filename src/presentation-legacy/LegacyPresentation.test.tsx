// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicWaitingRoom } from "../shared/waiting-room";
import { LegacyPresentationPhase } from "./LegacyPresentation";

vi.mock("./legacy-public-game", () => ({
  getLegacyPresentationGameId: vi.fn().mockReturnValue(""),
  subscribeToLegacyPublicGame: vi.fn(),
}));

const publicQuestion = {
  id: "pergunta-1",
  type: "single-choice" as const,
  prompt: "Qual é a capital do Brasil?",
  position: 0,
  durationMs: 20_000,
  points: 1_000,
  options: [
    { id: "opcao-a", label: "Brasília" },
    { id: "opcao-b", label: "Salvador" },
  ],
};

describe("apresentação legacy", () => {
  afterEach(cleanup);

  it("não antecipa o gabarito durante a pergunta", () => {
    const room: PublicWaitingRoom = {
      id: "ABC234",
      phase: "question",
      createdAt: 1_000,
      participantCount: 2,
      questionNumber: 1,
      totalQuestions: 2,
      phaseTiming: { startedAt: Date.now(), durationMs: 20_000 },
      currentQuestion: publicQuestion,
    };

    render(<LegacyPresentationPhase room={room} />);

    expect(screen.getByText(publicQuestion.prompt)).toBeInTheDocument();
    expect(screen.queryByText("Resposta correta")).not.toBeInTheDocument();
    expect(screen.queryByText("Brasília")).not.toBeInTheDocument();
  });

  it("mostra o gabarito somente durante a revelação", () => {
    const room: PublicWaitingRoom = {
      id: "ABC234",
      phase: "revealing",
      createdAt: 1_000,
      participantCount: 2,
      questionNumber: 1,
      totalQuestions: 2,
      currentQuestion: publicQuestion,
      revealedCorrectOptionIds: ["opcao-a"],
    };

    render(<LegacyPresentationPhase room={room} />);

    expect(screen.getByText("Resposta correta")).toBeInTheDocument();
    expect(screen.getByText("Brasília")).toBeInTheDocument();
    expect(screen.queryByText("Salvador")).not.toBeInTheDocument();
  });

  it("interpreta ranking e pódio da projeção pública", () => {
    const rankingRoom: PublicWaitingRoom = {
      id: "ABC234",
      phase: "ranking",
      createdAt: 1_000,
      participantCount: 2,
      questionNumber: 1,
      totalQuestions: 1,
      ranking: [
        { position: 1, nickname: "Estrela", avatar: "🌟", score: 900 },
        { position: 2, nickname: "Cometa", avatar: "🚀", score: 400 },
      ],
    };
    const { rerender } = render(<LegacyPresentationPhase room={rankingRoom} />);

    expect(
      screen.getByRole("heading", { name: "Ranking" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Estrela")).toBeInTheDocument();

    rerender(
      <LegacyPresentationPhase
        room={{
          ...rankingRoom,
          phase: "podium",
          ranking: undefined,
          podium: rankingRoom.ranking,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Pódio" })).toBeInTheDocument();
    expect(screen.getByText("900 pontos")).toBeInTheDocument();
  });
});
