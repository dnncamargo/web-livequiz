// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PresentationPage } from "./PresentationPage";

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
    },
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
});
