-- CreateTable (cycles d'abonnement payants + historique)
CREATE TABLE `brand_subscriptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `brandId` INTEGER NOT NULL,
    `planType` ENUM('FREE', 'PRO', 'PRO_PLUS') NOT NULL,
    `lifecycle` ENUM('ACTIVE', 'EXPIRED', 'SUPERSEDED') NOT NULL DEFAULT 'ACTIVE',
    `paymentDate` DATETIME(3) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `amountMinor` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'tnd',
    `stripeCheckoutSessionId` VARCHAR(191) NULL,
    `stripePaymentIntentId` VARCHAR(191) NULL,
    `expiryWarnedAt` DATETIME(3) NULL,

    UNIQUE INDEX `brand_subscriptions_stripeCheckoutSessionId_key`(`stripeCheckoutSessionId`),
    INDEX `brand_subscriptions_brandId_idx`(`brandId`),
    INDEX `brand_subscriptions_brandId_lifecycle_idx`(`brandId`, `lifecycle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `brand_subscriptions` ADD CONSTRAINT `brand_subscriptions_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
