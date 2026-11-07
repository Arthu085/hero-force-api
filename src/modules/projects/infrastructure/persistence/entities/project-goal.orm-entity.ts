import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectGoalType } from '../../../domain/enums/project-goal-type.enum';
import { ProjectOrmEntity } from './project.orm-entity';

export const PROJECT_GOALS_UNIQUE_INDEX = 'uq_project_goals_project_goal';

@Entity('project_goals')
@Check('chk_project_goals_progress_range', '"progress" BETWEEN 0 AND 100')
@Index(PROJECT_GOALS_UNIQUE_INDEX, ['projectId', 'goal'], { unique: true })
export class ProjectGoalOrmEntity {
  @PrimaryGeneratedColumn('increment', {
    name: 'id',
    comment:
      'Surrogate auto-incrementing primary key; internal use only, never exposed over HTTP.',
  })
  id!: number;

  @Column({
    name: 'project_id',
    type: 'int',
    nullable: false,
    comment: 'Id of the project that owns the goal.',
  })
  projectId!: number;

  @ManyToOne(() => ProjectOrmEntity, (project) => project.goals, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'project_id' })
  project?: ProjectOrmEntity;

  @Column({
    name: 'goal',
    type: 'enum',
    enum: ProjectGoalType,
    nullable: false,
    comment: 'One of the six fixed project goals.',
  })
  goal!: ProjectGoalType;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: 'Optional goal description.',
  })
  description!: string | null;

  @Column({
    name: 'progress',
    type: 'smallint',
    nullable: false,
    default: 0,
    comment: 'Goal progress from 0 to 100.',
  })
  progress!: number;
}
