import { ForbiddenException } from '@nestjs/common';
import { rejectMktAiAutoCustomerEmail } from './mkt-ai-governance.util';

describe('mkt-ai-governance.util', () => {
  it('blocks auto customer email when flag off', () => {
    expect(() => rejectMktAiAutoCustomerEmail(false, { send_email: true })).toThrow(
      ForbiddenException,
    );
  });

  it('allows when flag on', () => {
    expect(() => rejectMktAiAutoCustomerEmail(true, { send_email: true })).not.toThrow();
  });

  it('no-op when no email requested', () => {
    expect(() => rejectMktAiAutoCustomerEmail(false, {})).not.toThrow();
  });
});
