import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../src/modules/users/schemas/user.schema';
import { spawn } from 'child_process';

jest.setTimeout(30000);

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('npm', ['run', 'seed'], { cwd: __dirname + '/../', stdio: 'inherit', shell: true });
      proc.on('close', code => (code === 0 ? resolve() : reject(new Error('Seed failed'))));
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should register a new admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'admin',
        firstName: 'Admin',
        lastName: 'User',
      })
      .expect(201);

    expect(res.body.user.email).toBe('admin@example.com');
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.access_token).toBeDefined();
  });

  it('should not register duplicate admin', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'admin',
      })
      .expect(409);
  });

  it('should login as admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin',
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
        password: 'admin',
      });

    const token = loginRes.body.access_token;

    const res = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    console.log('PROFILE RESPONSE:', res.body);
    expect(res.body.email).toBe('admin@example.com');
    expect(res.body.role).toBe('admin');
  });

  it('should not get profile with invalid JWT', async () => {
    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', 'Bearer invalidtoken')
      .expect(401);
  });
}); 