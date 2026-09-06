ALTER TABLE `chains` ADD `kind` text DEFAULT 'question' NOT NULL;--> statement-breakpoint
ALTER TABLE `chains` ADD `snoozed_until` text;--> statement-breakpoint
ALTER TABLE `chains` ADD `slug` text;--> statement-breakpoint
ALTER TABLE `chains` ADD `title` text;--> statement-breakpoint
ALTER TABLE `chains` ADD `context` text;--> statement-breakpoint
ALTER TABLE `chains` ADD `options` text;--> statement-breakpoint
ALTER TABLE `chains` ADD `chosen` text;--> statement-breakpoint
ALTER TABLE `chains` ADD `chosen_at` text;--> statement-breakpoint
ALTER TABLE `chains` ADD `blocking_quest_ids` text;--> statement-breakpoint
ALTER TABLE `chains` ADD `rumble_kind` text;--> statement-breakpoint
CREATE INDEX `chains_kind_idx` ON `chains` (`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `chains_slug_unique` ON `chains` (`slug`);--> statement-breakpoint
UPDATE chains SET kind = 'message' WHERE (SELECT author FROM chain_messages WHERE chain_id = chains.id ORDER BY id LIMIT 1) = 'planner';--> statement-breakpoint
INSERT INTO chains (kind, status, created_at, last_activity_at, quest_id, snoozed_until, slug, title, context, options, chosen, chosen_at, blocking_quest_ids, rumble_kind)
SELECT 'rumble', CASE WHEN chosen IS NULL THEN 'open' ELSE 'settled' END, created_at, COALESCE(chosen_at, created_at), NULL, NULL, id, title, context, options, chosen, chosen_at, blocking_quest_ids, kind FROM rumbles;--> statement-breakpoint
DROP TABLE `rumbles`;
