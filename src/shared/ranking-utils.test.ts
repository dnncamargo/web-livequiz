import { describe, expect, it } from "vitest";
import { buildPublicRanking } from "./ranking-utils";

describe("ranking público", () => {
  it("ordena pela pontuação e preserva empates", () => {
    expect(
      buildPublicRanking([
        {
          participantId: "participante-1",
          nickname: "Cometa",
          avatar: "🚀",
          score: 800,
          joinedAt: 1_000,
        },
        {
          participantId: "participante-2",
          nickname: "Estrela",
          avatar: "🌟",
          score: 1_000,
          joinedAt: 2_000,
        },
        {
          participantId: "participante-3",
          nickname: "Aurora",
          avatar: "🦊",
          score: 800,
          joinedAt: 3_000,
        },
      ]),
    ).toEqual([
      { position: 1, nickname: "Estrela", avatar: "🌟", score: 1_000 },
      { position: 2, nickname: "Aurora", avatar: "🦊", score: 800 },
      { position: 2, nickname: "Cometa", avatar: "🚀", score: 800 },
    ]);
  });

  it("não expõe o identificador interno do participante", () => {
    const [entry] = buildPublicRanking([
      {
        participantId: "uid-secreto",
        nickname: "Cometa",
        avatar: "🚀",
        score: 0,
        joinedAt: 1_000,
      },
    ]);

    expect(entry).not.toHaveProperty("participantId");
  });
});
