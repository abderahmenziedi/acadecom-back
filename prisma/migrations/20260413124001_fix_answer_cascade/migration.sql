-- DropForeignKey
ALTER TABLE `answers` DROP FOREIGN KEY `answers_optionId_fkey`;

-- DropForeignKey
ALTER TABLE `answers` DROP FOREIGN KEY `answers_questionId_fkey`;

-- DropIndex
DROP INDEX `answers_optionId_fkey` ON `answers`;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `options`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
