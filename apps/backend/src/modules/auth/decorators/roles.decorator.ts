import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/schemas/user.schema';

export const ROLES_KEY = 'roles';

/**
 * Декоратор для указания ролей, которым разрешён доступ к эндпоинту.
 * Используется вместе с RolesGuard и JwtAuthGuard:
 *
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('admin')
 *
 * Если роли не указаны — доступ разрешён любому аутентифицированному.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
