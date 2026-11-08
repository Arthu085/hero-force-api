import { ValidationError } from '@shared/domain/errors';

export class UserProjectAbilitiesRestrictedError extends ValidationError {
  constructor() {
    super('authorization.errors.user_project_abilities_restricted');
  }
}
