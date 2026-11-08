import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseTechnicalOrmEntity } from '@shared/infrastructure/persistence/base-technical.orm-entity';
import { UserOrmEntity } from '@modules/users/infrastructure/persistence/entities/user.orm-entity';
import type { ProjectHistoryValues } from '../../../domain/entities/project-history';
import { ProjectGoalType } from '../../../domain/enums/project-goal-type.enum';
import { ProjectHistoryType } from '../../../domain/enums/project-history-type.enum';
import { ProjectOrmEntity } from './project.orm-entity';

@Entity('project_history')
@Index('idx_project_history_project_created_id', [
  'projectId',
  'createdAt',
  'id',
])
export class ProjectHistoryOrmEntity extends BaseTechnicalOrmEntity {
  @Column({ name: 'project_id', type: 'int' })
  projectId!: number;

  @ManyToOne(() => ProjectOrmEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'project_id' })
  project?: ProjectOrmEntity;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId!: number | null;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor?: UserOrmEntity | null;

  @Column({ type: 'enum', enum: ProjectHistoryType })
  type!: ProjectHistoryType;

  @Column({ type: 'enum', enum: ProjectGoalType, nullable: true })
  goal!: ProjectGoalType | null;

  @Column({ name: 'previous_values', type: 'jsonb', nullable: true })
  previousValues!: ProjectHistoryValues | null;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues!: ProjectHistoryValues | null;
}
