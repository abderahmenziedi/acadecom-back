-- AlterTable
ALTER TABLE `Quizmaster` ADD COLUMN `phoneE164` VARCHAR(191) NULL,
    ADD COLUMN `gender` VARCHAR(191) NULL,
    ADD COLUMN `birthDate` DATE NULL,
    ADD COLUMN `profilePhotoUrl` VARCHAR(191) NULL,
    ADD COLUMN `isProfileComplete` BOOLEAN NOT NULL DEFAULT false;
