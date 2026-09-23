import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    ownerName: text("owner_name").notNull(),
    ownerEmail: text("owner_email").notNull(),
    organization: text("organization").notNull().default(""),
    status: text("status", { enum: ["draft", "published", "selected"] })
      .notNull()
      .default("draft"),
    title: text("title").notNull().default(""),
    summary: text("summary").notNull().default(""),
    problem: text("problem").notNull().default(""),
    goal: text("goal").notNull().default(""),
    context: text("context").notNull().default(""),
    audience: text("audience").notNull().default(""),
    deliverables: text("deliverables").notNull().default(""),
    constraints: text("constraints").notNull().default(""),
    timeline: text("timeline").notNull().default(""),
    acceptanceCriteria: text("acceptance_criteria").notNull().default(""),
    skillsJson: text("skills_json").notNull().default("[]"),
    qualityScore: integer("quality_score").notNull().default(0),
    selectedResponseId: text("selected_response_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    publishedAt: integer("published_at"),
  },
  (table) => [
    index("idx_tasks_catalog").on(
      table.status,
      table.qualityScore,
      table.publishedAt,
    ),
    index("idx_tasks_owner").on(table.ownerId, table.updatedAt),
  ],
);

export const responses = sqliteTable(
  "responses",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id),
    studentId: text("student_id").notNull(),
    studentName: text("student_name").notNull(),
    studentEmail: text("student_email").notNull(),
    teamName: text("team_name").notNull(),
    teamMembers: text("team_members").notNull(),
    proposal: text("proposal").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_responses_task").on(table.taskId),
    uniqueIndex("idx_responses_task_student").on(table.taskId, table.studentId),
  ],
);

export const aiUsage = sqliteTable("ai_usage", {
  userId: text("user_id").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull().default(1),
});
