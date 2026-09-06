CREATE TABLE `pauses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lane` text NOT NULL,
	`reason` text NOT NULL,
	`fix` text,
	`since` text NOT NULL,
	`resolved_at` text,
	`rumble_id` text
);
--> statement-breakpoint
CREATE INDEX `pauses_resolved_at_idx` ON `pauses` (`resolved_at`);