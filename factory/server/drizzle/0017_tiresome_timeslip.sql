CREATE TABLE `artifacts` (
	`slug` text PRIMARY KEY NOT NULL,
	`quest_id` text,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`html` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `artifacts_quest_id_idx` ON `artifacts` (`quest_id`);--> statement-breakpoint
ALTER TABLE `chains` ADD `anchor` text;