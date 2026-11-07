import { BaseAuditedEntity } from '@shared/domain/entities/base-audited.entity';
import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import { PROJECT_GOAL_PROGRESS_MIN } from '../constraints/project-input.constraints';
import {
  PROJECT_GOAL_TYPES,
  ProjectGoalType,
} from '../enums/project-goal-type.enum';
import { ProjectStatus } from '../enums/project-status.enum';
import {
  calculateProjectProgress,
  deriveProjectStatus,
} from '../policies/project-progress.policy';
import type { ProjectHero } from './project-hero';

export interface ProjectGoal {
  readonly goal: ProjectGoalType;
  readonly description: string | null;
  readonly progress: number;
}

export interface ProjectGoalChange {
  goal: ProjectGoalType;
  description?: string | null;
  progress?: number;
}

export interface CreateProjectInput {
  uuid: string;
  name: string;
  description: string;
  responsible: ProjectHero;
  createdBy: number | null;
}

export interface ReconstituteProjectInput {
  id: number;
  uuid: string;
  status: RecordStatus;
  name: string;
  description: string;
  responsible: ProjectHero;
  goals: ProjectGoal[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: number | null;
  updatedBy: number | null;
  deletedBy: number | null;
}

export interface UpdateProjectDetailsInput {
  name: string;
  description: string;
  responsible: ProjectHero;
  actorId: number | null;
}

type ProjectEntityChanges = Partial<
  Pick<
    ReconstituteProjectInput,
    | 'name'
    | 'description'
    | 'responsible'
    | 'goals'
    | 'deletedAt'
    | 'updatedBy'
    | 'deletedBy'
  >
>;

function sortGoals(goals: readonly ProjectGoal[]): ProjectGoal[] {
  return [...goals].sort(
    (left, right) =>
      PROJECT_GOAL_TYPES.indexOf(left.goal) -
      PROJECT_GOAL_TYPES.indexOf(right.goal),
  );
}

export class ProjectEntity extends BaseAuditedEntity {
  readonly goals: ProjectGoal[];
  readonly progress: number;
  readonly progressStatus: ProjectStatus;

  private constructor(
    id: number,
    uuid: string,
    status: RecordStatus,
    createdAt: Date,
    updatedAt: Date,
    deletedAt: Date | null,
    createdBy: number | null,
    updatedBy: number | null,
    deletedBy: number | null,
    readonly name: string,
    readonly description: string,
    readonly responsible: ProjectHero,
    goals: readonly ProjectGoal[],
  ) {
    super(
      id,
      uuid,
      status,
      createdAt,
      updatedAt,
      deletedAt,
      createdBy,
      updatedBy,
      deletedBy,
    );

    this.goals = sortGoals(goals);
    this.progress = calculateProjectProgress(this.goals);
    this.progressStatus = deriveProjectStatus(this.goals);
  }

  static create(input: CreateProjectInput): ProjectEntity {
    const now = new Date();

    return new ProjectEntity(
      0,
      input.uuid,
      RecordStatus.ACTIVE,
      now,
      now,
      null,
      input.createdBy,
      input.createdBy,
      null,
      input.name,
      input.description,
      input.responsible,
      PROJECT_GOAL_TYPES.map((goal) => ({
        goal,
        description: null,
        progress: PROJECT_GOAL_PROGRESS_MIN,
      })),
    );
  }

  static reconstitute(input: ReconstituteProjectInput): ProjectEntity {
    return new ProjectEntity(
      input.id,
      input.uuid,
      input.status,
      input.createdAt,
      input.updatedAt,
      input.deletedAt,
      input.createdBy,
      input.updatedBy,
      input.deletedBy,
      input.name,
      input.description,
      input.responsible,
      input.goals,
    );
  }

  withDetails(input: UpdateProjectDetailsInput): ProjectEntity {
    return this.copyWith({
      name: input.name,
      description: input.description,
      responsible: input.responsible,
      updatedBy: input.actorId,
    });
  }

  withGoalChanges(
    changes: readonly ProjectGoalChange[],
    actorId: number | null,
  ): ProjectEntity {
    const changesByGoal = new Map(
      changes.map((change) => [change.goal, change]),
    );

    const goals = this.goals.map((current) => {
      const change = changesByGoal.get(current.goal);

      if (!change) {
        return current;
      }

      return {
        goal: current.goal,
        description:
          change.description === undefined
            ? current.description
            : change.description,
        progress: change.progress ?? current.progress,
      };
    });

    return this.copyWith({ goals, updatedBy: actorId });
  }

  markDeleted(actorId: number | null): ProjectEntity {
    return this.copyWith({
      deletedAt: new Date(),
      updatedBy: actorId,
      deletedBy: actorId,
    });
  }

  private copyWith(changes: ProjectEntityChanges): ProjectEntity {
    return ProjectEntity.reconstitute({
      id: this.id,
      uuid: this.uuid,
      status: this.status,
      name: this.name,
      description: this.description,
      responsible: this.responsible,
      goals: this.goals,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      deletedAt: this.deletedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      deletedBy: this.deletedBy,
      ...changes,
    });
  }
}
