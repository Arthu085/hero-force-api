import { ValidationError } from '@shared/domain/errors';
import { UserProjectAbilitiesRestrictedError } from '../user-project-abilities-restricted.error';

describe('UserProjectAbilitiesRestrictedError', () => {
  it('is a ValidationError with a localized authorization message key', () => {
    const error = new UserProjectAbilitiesRestrictedError();

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.messageKey).toBe(
      'authorization.errors.user_project_abilities_restricted',
    );
  });
});
