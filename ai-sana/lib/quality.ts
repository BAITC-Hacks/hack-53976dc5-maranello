export type TaskDraft = {
  title?: string;
  summary?: string;
  problem?: string;
  goal?: string;
  context?: string;
  audience?: string;
  deliverables?: string;
  constraints?: string;
  timeline?: string;
  acceptanceCriteria?: string;
  skills?: string[];
};

export type QualityCriterion = {
  key: keyof TaskDraft;
  label: string;
  points: number;
  earned: number;
  suggestion: string | null;
  explanation?: string;
};

export type QualityResult = {
  score: number;
  level: "draft" | "developing" | "ready" | "strong";
  criteria: QualityCriterion[];
  nextSteps: string[];
};

type TextCriterion = {
  key: Exclude<keyof TaskDraft, "skills">;
  label: string;
  points: number;
  minimum: number;
  suggestion: string;
};

const textCriteria: TextCriterion[] = [
  {
    key: "title",
    label: "Название",
    points: 5,
    minimum: 12,
    suggestion:
      "Назовите задачу так, чтобы по названию был понятен предмет работы.",
  },
  {
    key: "summary",
    label: "Краткое описание",
    points: 8,
    minimum: 40,
    suggestion: "За 1–2 предложения объясните, что предстоит сделать.",
  },
  {
    key: "problem",
    label: "Проблема",
    points: 15,
    minimum: 80,
    suggestion: "Опишите текущую ситуацию и конкретную трудность бизнеса.",
  },
  {
    key: "goal",
    label: "Желаемый результат",
    points: 15,
    minimum: 60,
    suggestion:
      "Опишите результат, который должен измениться после выполнения задачи.",
  },
  {
    key: "context",
    label: "Контекст",
    points: 8,
    minimum: 50,
    suggestion:
      "Добавьте сведения о процессе, данных или существующем решении.",
  },
  {
    key: "audience",
    label: "Кому это нужно",
    points: 8,
    minimum: 25,
    suggestion: "Укажите людей, которые будут пользоваться результатом.",
  },
  {
    key: "deliverables",
    label: "Что нужно передать",
    points: 12,
    minimum: 45,
    suggestion:
      "Перечислите ожидаемые материалы, функции или другие результаты работы.",
  },
  {
    key: "constraints",
    label: "Ограничения",
    points: 7,
    minimum: 25,
    suggestion: "Укажите важные рамки либо прямо напишите, что их пока нет.",
  },
  {
    key: "timeline",
    label: "Срок",
    points: 7,
    minimum: 12,
    suggestion:
      "Укажите ориентир по сроку или дату, к которой нужен результат.",
  },
  {
    key: "acceptanceCriteria",
    label: "Критерии приёмки",
    points: 10,
    minimum: 45,
    suggestion: "Опишите, как бизнес поймёт, что работа выполнена успешно.",
  },
];

export const qualityLevels = {
  draft: { label: "Первые наброски", next: 40 },
  developing: { label: "Есть основа", next: 70 },
  ready: { label: "Понятная задача", next: 85 },
  strong: { label: "Подробный бриф", next: 100 },
};

function normalize(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
}

export function evaluateTaskQuality(task: TaskDraft): QualityResult {
  const criteria: QualityCriterion[] = textCriteria.map((criterion) => {
    const value = normalize(task[criterion.key]);
    const words = value.match(/[\p{L}\p{N}]+/gu) ?? [];
    const unique = new Set(words).size;
    const placeholder =
      /^(тест|нет|потом|не знаю|asdf|test|lorem ipsum|заполнить|уточнить)[.!?]*$/iu.test(
        value,
      );
    const filler = /(.)\1{7,}/u.test(value) || (words.length > 5 && unique < 3);
    const duplicate =
      ["problem", "goal", "deliverables", "acceptanceCriteria"].includes(
        criterion.key,
      ) &&
      Object.entries(task).some(
        ([key, text]) =>
          key !== criterion.key &&
          ["problem", "goal", "deliverables", "acceptanceCriteria"].includes(
            key,
          ) &&
          typeof text === "string" &&
          value.length > 15 &&
          normalize(text) === value,
      );
    const substantive =
      value.length >= criterion.minimum &&
      unique >=
        (criterion.key === "title" || criterion.key === "timeline" ? 2 : 4) &&
      !duplicate;
    const earned =
      !value || placeholder || filler
        ? 0
        : substantive
          ? criterion.points
          : Math.ceil(criterion.points / 2);
    return {
      key: criterion.key,
      label: criterion.label,
      points: criterion.points,
      earned,
      suggestion: earned === criterion.points ? null : criterion.suggestion,
      explanation: !value
        ? "Поле не заполнено"
        : placeholder || filler
          ? "Замените заглушку содержательным описанием"
          : duplicate
            ? "Здесь повторяется другое поле — уточните смысл"
            : substantive
              ? "Есть развёрнутое описание"
              : "Описание есть, но стоит добавить конкретику",
    };
  });

  const skillCount = new Set(
    (task.skills ?? [])
      .map((skill) => skill.trim().toLocaleLowerCase())
      .filter(Boolean),
  ).size;
  criteria.push({
    key: "skills",
    label: "Нужные навыки",
    points: 5,
    earned: skillCount >= 2 ? 5 : skillCount === 1 ? 3 : 0,
    suggestion:
      skillCount >= 2
        ? null
        : "Укажите хотя бы два навыка, которые помогут выполнить задачу.",
  });

  const score = criteria.reduce(
    (total, criterion) => total + criterion.earned,
    0,
  );
  const level =
    score >= 85
      ? "strong"
      : score >= 70
        ? "ready"
        : score >= 40
          ? "developing"
          : "draft";
  const nextSteps = criteria
    .filter((criterion) => criterion.suggestion)
    .sort((a, b) => b.points - b.earned - (a.points - a.earned))
    .slice(0, 3)
    .map((criterion) => criterion.suggestion as string);

  return { score, level, criteria, nextSteps };
}
