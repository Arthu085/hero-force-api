import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCharacterToUsersAndChangeRequests1794062615618 implements MigrationInterface {
  name = 'AddCharacterToUsersAndChangeRequests1794062615618';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_character_enum" AS ENUM('SPIDER_MAN', 'IRON_MAN', 'CAPTAIN_AMERICA', 'THOR', 'BLACK_PANTHER', 'SUPERMAN', 'BATMAN', 'WONDER_WOMAN', 'THE_FLASH', 'HELLBOY', 'SPAWN', 'INVINCIBLE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "character" "public"."users_character_enum"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."character" IS 'Superhero character chosen by the user from the fixed catalog; null when none.'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_change_requests_current_character_enum" AS ENUM('SPIDER_MAN', 'IRON_MAN', 'CAPTAIN_AMERICA', 'THOR', 'BLACK_PANTHER', 'SUPERMAN', 'BATMAN', 'WONDER_WOMAN', 'THE_FLASH', 'HELLBOY', 'SPAWN', 'INVINCIBLE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_change_requests" ADD "current_character" "public"."user_change_requests_current_character_enum"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_change_requests"."current_character" IS 'Target character when the request was made; null when none.'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_change_requests_requested_character_enum" AS ENUM('SPIDER_MAN', 'IRON_MAN', 'CAPTAIN_AMERICA', 'THOR', 'BLACK_PANTHER', 'SUPERMAN', 'BATMAN', 'WONDER_WOMAN', 'THE_FLASH', 'HELLBOY', 'SPAWN', 'INVINCIBLE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_change_requests" ADD "requested_character" "public"."user_change_requests_requested_character_enum"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_change_requests"."requested_character" IS 'Character applied on approval; null removes it.'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "user_change_requests"."requested_character" IS 'Character applied on approval; null removes it.'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_change_requests" DROP COLUMN "requested_character"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."user_change_requests_requested_character_enum"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_change_requests"."current_character" IS 'Target character when the request was made; null when none.'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_change_requests" DROP COLUMN "current_character"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."user_change_requests_current_character_enum"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."character" IS 'Superhero character chosen by the user from the fixed catalog; null when none.'`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "character"`);
    await queryRunner.query(`DROP TYPE "public"."users_character_enum"`);
  }
}
