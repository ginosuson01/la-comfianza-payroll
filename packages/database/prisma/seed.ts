import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { RoleCode, UserStatus } from "../generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const rootUsername =
  process.env.ROOT_PAYROLL_MANAGER_USERNAME?.trim() || "payroll.manager";

const rootEmail = process.env.ROOT_PAYROLL_MANAGER_EMAIL?.trim();

const rootFirstName =
  process.env.ROOT_PAYROLL_MANAGER_FIRST_NAME?.trim() || "Root";

const rootLastName =
  process.env.ROOT_PAYROLL_MANAGER_LAST_NAME?.trim() || "Payroll Manager";

if (!rootEmail) {
  throw new Error(
    "ROOT_PAYROLL_MANAGER_EMAIL is required to seed the Root Payroll Manager.",
  );
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const roles = [
  {
    code: RoleCode.PAYROLL_MANAGER,
    name: "Payroll Manager",
    description:
      "La Comfianza payroll administrator with authorized payroll management access.",
  },
  {
    code: RoleCode.COMPANY_MANAGER,
    name: "Company Manager",
    description:
      "Reserved for authorized client-company access in a future phase.",
  },
  {
    code: RoleCode.EMPLOYEE,
    name: "Employee",
    description:
      "Reserved for individual employee system access in a future phase.",
  },
] as const;

async function seedRoles() {
  console.log("Seeding roles...");

  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        code: role.code,
      },

      update: {
        name: role.name,
        description: role.description,
      },

      create: {
        code: role.code,
        name: role.name,
        description: role.description,
      },
    });
  }
}

async function seedRootPayrollManager() {
  console.log("Seeding Root Payroll Manager...");

  const payrollManagerRole = await prisma.role.findUniqueOrThrow({
    where: {
      code: RoleCode.PAYROLL_MANAGER,
    },
  });

  const rootUser = await prisma.user.upsert({
    where: {
      username: rootUsername,
    },

    update: {
      email: rootEmail,
      firstName: rootFirstName,
      lastName: rootLastName,
      jobTitle: "Root Payroll Manager",
      status: UserStatus.ACTIVE,
    },

    create: {
      username: rootUsername,
      email: rootEmail,
      firstName: rootFirstName,
      lastName: rootLastName,
      jobTitle: "Root Payroll Manager",
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: rootUser.id,
        roleId: payrollManagerRole.id,
      },
    },

    update: {},

    create: {
      userId: rootUser.id,
      roleId: payrollManagerRole.id,
    },
  });

  console.log(`Root Payroll Manager ready: ${rootUser.username}`);
}

async function main() {
  console.log("Starting database foundation seed...");

  await seedRoles();
  await seedRootPayrollManager();

  console.log("Database foundation seed completed.");
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
