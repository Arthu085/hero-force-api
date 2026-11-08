import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { CoreConfigModule } from '@core/config';
import { Action } from '@shared/domain/enums/action.enum';
import { Subject } from '@shared/domain/authorization/subject';
import { ABILITY_CATALOG } from '@modules/authorization/domain/catalog/ability-catalog';
import { AbilitiesSeeder } from '@modules/authorization/infrastructure/seeds/abilities.seeder';
import { RolesSeeder } from '@modules/authorization/infrastructure/seeds/roles.seeder';
import { DatabaseModule } from '../database.module';
import { RevokeProjectManagementFromUserRole1794146671015 } from '../migrations/1794146671015-revoke-project-management-from-user-role';

describe('RevokeProjectManagementFromUserRole1794146671015 (integration)', () => {
  const migration = new RevokeProjectManagementFromUserRole1794146671015();

  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [CoreConfigModule, DatabaseModule],
    }).compile();
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    queryRunner = dataSource.createQueryRunner();
  });

  afterAll(async () => {
    await queryRunner.release();
    await moduleRef.close();
  });

  afterEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "roles", "abilities" RESTART IDENTITY CASCADE',
    );
  });

  async function grantsOf(role: string): Promise<string[]> {
    const rows: Array<{ pair: string }> = await dataSource.query(
      `
      SELECT a.action || ':' || a.subject AS pair
      FROM "role_abilities" ra
      JOIN "roles" r ON r.id = ra.role_id
      JOIN "abilities" a ON a.id = ra.ability_id
      WHERE r.name = $1
    `,
      [role],
    );

    return rows.map(({ pair }) => pair).sort();
  }

  async function seedInvalidGrants(): Promise<void> {
    await new AbilitiesSeeder().run(dataSource.manager);
    await new RolesSeeder().run(dataSource.manager);
    await dataSource.query(`
      INSERT INTO "role_abilities" (role_id, ability_id)
      SELECT r.id, a.id FROM "roles" r CROSS JOIN "abilities" a
      WHERE r.name = 'USER'
      ON CONFLICT DO NOTHING
    `);
  }

  const validUserPairs = ABILITY_CATALOG.filter(
    ({ action, subject }) =>
      subject !== Subject.PROJECT || action === Action.READ,
  )
    .map(({ action, subject }) => action + ':' + subject)
    .sort();

  it('removes only invalid USER PROJECT grants, preserves ADMIN and catalog, and is idempotent', async () => {
    await seedInvalidGrants();

    await migration.up(queryRunner);
    await migration.up(queryRunner);

    expect(await grantsOf('USER')).toEqual(validUserPairs);
    expect(await grantsOf('ADMIN')).toEqual(
      ABILITY_CATALOG.map(
        ({ action, subject }) => action + ':' + subject,
      ).sort(),
    );

    const abilities: unknown[] = await dataSource.query(
      'SELECT 1 FROM "abilities"',
    );

    expect(abilities).toHaveLength(ABILITY_CATALOG.length);
  });

  it('does not restore ineffective grants when reverted', async () => {
    await seedInvalidGrants();
    await migration.up(queryRunner);

    await migration.down();

    expect(await grantsOf('USER')).toEqual(validUserPairs);
  });

  it('does not add READ PROJECT when it was explicitly revoked', async () => {
    await seedInvalidGrants();
    await dataSource.query(
      `DELETE FROM "role_abilities" WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "name" = 'USER') AND "ability_id" IN (SELECT "id" FROM "abilities" WHERE "subject" = 'PROJECT' AND "action" = 'READ')`,
    );

    await migration.up(queryRunner);

    expect(await grantsOf('USER')).toEqual(
      validUserPairs.filter((pair) => pair !== 'READ:PROJECT'),
    );
  });

  it('is a no-op when no role or ability exists', async () => {
    await expect(migration.up(queryRunner)).resolves.toBeUndefined();
    expect(await dataSource.query('SELECT 1 FROM "role_abilities"')).toEqual(
      [],
    );
  });

  it('also removes dormant invalid grants on inactive and soft-deleted records', async () => {
    await seedInvalidGrants();
    await dataSource.query(
      `UPDATE "roles" SET "status" = 'INACTIVE', "deleted_at" = now() WHERE "name" = 'USER'`,
    );
    await dataSource.query(
      `UPDATE "abilities" SET "status" = 'INACTIVE', "deleted_at" = now() WHERE "subject" = 'PROJECT' AND "action" != 'READ'`,
    );

    await migration.up(queryRunner);

    expect(await grantsOf('USER')).toEqual(validUserPairs);
  });
});
