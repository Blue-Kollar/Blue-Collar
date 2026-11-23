import { z } from 'zod';

export const revokeOtherDevicesRules = z.object({
  currentDeviceId: z.string().min(1, 'currentDeviceId is required'),
});
