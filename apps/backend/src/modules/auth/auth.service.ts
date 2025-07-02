import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      const userObj = { ...user };
      delete userObj.password;
      return userObj;
    }
    return null;
  }

  async login(user: any) {
    // Ensure user is a plain object with all fields
    let userObj = user;
    if (user && typeof user.toObject === 'function') {
      userObj = user.toObject();
    } else if (user && user._doc) {
      userObj = user._doc;
    }
    return {
      access_token: this.jwtService.sign({ email: userObj.email, sub: userObj._id, role: userObj.role }),
      user: {
        id: userObj._id,
        email: userObj.email,
        role: userObj.role,
      },
    };
  }
} 