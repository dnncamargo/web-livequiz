import type { AnswerOptionShape } from "../../shared/answer-visuals";

export function AnswerOptionIcon({ shape }: { shape: AnswerOptionShape }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="presentation"
      focusable="false"
      aria-hidden="true"
    >
      {shape === "triangle" && <path d="M24 5 45 42H3L24 5Z" />}
      {shape === "diamond" && <path d="m24 3 21 21-21 21L3 24 24 3Z" />}
      {shape === "circle" && <circle cx="24" cy="24" r="20" />}
      {shape === "square" && <rect x="5" y="5" width="38" height="38" />}
      {shape === "star" && (
        <path d="m24 3 6.2 13.2 14.3 2.2-10.4 10.3 2.5 14.5L24 36.3l-12.6 6.9 2.5-14.5L3.5 18.4l14.3-2.2L24 3Z" />
      )}
      {shape === "pentagon" && (
        <path d="m24 3 21 15.3-8 24.7H11L3 18.3 24 3Z" />
      )}
    </svg>
  );
}
