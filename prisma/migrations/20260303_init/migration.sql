-- CreateTable users
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('participant', 'brand', 'quizmaster', 'admin') NOT NULL DEFAULT 'participant',
    `brandId` INTEGER,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_brandId_idx`(`brandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: quizmaster → brand user
ALTER TABLE `users` ADD CONSTRAINT `users_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
