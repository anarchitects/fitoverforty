import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createFastifyTestApp } from '../support/create-fastify-test-app';

describe('GET /api', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createFastifyTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return a message', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ message: 'Hello API' });
  });
});
