import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CharacterCode } from '@modules/characters';
import { CreateUserDto } from '../create-user.dto';
import { RegisterUserDto } from '../register-user.dto';
import { UpdateOwnProfileDto } from '../update-own-profile.dto';
import { UpdateUserDto } from '../update-user.dto';

const VALID_REGISTRATION = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  password: 'StrongPass123!',
};

const VALID_CREATE = {
  ...VALID_REGISTRATION,
  roleUuids: ['1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b'],
};

describe.each([
  { dtoClass: RegisterUserDto, base: VALID_REGISTRATION },
  { dtoClass: CreateUserDto, base: VALID_CREATE },
  { dtoClass: UpdateUserDto, base: {} },
  { dtoClass: UpdateOwnProfileDto, base: {} },
])('$dtoClass.name characterCode', ({ dtoClass, base }) => {
  it.each([undefined, null, CharacterCode.SPIDER_MAN])(
    'accepts %p',
    async (characterCode) => {
      const errors = await validate(
        plainToInstance(dtoClass, { ...base, characterCode }),
      );

      expect(errors).toHaveLength(0);
    },
  );

  it('rejects a code outside the catalog', async () => {
    const errors = await validate(
      plainToInstance(dtoClass, { ...base, characterCode: 'DEADPOOL' }),
    );

    expect(errors.map((error) => error.property)).toEqual(['characterCode']);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });
});

describe('RegisterUserDto', () => {
  it('requires name, email, and password', async () => {
    const errors = await validate(plainToInstance(RegisterUserDto, {}));

    expect(errors.map((error) => error.property).sort()).toEqual([
      'email',
      'name',
      'password',
    ]);
  });

  // The global ValidationPipe runs with `whitelist: true`, which strips every
  // property without validation metadata before the handler sees the DTO.
  it('carries no validation metadata for roles, abilities, or status, so the pipe strips them', async () => {
    const errors = await validate(
      plainToInstance(RegisterUserDto, {
        ...VALID_REGISTRATION,
        roleUuids: ['1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b'],
        roles: ['ADMIN'],
        abilities: [{ action: 'DELETE', subject: 'USER' }],
        status: 'ACTIVE',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors.map((error) => error.property).sort()).toEqual([
      'abilities',
      'roleUuids',
      'roles',
      'status',
    ]);
  });
});
