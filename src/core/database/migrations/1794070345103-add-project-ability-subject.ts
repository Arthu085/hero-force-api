import { MigrationInterface, QueryRunner } from 'typeorm';

// Recreates the enum instead of using ALTER TYPE ... ADD VALUE, whose new value
// cannot be used until the transaction commits. Pending migrations share one
// transaction, and GrantReadProjectToUserRole1794070369426 inserts it.
export class AddProjectAbilitySubject1794070345103 implements MigrationInterface {
  name = 'AddProjectAbilitySubject1794070345103';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_abilities_action_subject"`);
    await queryRunner.query(
      `ALTER TYPE "public"."abilities_subject_enum" RENAME TO "abilities_subject_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."abilities_subject_enum" AS ENUM('USER', 'ROLE', 'ABILITY', 'PROJECT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "abilities" ALTER COLUMN "subject" TYPE "public"."abilities_subject_enum" USING "subject"::"text"::"public"."abilities_subject_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."abilities_subject_enum_old"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_abilities_action_subject" ON "abilities" ("action", "subject")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "abilities" WHERE "subject" = 'PROJECT'`);
    await queryRunner.query(`DROP INDEX "public"."uq_abilities_action_subject"`);
    await queryRunner.query(
      `CREATE TYPE "public"."abilities_subject_enum_old" AS ENUM('USER', 'ROLE', 'ABILITY')`,
    );
    await queryRunner.query(
      `ALTER TABLE "abilities" ALTER COLUMN "subject" TYPE "public"."abilities_subject_enum_old" USING "subject"::"text"::"public"."abilities_subject_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."abilities_subject_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."abilities_subject_enum_old" RENAME TO "abilities_subject_enum"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_abilities_action_subject" ON "abilities" ("action", "subject")`,
    );
  }
}
