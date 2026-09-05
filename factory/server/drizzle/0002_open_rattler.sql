CREATE TABLE `quest_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quest_id` text NOT NULL,
	`gh_kind` text NOT NULL,
	`gh_ref` text NOT NULL,
	`state` text NOT NULL,
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quest_links_quest_kind_ref_unique` ON `quest_links` (`quest_id`,`gh_kind`,`gh_ref`);--> statement-breakpoint
CREATE TABLE `quest_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quest_id` text NOT NULL,
	`author` text NOT NULL,
	`text` text NOT NULL,
	`ts` text NOT NULL,
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quest_notes_quest_id_idx` ON `quest_notes` (`quest_id`);--> statement-breakpoint
CREATE TABLE `quests` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`title` text NOT NULL,
	`pitch` text NOT NULL,
	`status` text NOT NULL,
	`since_you_looked` text DEFAULT '' NOT NULL,
	`last_note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quests_world_id_idx` ON `quests` (`world_id`);--> statement-breakpoint
CREATE TABLE `worlds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`sort_order` integer NOT NULL,
	`icon` text NOT NULL
);
