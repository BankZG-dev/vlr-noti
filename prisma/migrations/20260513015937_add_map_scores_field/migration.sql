-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "announcementChannelId" TEXT,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "ManagedRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedMatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "team1" TEXT NOT NULL DEFAULT '',
    "team2" TEXT NOT NULL DEFAULT '',
    "event" TEXT NOT NULL DEFAULT '',
    "matchUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "notifiedWarning" BOOLEAN NOT NULL DEFAULT false,
    "notifiedLive" BOOLEAN NOT NULL DEFAULT false,
    "notifiedFinal" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "discordMessageId" TEXT,
    "discordChannelId" TEXT,
    "twitchLinks" TEXT,
    "lastMapUpdateTime" TIMESTAMP(3),
    "lastMapScores" TEXT,

    CONSTRAINT "TrackedMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_userId_guildId_type_name_key" ON "UserSubscription"("userId", "guildId", "type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedRole_guildId_type_name_key" ON "ManagedRole"("guildId", "type", "name");
