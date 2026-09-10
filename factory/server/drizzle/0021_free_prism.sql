ALTER TABLE `artifacts` ADD `kind` text DEFAULT 'concept' NOT NULL;--> statement-breakpoint
CREATE INDEX `artifacts_kind_idx` ON `artifacts` (`kind`);--> statement-breakpoint
UPDATE `artifacts` SET `kind` = 'quest' WHERE `quest_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `artifacts` SET `kind` = 'roadmap' WHERE `slug` = 'roadmap';
