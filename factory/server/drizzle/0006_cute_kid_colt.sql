CREATE TABLE `ops_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` text NOT NULL,
	`ci_state` text NOT NULL,
	`ci_detail` text,
	`codex_prs_open` integer NOT NULL,
	`gh_rate_remaining` integer,
	`gh_rate_limit` integer,
	`tokens_today` integer
);
--> statement-breakpoint
CREATE INDEX `ops_reports_ts_idx` ON `ops_reports` (`ts`);