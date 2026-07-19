interface CalculateAnswerPointsInput {
  questionPoints: number;
  startedAt: number;
  durationMs: number;
  answeredAt: number;
  isCorrect: boolean;
}

export function calculateAnswerPoints({
  questionPoints,
  startedAt,
  durationMs,
  answeredAt,
  isCorrect,
}: CalculateAnswerPointsInput): number {
  if (!isCorrect || questionPoints <= 0 || durationMs <= 0) {
    return 0;
  }

  const elapsedMs = Math.min(durationMs, Math.max(0, answeredAt - startedAt));
  const remainingRatio = 1 - elapsedMs / durationMs;
  const speedMultiplier = 0.5 + remainingRatio * 0.5;

  return Math.round(questionPoints * speedMultiplier);
}
