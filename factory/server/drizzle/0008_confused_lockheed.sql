CREATE TABLE `demos` (
	`id` text PRIMARY KEY NOT NULL,
	`quest_id` text,
	`title` text NOT NULL,
	`ref` text NOT NULL,
	`status` text NOT NULL,
	`built_at` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`demo_id` text NOT NULL,
	`quest_id` text,
	`text` text NOT NULL,
	`state` text,
	`screenshot_path` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedback_demo_id_idx` ON `feedback` (`demo_id`);