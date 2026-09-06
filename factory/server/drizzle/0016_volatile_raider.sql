ALTER TABLE `chains` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `chains` ADD `demo_id` text;--> statement-breakpoint
ALTER TABLE `chains` ADD `payload` text;--> statement-breakpoint
CREATE INDEX `chains_demo_id_idx` ON `chains` (`demo_id`);--> statement-breakpoint
UPDATE `chains`
SET `tags` = CASE
  WHEN `kind` = 'rumble' AND `rumble_kind` IS NOT NULL THEN json_array('rumble', `rumble_kind`)
  WHEN `kind` = 'rumble' THEN json_array('rumble')
  ELSE json_array(`kind`)
END;
--> statement-breakpoint
INSERT INTO `chains` (`kind`, `status`, `created_at`, `last_activity_at`, `quest_id`, `tags`, `demo_id`, `payload`)
SELECT
  'demo',
  CASE WHEN `demos`.`hidden_at` IS NOT NULL OR `quests`.`status` = 'done' THEN 'settled' ELSE 'open' END,
  coalesce(`demos`.`built_at`, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  coalesce(`demos`.`built_at`, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  `demos`.`quest_id`,
  CASE WHEN `demos`.`quest_id` IS NOT NULL THEN json_array('demo', `demos`.`kind`, 'quest') ELSE json_array('demo', `demos`.`kind`) END,
  `demos`.`id`,
  json_object(
    'title', `demos`.`title`, 'kind', `demos`.`kind`, 'summary', `demos`.`summary`,
    'steps', json(`demos`.`steps`), 'seeded', json(`demos`.`seeded`), 'deepLink', `demos`.`deep_link`,
    'url', CASE WHEN `demos`.`kind` = 'live' THEN coalesce(`demos`.`deep_link`, '/') ELSE '/play/' || `demos`.`id` || '/' || ltrim(coalesce(`demos`.`deep_link`, '/'), '/') END
  )
FROM `demos` LEFT JOIN `quests` ON `quests`.`id` = `demos`.`quest_id`;
--> statement-breakpoint
INSERT INTO `chain_messages` (`chain_id`, `author`, `text`, `ts`)
SELECT `chains`.`id`, 'planner', coalesce(`demos`.`summary`, `demos`.`title`), `chains`.`created_at`
FROM `chains` JOIN `demos` ON `demos`.`id` = `chains`.`demo_id`
WHERE `chains`.`kind` = 'demo';
--> statement-breakpoint
INSERT INTO `chains` (`kind`, `status`, `created_at`, `last_activity_at`, `quest_id`, `tags`, `payload`)
SELECT 'action', 'open', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL,
  json_array('action'), json_object('deepLink', `next_action_link`, 'backAt', `next_action_back_at`)
FROM `presence` WHERE `next_action_text` IS NOT NULL;
--> statement-breakpoint
INSERT INTO `chain_messages` (`chain_id`, `author`, `text`, `ts`)
SELECT `chains`.`id`, 'planner', `presence`.`next_action_text`, `chains`.`created_at`
FROM `chains` JOIN `presence` ON `presence`.`id` = 1
WHERE `chains`.`kind` = 'action' AND `chains`.`status` = 'open';
