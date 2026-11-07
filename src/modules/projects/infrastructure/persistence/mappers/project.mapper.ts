import type { ProjectHero } from '../../../domain/entities/project-hero';
import { ProjectEntity } from '../../../domain/entities/project.entity';
import { ProjectGoalOrmEntity } from '../entities/project-goal.orm-entity';
import { ProjectOrmEntity } from '../entities/project.orm-entity';

export class ProjectMapper {
  static toDomain(orm: ProjectOrmEntity): ProjectEntity {
    if (!orm.responsible) {
      throw new Error(`Project ${orm.uuid} was loaded without its responsible`);
    }

    return ProjectEntity.reconstitute({
      id: orm.id,
      uuid: orm.uuid,
      status: orm.status,
      name: orm.name,
      description: orm.description,
      responsible: ProjectMapper.heroToDomain(orm.responsible),
      goals: (orm.goals ?? []).map((goal) => ({
        goal: goal.goal,
        description: goal.description,
        progress: goal.progress,
      })),
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
      deletedAt: orm.deletedAt,
      createdBy: orm.createdBy,
      updatedBy: orm.updatedBy,
      deletedBy: orm.deletedBy,
    });
  }

  static toOrm(domain: ProjectEntity): ProjectOrmEntity {
    const orm = new ProjectOrmEntity();

    if (domain.id > 0) {
      orm.id = domain.id;
      orm.updatedAt = domain.updatedAt;
    }

    orm.uuid = domain.uuid;
    orm.status = domain.status;
    orm.name = domain.name;
    orm.description = domain.description;
    orm.responsibleId = domain.responsible.id;
    orm.progress = domain.progress;
    orm.progressStatus = domain.progressStatus;
    orm.createdBy = domain.createdBy;
    orm.updatedBy = domain.updatedBy;
    orm.deletedBy = domain.deletedBy;
    orm.deletedAt = domain.deletedAt;

    return orm;
  }

  static goalsToOrm(
    projectId: number,
    domain: ProjectEntity,
  ): ProjectGoalOrmEntity[] {
    return domain.goals.map((goal) => {
      const orm = new ProjectGoalOrmEntity();

      orm.projectId = projectId;
      orm.goal = goal.goal;
      orm.description = goal.description;
      orm.progress = goal.progress;

      return orm;
    });
  }

  static heroToDomain(orm: {
    id: number;
    uuid: string;
    name: string;
    character: ProjectHero['character'];
  }): ProjectHero {
    return {
      id: orm.id,
      uuid: orm.uuid,
      name: orm.name,
      character: orm.character,
    };
  }
}
