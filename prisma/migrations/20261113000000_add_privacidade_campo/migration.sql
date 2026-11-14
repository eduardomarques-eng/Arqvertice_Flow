-- Add LGPD consent tracking to User table
ALTER TABLE "User" ADD COLUMN "consentAcceptedAt" TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "privacyPolicyVersion" INTEGER;

-- Add PrivacyPolicy table to track privacy policy versions
CREATE TABLE "PrivacyPolicy" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PrivacyPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyPolicy_version_key" ON "PrivacyPolicy"("version");