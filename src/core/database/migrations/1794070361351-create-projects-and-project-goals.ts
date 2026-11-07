import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjectsAndProjectGoals1794070361351 implements MigrationInterface {
    name = 'CreateProjectsAndProjectGoals1794070361351'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."projects_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TYPE "public"."projects_progress_status_enum" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED')`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "status" "public"."projects_status_enum" NOT NULL DEFAULT 'ACTIVE', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "name" character varying(150) NOT NULL, "description" character varying(2000) NOT NULL, "responsible_id" integer NOT NULL, "progress" smallint NOT NULL DEFAULT '0', "progress_status" "public"."projects_progress_status_enum" NOT NULL DEFAULT 'PENDING', "created_by" integer, "updated_by" integer, "deleted_by" integer, CONSTRAINT "UQ_fc9f1e64d4626f18beff534a9f3" UNIQUE ("uuid"), CONSTRAINT "chk_projects_progress_range" CHECK ("progress" BETWEEN 0 AND 100), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id")); COMMENT ON COLUMN "projects"."id" IS 'Surrogate auto-incrementing primary key; internal use only, never exposed over HTTP.'; COMMENT ON COLUMN "projects"."uuid" IS 'Public identifier exposed to clients instead of the numeric id.'; COMMENT ON COLUMN "projects"."created_at" IS 'Timestamp when the record was created.'; COMMENT ON COLUMN "projects"."status" IS 'Lifecycle status of the record.'; COMMENT ON COLUMN "projects"."updated_at" IS 'Timestamp when the record was last updated.'; COMMENT ON COLUMN "projects"."deleted_at" IS 'Timestamp when the record was soft-deleted; null while the record is active.'; COMMENT ON COLUMN "projects"."name" IS 'Project name.'; COMMENT ON COLUMN "projects"."description" IS 'Project description.'; COMMENT ON COLUMN "projects"."responsible_id" IS 'Id of the hero (USER) responsible for the project; kept when the user is deactivated or soft-deleted.'; COMMENT ON COLUMN "projects"."progress" IS 'Overall progress, the average of the six goals rounded down; derived, never set directly.'; COMMENT ON COLUMN "projects"."progress_status" IS 'Status derived from the goals; never set directly.'; COMMENT ON COLUMN "projects"."created_by" IS 'Id of the user who created this record.'; COMMENT ON COLUMN "projects"."updated_by" IS 'Id of the user who last updated this record.'; COMMENT ON COLUMN "projects"."deleted_by" IS 'Id of the user who soft-deleted this record; null while the record is active.'`);
        await queryRunner.query(`CREATE INDEX "idx_projects_responsible_id" ON "projects"  ("responsible_id") `);
        await queryRunner.query(`CREATE TYPE "public"."project_goals_goal_enum" AS ENUM('AGILITY', 'DELIGHT', 'EFFICIENCY', 'EXCELLENCE', 'TRANSPARENCY', 'AMBITION')`);
        await queryRunner.query(`CREATE TABLE "project_goals" ("id" SERIAL NOT NULL, "project_id" integer NOT NULL, "goal" "public"."project_goals_goal_enum" NOT NULL, "description" character varying(500), "progress" smallint NOT NULL DEFAULT '0', CONSTRAINT "chk_project_goals_progress_range" CHECK ("progress" BETWEEN 0 AND 100), CONSTRAINT "PK_afa0ca2b32cd108f85b8937d95d" PRIMARY KEY ("id")); COMMENT ON COLUMN "project_goals"."id" IS 'Surrogate auto-incrementing primary key; internal use only, never exposed over HTTP.'; COMMENT ON COLUMN "project_goals"."project_id" IS 'Id of the project that owns the goal.'; COMMENT ON COLUMN "project_goals"."goal" IS 'One of the six fixed project goals.'; COMMENT ON COLUMN "project_goals"."description" IS 'Optional goal description.'; COMMENT ON COLUMN "project_goals"."progress" IS 'Goal progress from 0 to 100.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_project_goals_project_goal" ON "project_goals"  ("project_id", "goal") `);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_d6100a3090c9318a41798ddf40c" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_8a7ccdb94bcc8635f933c8f8080" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_458ce18ebdb792c80257bc96678" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_ea88ee694cadb4afad2af43ce54" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_goals" ADD CONSTRAINT "FK_47d8647874a4b5c9b3ed5afbe7e" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "project_goals" DROP CONSTRAINT "FK_47d8647874a4b5c9b3ed5afbe7e"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_ea88ee694cadb4afad2af43ce54"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_458ce18ebdb792c80257bc96678"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_8a7ccdb94bcc8635f933c8f8080"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_d6100a3090c9318a41798ddf40c"`);
        await queryRunner.query(`DROP INDEX "public"."uq_project_goals_project_goal"`);
        await queryRunner.query(`DROP TABLE "project_goals"`);
        await queryRunner.query(`DROP TYPE "public"."project_goals_goal_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_projects_responsible_id"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TYPE "public"."projects_progress_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
    }

}
