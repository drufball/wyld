CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` text NOT NULL,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`quest_id` text
);
--> statement-breakpoint
CREATE INDEX `events_ts_idx` ON `events` (`ts`);--> statement-breakpoint
CREATE INDEX `events_quest_id_idx` ON `events` (`quest_id`);--> statement-breakpoint
CREATE TABLE `presence` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_seen_at` text NOT NULL,
	`last_catchup_event_id` integer,
	`next_action_text` text NOT NULL,
	`next_action_link` text NOT NULL
);
