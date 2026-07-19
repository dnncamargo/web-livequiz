export interface AnswerOptionVisual {
  className: string;
  shape: string;
  shapeName: string;
}

export const ANSWER_OPTION_VISUALS: readonly AnswerOptionVisual[] = [
  { className: "answer-option-red", shape: "▲", shapeName: "triângulo" },
  { className: "answer-option-blue", shape: "◆", shapeName: "losango" },
  { className: "answer-option-amber", shape: "●", shapeName: "círculo" },
  { className: "answer-option-green", shape: "■", shapeName: "quadrado" },
  { className: "answer-option-purple", shape: "★", shapeName: "estrela" },
  { className: "answer-option-orange", shape: "⬟", shapeName: "pentágono" },
] as const;

export function getAnswerOptionVisual(index: number): AnswerOptionVisual {
  return (
    ANSWER_OPTION_VISUALS[index % ANSWER_OPTION_VISUALS.length] ??
    ANSWER_OPTION_VISUALS[0]!
  );
}
