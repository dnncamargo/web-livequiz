import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { TemporaryConfirmButton } from "../components/TemporaryConfirmButton";
import { useAuth } from "../contexts/auth-context";
import {
  QuizLibraryRequestError,
  saveQuizContent,
} from "../features/quizzes/quiz-library";
import { useQuizDetail } from "../features/quizzes/use-quiz-detail";
import {
  QUIZ_DESCRIPTION_MAX_LENGTH,
  QUIZ_TITLE_MAX_LENGTH,
  updateQuizContentRequestSchema,
  type QuestionType,
  type QuizQuestion,
  type UpdateQuizContentRequest,
} from "../shared/quiz";

const QUESTION_TYPE_LABELS = {
  "single-choice": "Escolha única",
  "true-false": "Verdadeiro ou falso",
} as const;

const QUIZ_STATUS_LABELS = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
} as const;

function createId(prefix: "question" | "option"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createQuestion(type: QuestionType, position: number): QuizQuestion {
  const firstOptionId = createId("option");
  const secondOptionId = createId("option");

  return {
    id: createId("question"),
    type,
    prompt: "",
    position,
    durationMs: 20_000,
    points: 1_000,
    options: [
      {
        id: firstOptionId,
        label: type === "true-false" ? "Verdadeiro" : "",
      },
      {
        id: secondOptionId,
        label: type === "true-false" ? "Falso" : "",
      },
    ],
    correctOptionIds: [firstOptionId],
  };
}

interface QuestionEditorProps {
  index: number;
  type: QuestionType;
  control: Control<UpdateQuizContentRequest>;
  register: UseFormRegister<UpdateQuizContentRequest>;
  setValue: UseFormSetValue<UpdateQuizContentRequest>;
  errors: FieldErrors<UpdateQuizContentRequest>;
  disabled: boolean;
  onRemove: () => void;
}

function QuestionEditor({
  index,
  type,
  control,
  register,
  setValue,
  errors,
  disabled,
  onRemove,
}: QuestionEditorProps) {
  const {
    fields: options,
    append: appendOption,
    remove: removeOption,
  } = useFieldArray({
    control,
    name: `questions.${index}.options`,
    keyName: "fieldKey",
  });
  const correctOptionIds = useWatch({
    control,
    name: `questions.${index}.correctOptionIds`,
  });
  const questionError = errors.questions?.[index];

  function handleOptionRemoval(optionIndex: number, optionId: string) {
    const remainingOptions = options.filter(
      (_, candidateIndex) => candidateIndex !== optionIndex,
    );

    removeOption(optionIndex);

    if (correctOptionIds?.[0] === optionId && remainingOptions[0]) {
      setValue(
        `questions.${index}.correctOptionIds`,
        [remainingOptions[0].id],
        { shouldDirty: true, shouldValidate: true },
      );
    }
  }

  return (
    <article className="question-editor-card">
      <header className="question-editor-heading">
        <div>
          <span className="eyebrow">Pergunta {index + 1}</span>
          <strong>{QUESTION_TYPE_LABELS[type]}</strong>
        </div>
        <TemporaryConfirmButton
          className="danger-button compact-button"
          idleLabel="Remover pergunta"
          disabled={disabled}
          onConfirm={onRemove}
        />
      </header>

      <input type="hidden" {...register(`questions.${index}.id`)} />
      <input type="hidden" {...register(`questions.${index}.type`)} />
      <input type="hidden" {...register(`questions.${index}.position`)} />

      <div className="form-field">
        <label htmlFor={`question-${index}-prompt`}>Enunciado</label>
        <textarea
          id={`question-${index}-prompt`}
          maxLength={500}
          placeholder="Digite a pergunta que será apresentada"
          aria-invalid={Boolean(questionError?.prompt)}
          {...register(`questions.${index}.prompt`)}
        />
        {questionError?.prompt && (
          <span className="field-error">{questionError.prompt.message}</span>
        )}
      </div>

      <div className="question-settings">
        <div className="form-field">
          <label htmlFor={`question-${index}-duration`}>Duração</label>
          <select
            id={`question-${index}-duration`}
            {...register(`questions.${index}.durationMs`, {
              valueAsNumber: true,
            })}
          >
            <option value={10_000}>10 segundos</option>
            <option value={20_000}>20 segundos</option>
            <option value={30_000}>30 segundos</option>
            <option value={45_000}>45 segundos</option>
            <option value={60_000}>60 segundos</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={`question-${index}-points`}>Pontos</label>
          <input
            id={`question-${index}-points`}
            type="number"
            min={0}
            max={10_000}
            step={100}
            {...register(`questions.${index}.points`, {
              valueAsNumber: true,
            })}
          />
          {questionError?.points && (
            <span className="field-error">{questionError.points.message}</span>
          )}
        </div>
      </div>

      <fieldset className="option-editor-list">
        <legend>Alternativas e resposta correta</legend>
        {options.map((option, optionIndex) => (
          <div className="option-editor-row" key={option.fieldKey}>
            <input
              type="radio"
              name={`question-${index}-correct-option`}
              aria-label={`Marcar alternativa ${optionIndex + 1} como correta`}
              checked={correctOptionIds?.[0] === option.id}
              onChange={() =>
                setValue(`questions.${index}.correctOptionIds`, [option.id], {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            <input
              type="hidden"
              {...register(`questions.${index}.options.${optionIndex}.id`)}
            />
            <div className="form-field">
              <label
                className="sr-only"
                htmlFor={`option-${index}-${optionIndex}`}
              >
                Alternativa {optionIndex + 1}
              </label>
              <input
                id={`option-${index}-${optionIndex}`}
                maxLength={200}
                readOnly={type === "true-false"}
                placeholder={`Alternativa ${optionIndex + 1}`}
                aria-invalid={Boolean(
                  questionError?.options?.[optionIndex]?.label,
                )}
                {...register(`questions.${index}.options.${optionIndex}.label`)}
              />
              {questionError?.options?.[optionIndex]?.label && (
                <span className="field-error">
                  {questionError.options[optionIndex]?.label?.message}
                </span>
              )}
            </div>
            {type === "single-choice" && options.length > 2 && (
              <TemporaryConfirmButton
                className="danger-button compact-button"
                idleLabel="Remover"
                disabled={disabled}
                onConfirm={() => handleOptionRemoval(optionIndex, option.id)}
              />
            )}
          </div>
        ))}

        {questionError?.correctOptionIds && (
          <span className="field-error">
            {questionError.correctOptionIds.message}
          </span>
        )}

        {type === "single-choice" && options.length < 6 && (
          <button
            type="button"
            className="secondary-button compact-button"
            disabled={disabled}
            onClick={() => appendOption({ id: createId("option"), label: "" })}
          >
            Adicionar alternativa
          </button>
        )}
      </fieldset>
    </article>
  );
}

export function QuizEditorPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const detail = useQuizDetail(user, id);
  const [saveError, setSaveError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const {
    control,
    register,
    reset,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateQuizContentRequest>({
    resolver: zodResolver(updateQuizContentRequestSchema),
    defaultValues: {
      quizId: id,
      title: "",
      description: "",
      questions: [],
    },
  });
  const {
    fields: questions,
    append: appendQuestion,
    remove: removeQuestion,
  } = useFieldArray({ control, name: "questions", keyName: "fieldKey" });

  useEffect(() => {
    if (!detail.quiz) return;

    reset({
      quizId: detail.quiz.id,
      title: detail.quiz.title,
      description: detail.quiz.description,
      questions: detail.quiz.questions,
    });
  }, [detail.quiz, reset]);

  const submitQuiz = handleSubmit(async (input) => {
    if (!user) return;

    setSaveError("");
    setSavedMessage("");

    try {
      const quiz = await saveQuizContent(user, input);
      reset({
        quizId: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questions: quiz.questions,
      });
      setSavedMessage("Alterações salvas.");
    } catch (error) {
      console.error("Erro ao salvar quiz:", error);
      setSaveError(
        error instanceof QuizLibraryRequestError
          ? error.message
          : "Não foi possível salvar o quiz.",
      );
    }
  });

  if (detail.loading) {
    return (
      <main className="page" aria-busy="true">
        <section className="card" role="status">
          <span className="eyebrow">Editor de quiz</span>
          <h1>Carregando...</h1>
        </section>
      </main>
    );
  }

  if (!detail.quiz) {
    return (
      <main className="page">
        <section className="card">
          <span className="eyebrow">Editor de quiz</span>
          <h1>Quiz indisponível</h1>
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível abrir o quiz</strong>
            <p>{detail.error ?? "O quiz não foi encontrado."}</p>
          </div>
          <Link to="/admin/quizzes">Voltar aos quizzes</Link>
        </section>
      </main>
    );
  }

  const readOnly = detail.quiz.status === "archived";

  return (
    <main className="page quiz-editor-page">
      <form className="quiz-editor" onSubmit={submitQuiz}>
        <header className="quiz-editor-header">
          <div>
            <span className="eyebrow">Editor de quiz</span>
            <h1>{detail.quiz.title}</h1>
            <span className={`room-status quiz-status-${detail.quiz.status}`}>
              {QUIZ_STATUS_LABELS[detail.quiz.status]}
            </span>
          </div>
          <Link className="secondary-button compact-button" to="/admin/quizzes">
            Voltar aos quizzes
          </Link>
        </header>

        {readOnly && (
          <div className="test-result test-result-error" role="alert">
            <strong>Quiz arquivado</strong>
            <p>Restaure este quiz pelo Arquivo antes de editá-lo.</p>
          </div>
        )}

        {saveError && (
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível salvar</strong>
            <p>{saveError}</p>
          </div>
        )}

        {savedMessage && (
          <div className="test-result test-result-success" role="status">
            <strong>{savedMessage}</strong>
          </div>
        )}

        <fieldset
          className="quiz-editor-fields"
          disabled={readOnly || isSubmitting}
        >
          <input type="hidden" {...register("quizId")} />

          <section className="card quiz-metadata-editor">
            <div className="form-field">
              <label htmlFor="editor-quiz-title">Título</label>
              <input
                id="editor-quiz-title"
                maxLength={QUIZ_TITLE_MAX_LENGTH}
                aria-invalid={Boolean(errors.title)}
                {...register("title")}
              />
              {errors.title && (
                <span className="field-error">{errors.title.message}</span>
              )}
            </div>
            <div className="form-field">
              <label htmlFor="editor-quiz-description">Descrição</label>
              <textarea
                id="editor-quiz-description"
                maxLength={QUIZ_DESCRIPTION_MAX_LENGTH}
                {...register("description")}
              />
              {errors.description && (
                <span className="field-error">
                  {errors.description.message}
                </span>
              )}
            </div>
          </section>

          <section
            className="quiz-question-editor"
            aria-labelledby="questions-title"
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">Conteúdo</span>
                <h2 id="questions-title">Perguntas</h2>
              </div>
              <span>{questions.length} pergunta(s)</span>
            </div>

            {questions.length === 0 && (
              <div className="empty-library">
                <strong>Nenhuma pergunta</strong>
                <p>Adicione uma pergunta para preparar este quiz.</p>
              </div>
            )}

            {questions.map((question, index) => (
              <QuestionEditor
                key={question.fieldKey}
                index={index}
                type={question.type}
                control={control}
                register={register}
                setValue={setValue}
                errors={errors}
                disabled={readOnly || isSubmitting}
                onRemove={() => removeQuestion(index)}
              />
            ))}

            <div className="quiz-question-actions">
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={readOnly || isSubmitting}
                onClick={() =>
                  appendQuestion(
                    createQuestion("single-choice", questions.length),
                  )
                }
              >
                Adicionar escolha única
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={readOnly || isSubmitting}
                onClick={() =>
                  appendQuestion(createQuestion("true-false", questions.length))
                }
              >
                Adicionar verdadeiro ou falso
              </button>
            </div>
          </section>

          <footer className="quiz-editor-save-bar">
            <span>
              {isDirty ? "Há alterações não salvas." : "Conteúdo atualizado."}
            </span>
            <button
              type="submit"
              className="primary-button"
              disabled={readOnly || isSubmitting || !isDirty}
            >
              {isSubmitting ? "Salvando..." : "Salvar quiz"}
            </button>
          </footer>
        </fieldset>
      </form>
    </main>
  );
}
