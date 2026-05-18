-- AlterTable
ALTER TABLE `Quiz` ADD COLUMN `hasPreQuestions` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `PreQuestion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quizId` INTEGER NOT NULL,
    `questionText` TEXT NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreAnswer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `preQuestionId` INTEGER NOT NULL,
    `participantId` INTEGER NOT NULL,
    `answerText` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PreAnswer_preQuestionId_participantId_key`(`preQuestionId`, `participantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PreQuestion_quizId_idx` ON `PreQuestion`(`quizId`);

-- AddForeignKey
ALTER TABLE `PreQuestion` ADD CONSTRAINT `PreQuestion_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreAnswer` ADD CONSTRAINT `PreAnswer_preQuestionId_fkey` FOREIGN KEY (`preQuestionId`) REFERENCES `PreQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreAnswer` ADD CONSTRAINT `PreAnswer_participantId_fkey` FOREIGN KEY (`participantId`) REFERENCES `Participant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
