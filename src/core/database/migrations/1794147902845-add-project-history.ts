import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProjectHistory1794147902845 implements MigrationInterface {
    name = 'AddProjectHistory1794147902845'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."project_history_type_enum" AS ENUM('PROJECT_CREATED', 'PROJECT_NAME_CHANGED', 'PROJECT_DESCRIPTION_CHANGED', 'RESPONSIBLE_HERO_CHANGED', 'GOAL_DESCRIPTION_CHANGED', 'GOAL_PROGRESS_CHANGED', 'PROJECT_DELETED')`);
        await queryRunner.query(`CREATE TYPE "public"."project_history_goal_enum" AS ENUM('AGILITY', 'DELIGHT', 'EFFICIENCY', 'EXCELLENCE', 'TRANSPARENCY', 'AMBITION')`);
        await queryRunner.query(`CREATE TABLE "project_history" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "project_id" integer NOT NULL, "actor_id" integer, "type" "public"."project_history_type_enum" NOT NULL, "goal" "public"."project_history_goal_enum", "previous_values" jsonb, "new_values" jsonb, CONSTRAINT "UQ_785ec523baf01a1e2149a78b7cd" UNIQUE ("uuid"), CONSTRAINT "PK_ebb2afe7b38faa45844bfa91211" PRIMARY KEY ("id")); COMMENT ON COLUMN "project_history"."id" IS 'Surrogate auto-incrementing primary key; internal use only, never exposed over HTTP.'; COMMENT ON COLUMN "project_history"."uuid" IS 'Public identifier exposed to clients instead of the numeric id.'; COMMENT ON COLUMN "project_history"."created_at" IS 'Timestamp when the record was created.'`);
        await queryRunner.query(`CREATE INDEX "idx_project_history_project_created_id" ON "project_history"  ("project_id", "created_at", "id") `);
        await queryRunner.query(`ALTER TABLE "project_history" ADD CONSTRAINT "FK_fba27c15eca183d4a3af4915735" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_history" ADD CONSTRAINT "FK_422cfb17266b87984cfb041a927" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "project_history" DROP CONSTRAINT "FK_422cfb17266b87984cfb041a927"`);
        await queryRunner.query(`ALTER TABLE "project_history" DROP CONSTRAINT "FK_fba27c15eca183d4a3af4915735"`);
        await queryRunner.query(`DROP INDEX "public"."idx_project_history_project_created_id"`);
        await queryRunner.query(`DROP TABLE "project_history"`);
        await queryRunner.query(`DROP TYPE "public"."project_history_goal_enum"`);
        await queryRunner.query(`DROP TYPE "public"."project_history_type_enum"`);
    }

}
