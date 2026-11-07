import { ForbiddenError } from '@shared/domain/errors';

export class ProjectManagementForbiddenError extends ForbiddenError {
  constructor() {
    super('projects.errors.management_forbidden');
  }
}
