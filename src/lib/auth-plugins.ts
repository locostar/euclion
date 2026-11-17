import { organization } from "better-auth/plugins";

export const authPlugins = [organization({ organizationLimit: 1 })];
