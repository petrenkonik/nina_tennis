import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    // Без паролей
    const users = await this.usersService['userModel'].find({}, { password: 0 }).exec();
    return users;
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (user && user.password) delete user.password;
    return user;
  }
} 