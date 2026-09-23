CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`student_email` text NOT NULL,
	`team_name` text NOT NULL,
	`team_members` text NOT NULL,
	`proposal` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_responses_task` ON `responses` (`task_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_responses_task_student` ON `responses` (`task_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`owner_name` text NOT NULL,
	`owner_email` text NOT NULL,
	`organization` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`problem` text DEFAULT '' NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`deliverables` text DEFAULT '' NOT NULL,
	`constraints` text DEFAULT '' NOT NULL,
	`timeline` text DEFAULT '' NOT NULL,
	`acceptance_criteria` text DEFAULT '' NOT NULL,
	`skills_json` text DEFAULT '[]' NOT NULL,
	`quality_score` integer DEFAULT 0 NOT NULL,
	`selected_response_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_catalog` ON `tasks` (`status`,`quality_score`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_owner` ON `tasks` (`owner_id`,`updated_at`);