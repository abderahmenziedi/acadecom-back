-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('participant', 'brand', 'quizmaster', 'admin') NOT NULL DEFAULT 'participant',
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `brandId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
