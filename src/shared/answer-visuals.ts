export type AnswerOptionShape =
  "triangle" | "diamond" | "circle" | "square" | "star" | "pentagon";

export interface AnswerOptionVisual {
  className: string;
  shape: AnswerOptionShape;
  shapeName: string;
}

export const ANSWER_OPTION_VISUALS: readonly AnswerOptionVisual[] = [
  {
    className: "answer-option-red",
    shape: "triangle",
    shapeName: "triângulo",
  },
  { className: "answer-option-blue", shape: "diamond", shapeName: "losango" },
  { className: "answer-option-amber", shape: "circle", shapeName: "círculo" },
  { className: "answer-option-green", shape: "square", shapeName: "quadrado" },
  { className: "answer-option-purple", shape: "star", shapeName: "estrela" },
  {
    className: "answer-option-orange",
    shape: "pentagon",
    shapeName: "pentágono",
  },
] as const;

export function getAnswerOptionVisual(index: number): AnswerOptionVisual {
  return (
    ANSWER_OPTION_VISUALS[index % ANSWER_OPTION_VISUALS.length] ??
    ANSWER_OPTION_VISUALS[0]!
  );
}
