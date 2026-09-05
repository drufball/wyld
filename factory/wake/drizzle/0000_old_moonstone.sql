CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` text NOT NULL,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`quest` text,
	`issue` integer,
	`pr` integer,
	`url` text,
	`summary` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`delivered_at` text
);
--> statement-breakpoint
CREATE INDEX `messages_delivered_at_idx` ON `messages` (`delivered_at`);