ALTER TABLE `chains` ADD `pinned_at` text;--> statement-breakpoint
UPDATE `chains` SET `pinned_at` = `last_activity_at` WHERE `kind` = 'briefing';--> statement-breakpoint
CREATE INDEX `chains_pinned_at_idx` ON `chains` (`pinned_at`);
