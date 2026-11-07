import { Body, Controller, HttpStatus } from '@nestjs/common';
import { endpoint } from '@shared/presentation/builders';
import { PublicAuthFlowThrottle } from '@shared/presentation/throttling';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { RegisterUserDto } from '../dto/input/register-user.dto';

@Controller('users')
export class UserRegistrationController {
  constructor(private readonly registerUser: RegisterUserUseCase) {}

  @(endpoint()
    .post('register')
    .public()
    .httpCode(HttpStatus.ACCEPTED)
    .audit('User.register')
    .successMessage('users.success.registration_received')
    .use(PublicAuthFlowThrottle())
    .tags('users')
    .summary('Register a new account')
    .description(
      'Public self-registration. The account always receives the USER role; roles and abilities are never read from the body. The new account must confirm its email before it can log in. An email that is already registered gets the same response, without creating or changing anything, so the route does not reveal which emails have accounts. Rate-limited like login.',
    )
    .body(RegisterUserDto)
    .build())
  async register(@Body() dto: RegisterUserDto): Promise<null> {
    await this.registerUser.execute({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      character: dto.characterCode ?? null,
    });

    return null;
  }
}
