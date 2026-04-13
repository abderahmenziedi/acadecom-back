-- AlterTable
ALTER TABLE `attempts` ADD COLUMN `completedAt` DATETIME(3) NULL,
    ADD COLUMN `duration` INTEGER NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `totalPoints` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `points_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `points` INTEGER NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `attemptId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `points_history_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `points_history` ADD CONSTRAINT `points_history_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
