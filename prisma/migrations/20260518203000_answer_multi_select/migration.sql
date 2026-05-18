-- Answer: support multiple selected options per question (JSON array)
ALTER TABLE `Answer` ADD COLUMN `selectedOptionIds` JSON NULL;

UPDATE `Answer` SET `selectedOptionIds` = JSON_ARRAY(`selectedOptionId`);

ALTER TABLE `Answer` DROP FOREIGN KEY `Answer_selectedOptionId_fkey`;

ALTER TABLE `Answer` DROP COLUMN `selectedOptionId`;

ALTER TABLE `Answer` MODIFY COLUMN `selectedOptionIds` JSON NOT NULL;
