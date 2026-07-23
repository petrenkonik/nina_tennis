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

  /**
   * Обновление любого пользователя администратором: имя, фамилия.
   * (email/password/role админ через этот метод не меняет — только идентификацию.)
   */
  async updateById(id: string, data: { firstName?: string; lastName?: string }): Promise<any> {
    const update: any = {};
    if (typeof data.firstName === 'string') update.firstName = data.firstName;
    if (typeof data.lastName === 'string') update.lastName = data.lastName;
    if (Object.keys(update).length === 0) {
      return this.userModel.findById(id, { password: 0 }).exec();
    }
    const updated = await this.userModel.findByIdAndUpdate(id, { $set: update }, { new: true }).exec();
    if (!updated) return null;
    const obj = updated.toObject ? updated.toObject() : updated;
    delete obj.password;
    return obj;
  }

  /**
   * Обновление собственного профиля: имя, email, опционально пароль.
   * userId берётся из JWT (req.user) — пользователь может менять только себя.
   * email проверяется на уникальность, пароль хешируется при наличии.
   */
  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; email?: string; password?: string }): Promise<any> {
    const update: any = {};
    if (typeof data.firstName === 'string') update.firstName = data.firstName;
    if (typeof data.lastName === 'string') update.lastName = data.lastName;
    if (typeof data.email === 'string' && data.email.trim()) {
      // Проверка уникальности email (исключая текущего пользователя)
      const existing = await this.userModel.findOne({ email: data.email, _id: { $ne: userId } }).exec();
      if (existing) {
        throw new ConflictException('Email уже используется');
      }
      update.email = data.email;
    }
    if (typeof data.password === 'string' && data.password.length >= 6) {
      update.password = await bcrypt.hash(data.password, 10);
    }
    if (Object.keys(update).length === 0) {
      return this.userModel.findById(userId, { password: 0 }).exec();
    }
    const updated = await this.userModel.findByIdAndUpdate(userId, { $set: update }, { new: true }).exec();
    if (!updated) return null;
    const obj = updated.toObject ? updated.toObject() : updated;
    delete obj.password;
    return obj;
  }
} 