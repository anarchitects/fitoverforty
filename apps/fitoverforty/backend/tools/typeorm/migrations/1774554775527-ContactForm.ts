import { MigrationInterface, QueryRunner } from 'typeorm';
import type { FormConfig } from '@anarchitects/forms-ts/models';
import { FormConfigEntity } from '@anarchitects/forms-nest';

export class ContactForm1774554775527 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    const contactFormConfig: FormConfig = {
      id: 'contact-form',
      version: 1,
      fields: [
        {
          name: 'name',
          kind: 'string',
          required: true,
          ui: {
            label: 'Name',
            placeholder: 'Enter your name',
          },
        },
        {
          name: 'email',
          kind: 'email',
          required: true,
          ui: {
            label: 'Email',
            placeholder: 'Enter your email',
          },
        },
        {
          name: 'message',
          kind: 'textarea',
          required: true,
          ui: {
            label: 'Message',
            placeholder: 'Enter your message',
            rows: 5,
          },
        },
      ],
      security: {
        honeypot: 'website',
        captcha: 'none',
      },
      delivery: {
        adminEmail: 'info@fitoverforty.blog',
        subject: 'New Contact Form Submission',
        templateId: 'contact-form-notification',
        autoReply: {
          enabled: true,
          subject: 'Thank you for contacting us!',
          templateId: 'contact-form-autoreply',
        }
      }
    };

    await queryRunner.manager.getRepository(FormConfigEntity).save(contactFormConfig);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager
      .getRepository(FormConfigEntity)
      .delete({ id: 'contact-form' });
  }

}
