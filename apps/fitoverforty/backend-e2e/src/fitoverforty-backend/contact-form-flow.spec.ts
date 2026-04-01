import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createFastifyTestApp } from '../support/create-fastify-test-app';

describe('contact form flow', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createFastifyTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('retrieves form definition and submits contact form payload', async () => {
    const definitionResponse = await app.inject({
      method: 'GET',
      url: '/forms/contact-form?formVersion=1',
    });
    const definitionData = JSON.parse(definitionResponse.payload);

    expect(definitionResponse.statusCode).toBe(200);
    expect(definitionData).toEqual(
      expect.objectContaining({
        config: expect.objectContaining({
          id: 'contact-form',
          version: 1,
          fields: expect.any(Array),
        }),
      }),
    );

    const submissionInput = {
      formId: 'contact-form',
      formVersion: 1,
      payload: {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        message: 'Testing contact form flow end-to-end.',
      },
    };

    const submissionResponse = await app.inject({
      method: 'POST',
      url: '/forms/submit',
      payload: submissionInput,
      headers: {
        'content-type': 'application/json',
      },
    });
    const submissionData = JSON.parse(submissionResponse.payload);

    expect(submissionResponse.statusCode).toBe(200);
    expect(submissionData).toEqual(
      expect.objectContaining({
        formId: 'contact-form',
        formVersion: 1,
        payload: expect.objectContaining(submissionInput.payload),
      }),
    );
  });
});
