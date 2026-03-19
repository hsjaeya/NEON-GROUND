-- CreateTable
CREATE TABLE "RouletteGame" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "totalBet" DECIMAL(20,8) NOT NULL,
    "totalWin" DECIMAL(20,8) NOT NULL,
    "result" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouletteGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouletteBet" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "numbers" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "won" BOOLEAN NOT NULL,
    "payout" DECIMAL(20,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouletteBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RouletteGame_userId_idx" ON "RouletteGame"("userId");

-- CreateIndex
CREATE INDEX "RouletteGame_createdAt_idx" ON "RouletteGame"("createdAt");

-- CreateIndex
CREATE INDEX "RouletteBet_gameId_idx" ON "RouletteBet"("gameId");

-- AddForeignKey
ALTER TABLE "RouletteGame" ADD CONSTRAINT "RouletteGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouletteBet" ADD CONSTRAINT "RouletteBet_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "RouletteGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
