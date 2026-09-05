CREATE TABLE `rumbles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`context` text NOT NULL,
	`options` text NOT NULL,
	`chosen` text,
	`chosen_at` text,
	`blocking_quest_ids` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rumbles_chosen_at_idx` ON `rumbles` (`chosen_at`);