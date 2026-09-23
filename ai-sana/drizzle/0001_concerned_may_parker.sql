CREATE TABLE `ai_usage` (
	`user_id` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL
);
