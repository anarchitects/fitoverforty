import {
  MailerLiteSubscriberAdapter,
  SubscriberDeliveryError,
} from './mailerlite-subscriber.adapter';

describe('MailerLiteSubscriberAdapter', () => {
  const config = {
    apiKey: 'test-key',
    groupId: 'group-1',
    apiUrl: 'https://mailerlite.test/api/subscribers',
  };

  let fetchMock: jest.SpyInstance;

  const respond = (status: number, body = '{}') =>
    (fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(body, { status })));

  afterEach(() => fetchMock?.mockRestore());

  it('creates the subscriber as unconfirmed, so the provider double opts in', async () => {
    respond(201);
    await new MailerLiteSubscriberAdapter(config).subscribe({
      email: 'reader@example.com',
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.status).toBe('unconfirmed');
    expect(body.groups).toEqual(['group-1']);
    expect(init.headers.Authorization).toBe('Bearer test-key');
  });

  it('treats an already-subscribed address as success', async () => {
    // 422 also means "already on the list". Surfacing it would tell a caller
    // whether an address is subscribed.
    respond(422, '{"message":"already exists"}');
    await expect(
      new MailerLiteSubscriberAdapter(config).subscribe({
        email: 'reader@example.com',
      }),
    ).resolves.toBeUndefined();
  });

  it('throws on a genuine provider failure', async () => {
    respond(500, 'upstream exploded');
    await expect(
      new MailerLiteSubscriberAdapter(config).subscribe({
        email: 'reader@example.com',
      }),
    ).rejects.toThrow(SubscriberDeliveryError);
  });

  it('never puts the api key in the error message', async () => {
    respond(401, 'unauthorised');
    await new MailerLiteSubscriberAdapter(config)
      .subscribe({ email: 'reader@example.com' })
      .catch((error: Error) => {
        expect(error.message).not.toContain('test-key');
      });
    expect.hasAssertions();
  });
});
