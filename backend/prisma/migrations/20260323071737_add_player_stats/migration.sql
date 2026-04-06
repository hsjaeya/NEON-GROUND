-- CreateTable
CREATE TABLE "PlayerStats" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalWagered" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "totalPayout" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "netProfit" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerStats_userId_key" ON "PlayerStats"("userId");

-- AddForeignKey
ALTER TABLE "PlayerStats" ADD CONSTRAINT "PlayerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
