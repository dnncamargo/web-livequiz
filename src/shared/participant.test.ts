import { describe, expect, it } from "vitest";
import {
  joinParticipantRequestSchema,
  participantNicknameSchema,
} from "./participant";

describe("contratos do participante", () => {
  it("normaliza código e espaços do nickname", () => {
    expect(
      joinParticipantRequestSchema.parse({
        gameId: " abc234 ",
        nickname: "  Estrela   Azul  ",
      }),
    ).toEqual({ gameId: "ABC234", nickname: "Estrela Azul" });
  });

  it("rejeita nickname curto, excessivo ou com símbolos não permitidos", () => {
    expect(participantNicknameSchema.safeParse("A").success).toBe(false);
    expect(participantNicknameSchema.safeParse("A".repeat(21)).success).toBe(
      false,
    );
    expect(participantNicknameSchema.safeParse("Jogador<script>").success).toBe(
      false,
    );
  });
});
