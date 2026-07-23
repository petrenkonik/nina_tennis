import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';

/**
 * Guard, проверяющий роль пользователя. Должен идти ПОСЛЕ JwtAuthGuard
 * (который кладёт req.user). Если на эндпоинте нет @Roles — доступ разрешён
 * любому аутентифицированному пользователю.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Нет ограничения по ролям — пропускаем (аутентификацию проверит JwtAuthGuard)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав для выполнения действия');
    }
    return true;
  }
}
