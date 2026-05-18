-- AlterTable Participant
ALTER TABLE `Participant` ADD COLUMN `phoneE164` VARCHAR(20) NULL;
ALTER TABLE `Participant` ADD COLUMN `gender` VARCHAR(32) NULL;
ALTER TABLE `Participant` ADD COLUMN `birthDate` DATE NULL;
ALTER TABLE `Participant` ADD COLUMN `country` VARCHAR(120) NULL;
ALTER TABLE `Participant` ADD COLUMN `city` VARCHAR(120) NULL;
ALTER TABLE `Participant` ADD COLUMN `profilePhotoUrl` VARCHAR(500) NULL;
ALTER TABLE `Participant` ADD COLUMN `isProfileComplete` BOOLEAN NOT NULL DEFAULT false;
