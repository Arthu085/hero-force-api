import { MigrationInterface, QueryRunner } from 'typeorm';

export class GrantReadProjectToUserRole1794070369426 implements MigrationInterface {
  name = 'GrantReadProjectToUserRole1794070369426';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "abilities" ("action", "subject") VALUES ('READ', 'PROJECT') ON CONFLICT ("action", "subject") DO NOTHING`,
    );
    await queryRunner.query(
      `INSERT INTO "role_abilities" ("role_id", "ability_id") SELECT "roles"."id", "abilities"."id" FROM "roles" CROSS JOIN "abilities" WHERE "roles"."name" = 'USER' AND "abilities"."action" = 'READ' AND "abilities"."subject" = 'PROJECT' ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "role_abilities" WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "name" = 'USER') AND "ability_id" IN (SELECT "id" FROM "abilities" WHERE "action" = 'READ' AND "subject" = 'PROJECT')`,
    );
  }
}
