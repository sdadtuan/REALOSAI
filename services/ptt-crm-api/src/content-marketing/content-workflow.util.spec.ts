import { publishFromStatuses, scheduleFromStatuses } from './content-workflow.util';

describe('content-workflow.util client gate', () => {
  it('publishFromStatuses excludes approved_internal when gate on', () => {
    expect(publishFromStatuses(true)).toEqual(['scheduled']);
    expect(publishFromStatuses(false)).toContain('approved_internal');
  });

  it('scheduleFromStatuses uses client_approved when gate on', () => {
    expect(scheduleFromStatuses(true)).toEqual(['client_approved']);
    expect(scheduleFromStatuses(false)).toEqual(['approved_internal']);
  });
});
