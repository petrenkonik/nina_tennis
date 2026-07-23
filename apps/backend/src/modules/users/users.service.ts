import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createUserDto: any): Promise<any> {
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Первый зарегистрированный пользователь становится админом (чтобы можно было
    // изначально зайти в систему), все последующие — обычными пользователями.
    const userCount = await this.userModel.countDocuments().exec();
    const role: UserRole = userCount === 0 ? 'admin' : 'user';

    const createdUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
      role,
    });
    await createdUser.save();
    const userObj = createdUser.toObject ? createdUser.toObject() : createdUser;
    delete userObj.password;
    return userObj;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async findAll(): Promise<any[]> {
    // Без паролей
    const users = await this.userModel.find({}, { password: 0 }).exec();
    return users;
  }
} 