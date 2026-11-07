import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseOrmEntity } from '@shared/infrastructure/persistence/base.orm-entity';
import { UserOrmEntity } from '@modules/users/infrastructure/persistence/entities/user.orm-entity';
import { ProjectStatus } from '../../../domain/enums/project-status.enum';
import { ProjectGoalOrmEntity } from './project-goal.orm-entity';

@Entity('projects')
@Check('chk_projects_progress_range', '"progress" BETWEEN 0 AND 100')
@Index('idx_projects_responsible_id', ['responsibleId'])
export class ProjectOrmEntity extends BaseOrmEntity {
  @Column({
    name: 'name',
    type: 'varchar',
    length: 150,
    nullable: false,
    comment: 'Project name.',
  })
  name!: string;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 2000,
    nullable: false,
    comment: 'Project description.',
  })
  description!: string;

  @Column({
    name: 'responsible_id',
    type: 'int',
    nullable: false,
    comment:
      'Id of the hero (USER) responsible for the project; kept when the user is deactivated or soft-deleted.',
  })
  responsibleId!: number;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'responsible_id' })
  responsible?: UserOrmEntity;

  @Column({
    name: 'progress',
    type: 'smallint',
    nullable: false,
    default: 0,
    comment:
      'Overall progress, the average of the six goals rounded down; derived, never set directly.',
  })
  progress!: number;

  @Column({
    name: 'progress_status',
    type: 'enum',
    enum: ProjectStatus,
    nullable: false,
    default: ProjectStatus.PENDING,
    comment: 'Status derived from the goals; never set directly.',
  })
  progressStatus!: ProjectStatus;

  @OneToMany(() => ProjectGoalOrmEntity, (goal) => goal.project)
  goals?: ProjectGoalOrmEntity[];

  @Column({
    name: 'created_by',
    type: 'int',
    nullable: true,
    comment: 'Id of the user who created this record.',
  })
  createdBy!: number | null;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: UserOrmEntity | null;

  @Column({
    name: 'updated_by',
    type: 'int',
    nullable: true,
    comment: 'Id of the user who last updated this record.',
  })
  updatedBy!: number | null;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: UserOrmEntity | null;

  @Column({
    name: 'deleted_by',
    type: 'int',
    nullable: true,
    comment:
      'Id of the user who soft-deleted this record; null while the record is active.',
  })
  deletedBy!: number | null;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'deleted_by' })
  deletedByUser?: UserOrmEntity | null;
}
