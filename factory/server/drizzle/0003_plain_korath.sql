CREATE TABLE `catchups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_event_id` integer NOT NULL,
	`to_event_id` integer NOT NULL,
	`digest` text NOT NULL,
	`generated_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catchups_range_generated_by_unique` ON `catchups` (`from_event_id`,`to_event_id`,`generated_by`);