import 'reflect-metadata';
import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { CharacterCode } from '@modules/characters';
import {
  AUDIT_METADATA_KEY,
  SUCCESS_MESSAGE_METADATA_KEY,
} from '@shared/presentation/metadata';
import { mockOf } from '@test/support/mocks/mock-of';
import type { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case';
import { UserRegistrationController } from '../user-registration.controller';

// Untyped record avoids @typescript-eslint/unbound-method when reading handler
// references for Reflect.getMetadata.
const registerHandler = (
  UserRegistrationController.prototype as unknown as Record<string, object>
).register;

describe('UserRegistrationController', () => {
  it('forwards only the registration fields and returns no data', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);

    const controller = new UserRegistrationController(
      mockOf<RegisterUserUseCase>({ execute }),
    );

    const result = await controller.register({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'StrongPass123!',
      characterCode: CharacterCode.SUPERMAN,
    });

    expect(execute).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'StrongPass123!',
      character: CharacterCode.SUPERMAN,
    });
    expect(result).toBeNull();
  });

  it('maps an omitted character to null', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);

    const controller = new UserRegistrationController(
      mockOf<RegisterUserUseCase>({ execute }),
    );

    await controller.register({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'StrongPass123!',
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ character: null }),
    );
  });

  it('answers 202, audits as User.register, and announces the confirmation step', () => {
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, registerHandler)).toBe(
      HttpStatus.ACCEPTED,
    );
    expect(Reflect.getMetadata(AUDIT_METADATA_KEY, registerHandler)).toBe(
      'User.register',
    );
    expect(
      Reflect.getMetadata(SUCCESS_MESSAGE_METADATA_KEY, registerHandler),
    ).toBe('users.success.registration_received');
  });
});
