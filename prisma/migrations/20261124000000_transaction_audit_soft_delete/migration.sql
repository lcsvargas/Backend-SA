ALTER TABLE "Transaction"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Transaction_userid_deletedAt_data_idx"
  ON "Transaction"("userid", "deletedAt", "data");
