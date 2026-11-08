import { ProjectHistoryType } from '../../../../domain/enums/project-history-type.enum';
import { ProjectHistoryResponseDto } from '../project-history.response';

describe('ProjectHistoryResponseDto', () => {
  it('exposes explicit history fields and only the actor public identity', () => {
    const actor = {
      uuid: 'actor',
      name: 'History actor',
      email: 'private@example.com',
    };

    const entry = {
      uuid: 'event',
      type: ProjectHistoryType.PROJECT_CREATED,
      createdAt: new Date(),
      actor,
      goal: null,
      previousValues: null,
      newValues: { name: 'Project' },
    };

    const dto = ProjectHistoryResponseDto.fromDomain(entry);

    expect(dto).toEqual({
      ...entry,
      actor: { uuid: 'actor', name: 'History actor' },
    });
    expect(JSON.stringify(dto)).not.toContain('private@example.com');
    expect(
      ProjectHistoryResponseDto.fromDomain({ ...entry, actor: null }).actor,
    ).toBeNull();
  });
});
