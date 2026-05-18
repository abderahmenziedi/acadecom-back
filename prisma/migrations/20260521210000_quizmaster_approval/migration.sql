-- AlterTable: validation brand obligatoire pour nouveaux quizmasters
ALTER TABLE `Quizmaster` ADD COLUMN `approvalStatus` ENUM('PENDING', 'ACTIVE', 'REJECTED') NOT NULL DEFAULT 'ACTIVE';

UPDATE `Quizmaster` SET `approvalStatus` = 'ACTIVE' WHERE TRUE;
