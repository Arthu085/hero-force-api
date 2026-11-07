import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  InactiveRoleError,
  ROLE_REPOSITORY,
  RoleEnum,
  RoleNotFoundError,
  type RoleEntity,
  type RoleRepository,
} from '@modules/authorization';
import type { CharacterCode } from '@modules/characters';
import { EmailType } from '@shared/domain/enums/email-type.enum';
import { assertRecordActive } from '@shared/domain/policies';
import { normalizeEmail } from '@shared/application/filters';
import {
  EMAIL_OUTBOX_PORT,
  TRANSACTION_MANAGER,
  type EmailOutboxPort,
  type ScheduleEmailResult,
  type TransactionManagerPort,
} from '@shared/application/ports';
import { UserEntity } from '../../domain/entities/user.entity';
import { EmailAlreadyInUseError } from '../../domain/errors/email-already-in-use.error';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/repositories/user.repository';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../ports/password-hasher.port';

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  character: CharacterCode | null;
}

interface Registration {
  created: UserEntity;
  confirmation: ScheduleEmailResult;
}

@Injectable()
export class RegisterUserUseCase {
  private readonly logger = new Logger(RegisterUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(EMAIL_OUTBOX_PORT)
    private readonly emailOutbox: EmailOutboxPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(input: RegisterUserInput): Promise<void> {
    const email = normalizeEmail(input.email);
    const hashedPassword = await this.passwordHasher.hash(input.password);

    let registration: Registration | null;

    try {
      registration = await this.transactionManager.runInTransaction(() =>
        this.register(input, email, hashedPassword),
      );
    } catch (error) {
      if (error instanceof EmailAlreadyInUseError) {
        return;
      }

      throw error;
    }

    if (registration && !registration.confirmation.scheduled) {
      this.logger.warn({
        msg: 'Email confirmation not scheduled',
        userId: registration.created.uuid,
        reason: registration.confirmation.reason,
      });
    }
  }

  private async register(
    input: RegisterUserInput,
    email: string,
    hashedPassword: string,
  ): Promise<Registration | null> {
    const existing = await this.userRepository.findByEmail(email);

    if (existing) {
      return null;
    }

    const role = await this.findDefaultRole();

    const created = await this.userRepository.create(
      UserEntity.create({
        uuid: randomUUID(),
        name: input.name,
        email,
        password: hashedPassword,
        roles: [role],
        character: input.character,
        createdBy: null,
      }),
    );

    const confirmation = await this.emailOutbox.schedule({
      emailType: EmailType.EMAIL_CONFIRMATION,
      recipient: created.email,
    });

    return { created, confirmation };
  }

  private async findDefaultRole(): Promise<RoleEntity> {
    const role = await this.roleRepository.findByName(RoleEnum.USER);

    if (!role) {
      throw new RoleNotFoundError();
    }

    assertRecordActive(role, new InactiveRoleError());

    return role;
  }
}
