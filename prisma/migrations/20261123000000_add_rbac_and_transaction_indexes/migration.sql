ALTER TABLE "User" ADD COLUMN "role" VARCHAR(20) NOT NULL DEFAULT 'USER';
CREATE INDEX "Transaction_userid_data_idx" ON "Transaction"("userid", "data");
CREATE INDEX "Transaction_userid_tipo_data_idx" ON "Transaction"("userid", "tipo", "data");
CREATE INDEX "Transaction_userid_categoria_idx" ON "Transaction"("userid", "categoria");
CREATE INDEX "Transaction_userid_id_idx" ON "Transaction"("userid", "id");
