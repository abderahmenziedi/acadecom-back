-- CreateTable
CREATE TABLE `quizzes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `brandId` INTEGER NOT NULL,
    `quizmasterId` INTEGER NOT NULL,
    `timeLimit` INTEGER NULL,
    `pointsPerQuestion` INTEGER NOT NULL DEFAULT 1,
    `shuffleQuestions` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `quizzes_quizmasterId_idx`(`quizmasterId`),
    INDEX `quizzes_brandId_idx`(`brandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quizId` INTEGER NOT NULL,
    `text` TEXT NOT NULL,
    `points` INTEGER NOT NULL DEFAULT 1,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `questions_quizId_idx`(`quizId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `questionId` INTEGER NOT NULL,
    `text` VARCHAR(500) NOT NULL,
    `isCorrect` BOOLEAN NOT NULL DEFAULT false,

    INDEX `options_questionId_idx`(`questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quizId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `score` INTEGER NOT NULL DEFAULT 0,
    `maxScore` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attempts_quizId_idx`(`quizId`),
    INDEX `attempts_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `answers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attemptId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,
    `isCorrect` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NULL,

    INDEX `answers_attemptId_idx`(`attemptId`),
    INDEX `answers_questionId_idx`(`questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_quizmasterId_fkey` FOREIGN KEY (`quizmasterId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `quizzes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `options` ADD CONSTRAINT `options_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attempts` ADD CONSTRAINT `attempts_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `quizzes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attempts` ADD CONSTRAINT `attempts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `options`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
