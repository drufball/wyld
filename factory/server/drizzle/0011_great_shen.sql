CREATE TABLE `retros` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`summary` text NOT NULL,
	`wins` text NOT NULL,
	`misses` text NOT NULL,
	`factory_improvements` text NOT NULL,
	`stats` text NOT NULL,
	`generated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `retros_date_unique` ON `retros` (`date`);--> statement-breakpoint
CREATE TABLE `sleep_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started` text NOT NULL,
	`ended` text,
	`trigger` text NOT NULL,
	`phases` text DEFAULT '[]' NOT NULL,
	`alarms_fired` text DEFAULT '[]' NOT NULL,
	`outcome` text,
	`leftovers_parked` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sleep_runs_ended_idx` ON `sleep_runs` (`ended`);