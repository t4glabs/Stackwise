import type { Role } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
    organizationId: string;
    username: string;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      organizationId: string;
      username: string;
      name: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    organizationId: string;
    username: string;
  }
}
