import { InactiveRecordError } from '@shared/domain/errors';

export class InactiveProjectError extends InactiveRecordError {
  constructor() {
    super('projects.errors.inactive');
  }
}
