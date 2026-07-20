import type { ParticipantAvatar } from "./avatar.js";
import type { PublicRankingEntry } from "./waiting-room.js";

export interface RankingParticipant {
  participantId: string;
  nickname: string;
  avatar: ParticipantAvatar;
  score: number;
  joinedAt: number;
}

export function buildPublicRanking(
  participants: RankingParticipant[],
): PublicRankingEntry[] {
  const orderedParticipants = [...participants].sort((first, second) => {
    if (first.score !== second.score) {
      return second.score - first.score;
    }

    const nicknameOrder = first.nickname.localeCompare(
      second.nickname,
      "pt-BR",
      { sensitivity: "base" },
    );

    if (nicknameOrder !== 0) {
      return nicknameOrder;
    }

    if (first.joinedAt !== second.joinedAt) {
      return first.joinedAt - second.joinedAt;
    }

    return first.participantId.localeCompare(second.participantId);
  });

  let previousScore: number | null = null;
  let previousPosition = 0;

  return orderedParticipants.map((participant, index) => {
    const position =
      previousScore === participant.score ? previousPosition : index + 1;
    previousScore = participant.score;
    previousPosition = position;

    return {
      position,
      nickname: participant.nickname,
      avatar: participant.avatar,
      score: participant.score,
    };
  });
}
