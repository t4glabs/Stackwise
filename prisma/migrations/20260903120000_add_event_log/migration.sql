-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EventLog_organizationId_createdAt_idx" ON "EventLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_organizationId_level_createdAt_idx" ON "EventLog"("organizationId", "level", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_email_idx" ON "EventLog"("email");
