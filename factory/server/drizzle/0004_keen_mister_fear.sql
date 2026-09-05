CREATE TABLE `health` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` text NOT NULL,
	`planner_state` text NOT NULL,
	`current_task` text,
	`wake_queue_depth` integer,
	`gh_rate_remaining` integer,
	`ci_state` text,
	`cost_today` real,
	`codex_prs_open` integer,
	`paused_reason` text
);
--> statement-breakpoint
CREATE INDEX `health_ts_idx` ON `health` (`ts`);