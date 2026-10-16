import { betterAuth } from "better-auth";

export const auth = betterAuth({
  appName: "Evergreen Estates",

  baseURL: process.env.BETTER_AUTH_URL,

  secret: process.env.BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
  },

  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});