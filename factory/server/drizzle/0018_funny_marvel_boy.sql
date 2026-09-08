INSERT INTO `chains` (`kind`, `status`, `created_at`, `last_activity_at`, `quest_id`, `tags`, `payload`)
SELECT
  'briefing',
  'open',
  `catchups`.`created_at`,
  `catchups`.`created_at`,
  NULL,
  json_array('briefing'),
  json_patch(
    json(coalesce(`catchups`.`digest`, '{}')),
    json_object(
      'fromEventId', `catchups`.`from_event_id`,
      'toEventId', `catchups`.`to_event_id`,
      'updatedAt', `catchups`.`created_at`
    )
  )
FROM `catchups`
JOIN `presence` ON `presence`.`id` = 1
WHERE `catchups`.`to_event_id` > coalesce(`presence`.`last_catchup_event_id`, 0)
ORDER BY `catchups`.`id` DESC
LIMIT 1;
--> statement-breakpoint
INSERT INTO `chain_messages` (`chain_id`, `author`, `text`, `ts`)
SELECT `chains`.`id`, 'planner', 'Here''s where things stand.', `chains`.`created_at`
FROM `chains`
WHERE `chains`.`kind` = 'briefing'
ORDER BY `chains`.`id` DESC
LIMIT 1;
--> statement-breakpoint
DROP TABLE `catchups`;
