-- AlterTable
ALTER TABLE `Quiz` ADD COLUMN `randomizeQuestions` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Quiz` ADD COLUMN `shuffleOptions` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Question` DROP COLUMN `orderIndex`;
