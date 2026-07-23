import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../src/modules/users/schemas/user.schema';
import * as bcrypt from 'bcryptjs';

jest.setTimeout(60000);

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let userModel: Model<UserDocument>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    userModel = moduleFixture.get<Model<UserDocument>>(getModelToken(User.name));

    // Очищаем коллекцию пользователей и создаём одного admin-пользователя напрямую,
    // без запуска npm run seed (тот качает аватарки из интернета и медленный).
    await userModel.deleteMany({});
    await userModel.create({
      email: 'seedadmin@example.com',
      password: await bcrypt.hash('admin', 10),
      role: 'admin',
      firstName: 'Seed',
      lastName: 'Admin',
    });
  });

  afterAll(async () => {
    if (userModel) {
      await userModel.deleteMany({ email: 'admin@example.com' });
    }
    await app.close();
  });

  it('should register a new user (seed already created first admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
      })
      .expect(201);

    expect(res.body.user.email).toBe('admin@example.com');
    // Seed уже создал первого пользователя (admin), поэтому этот — обычный user.
    // Логика: первый зарегистрированный = admin, остальные = user.
    expect(res.body.user.role).toBe('user');
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.access_token).toBeDefined();
  });

  it('should not register duplicate admin', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'admin123',
      })
      .expect(409);
  });

  it('should login as admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123',
      })
      .expect(201);

    expect(res.body.user.email).toBe('admin@example.com');
    expect(res.body.access_token).toBeDefined();
  });

  it('should not login with wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'wrongpass',
      })
      .expect(401);
  });

  it('should get profile with valid JWT', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123',
      });

    const token = loginRes.body.access_token;

    const res = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    console.log('PROFILE RESPONSE:', res.body);
    expect(res.body.email).toBe('admin@example.com');
    // admin@example.com — второй пользователь (после seed), поэтому role='user'.
    expect(res.body.role).toBe('user');
  });

  it('should not get profile with invalid JWT', async () => {
    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', 'Bearer invalidtoken')
      .expect(401);
  });
}); 