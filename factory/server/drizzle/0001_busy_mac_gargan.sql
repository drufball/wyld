PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_presence` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_seen_at` text NOT NULL,
	`last_catchup_event_id` integer,
	`next_action_text` text,
	`next_action_link` text
);
--> statement-breakpoint
INSERT INTO `__new_presence`("id", "last_seen_at", "last_catchup_event_id", "next_action_text", "next_action_link") SELECT "id", "last_seen_at", "last_catchup_event_id", "next_action_text", "next_action_link" FROM `presence`;--> statement-breakpoint
DROP TABLE `presence`;--> statement-breakpoint
ALTER TABLE `__new_presence` RENAME TO `presence`;--> statement-breakpoint
PRAGMA foreign_keys=ON;