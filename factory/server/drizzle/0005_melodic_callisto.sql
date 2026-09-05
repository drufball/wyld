CREATE TABLE `chain_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chain_id` integer NOT NULL,
	`author` text NOT NULL,
	`text` text NOT NULL,
	`ts` text NOT NULL,
	FOREIGN KEY (`chain_id`) REFERENCES `chains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chain_messages_chain_id_idx` ON `chain_messages` (`chain_id`);--> statement-breakpoint
CREATE TABLE `chains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`last_activity_at` text NOT NULL,
	`quest_id` text
);
--> statement-breakpoint
CREATE INDEX `chains_status_activity_idx` ON `chains` (`status`,`last_activity_at`);