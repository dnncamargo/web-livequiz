import { describe, expect, it } from "vitest";
import {
  getParticipantConnectionsPath,
  getParticipantPresencePath,
} from "./live-game-paths";

describe("caminhos da partida no Realtime Database", () => {
  it("monta caminhos privados normalizados", () => {
    expect(
      getParticipantPresencePath({
        gameId: " sala-123 ",
        participantId: "participante-1",
      }),
    ).toBe("liveGames/sala-123/participants/participante-1/presence");

    expect(
      getParticipantConnectionsPath({
        gameId: "sala-123",
        participantId: "participante-1",
      }),
    ).toBe(
      "liveGames/sala-123/participants/participante-1/presence/connections",
    );
  });

  it.each(["sala/invasora", "sala#invasora", "", "   "])(
    "rejeita o identificador de partida inválido %j",
    (gameId) => {
      expect(() =>
        getParticipantPresencePath({
          gameId,
          participantId: "participante-1",
        }),
      ).toThrow();
    },
  );
});
