import { MigrationInterface, QueryRunner } from "typeorm";

export class RevokeProjectManagementFromUserRole1794146671015 implements MigrationInterface {
    name = 'RevokeProjectManagementFromUserRole1794146671015'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "role_abilities" WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "name" = 'USER') AND "ability_id" IN (SELECT "id" FROM "abilities" WHERE "subject" = 'PROJECT' AND "action" IN ('CREATE', 'UPDATE', 'DELETE'))`);
    }

    public async down(): Promise<void> {}
}
