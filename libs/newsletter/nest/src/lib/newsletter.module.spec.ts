import { createSubscriberPort } from './newsletter.module';
import { LoggingSubscriberAdapter } from './logging-subscriber.adapter';
import { MailerLiteSubscriberAdapter } from './mailerlite-subscriber.adapter';

describe('createSubscriberPort', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('falls back to logging when nothing is configured', () => {
    delete process.env['MAILERLITE_API_KEY'];
    delete process.env['MAILERLITE_GROUP_ID'];
    expect(createSubscriberPort()).toBeInstanceOf(LoggingSubscriberAdapter);
  });

  it('uses MailerLite when both values are present', () => {
    process.env['MAILERLITE_API_KEY'] = 'key';
    process.env['MAILERLITE_GROUP_ID'] = 'group';
    expect(createSubscriberPort()).toBeInstanceOf(MailerLiteSubscriberAdapter);
  });

  it('throws at boot when only half configured', () => {
    // The opposite of the mailer gotcha: a half-configured newsletter fails
    // immediately rather than at the first subscription.
    process.env['MAILERLITE_API_KEY'] = 'key';
    delete process.env['MAILERLITE_GROUP_ID'];
    expect(() => createSubscriberPort()).toThrow(/half-configured/);

    delete process.env['MAILERLITE_API_KEY'];
    process.env['MAILERLITE_GROUP_ID'] = 'group';
    expect(() => createSubscriberPort()).toThrow(/half-configured/);
  });
});
