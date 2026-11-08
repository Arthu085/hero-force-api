import type { ProjectEntity } from '../entities/project.entity';
import type {
  ProjectHistoryChange,
  ProjectHistoryValues,
} from '../entities/project-history';
import { ProjectHistoryType } from '../enums/project-history-type.enum';

export function projectHistorySnapshot(
  project: ProjectEntity,
): ProjectHistoryValues {
  return {
    name: project.name,
    description: project.description,
    responsible: {
      uuid: project.responsible.uuid,
      name: project.responsible.name,
    },
  };
}

export function projectHistoryChanges(
  previous: ProjectEntity,
  next: ProjectEntity,
): ProjectHistoryChange[] {
  const changes: ProjectHistoryChange[] = [];

  if (previous.name !== next.name) {
    changes.push({
      type: ProjectHistoryType.PROJECT_NAME_CHANGED,
      goal: null,
      previousValues: { name: previous.name },
      newValues: { name: next.name },
    });
  }

  if (previous.description !== next.description) {
    changes.push({
      type: ProjectHistoryType.PROJECT_DESCRIPTION_CHANGED,
      goal: null,
      previousValues: { description: previous.description },
      newValues: { description: next.description },
    });
  }

  if (previous.responsible.uuid !== next.responsible.uuid) {
    changes.push({
      type: ProjectHistoryType.RESPONSIBLE_HERO_CHANGED,
      goal: null,
      previousValues: {
        responsible: {
          uuid: previous.responsible.uuid,
          name: previous.responsible.name,
        },
      },
      newValues: {
        responsible: {
          uuid: next.responsible.uuid,
          name: next.responsible.name,
        },
      },
    });
  }

  for (const current of previous.goals) {
    const updated = next.goals.find(({ goal }) => goal === current.goal);

    if (!updated) {
      continue;
    }

    if (current.description !== updated.description) {
      changes.push({
        type: ProjectHistoryType.GOAL_DESCRIPTION_CHANGED,
        goal: current.goal,
        previousValues: { description: current.description },
        newValues: { description: updated.description },
      });
    }

    if (current.progress !== updated.progress) {
      changes.push({
        type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
        goal: current.goal,
        previousValues: { progress: current.progress },
        newValues: { progress: updated.progress },
      });
    }
  }

  return changes;
}
