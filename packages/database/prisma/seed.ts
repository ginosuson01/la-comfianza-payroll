import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { ConfigStatus, RoleCode, UserStatus } from "../generated/prisma/enums";

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

const GOLDEN_PAYROLL_TEMPLATE_CODE = "PH_STANDARD_PAYROLL";
const GOLDEN_PAYROLL_TEMPLATE_NAME = "Philippine Standard Payroll";
const GOLDEN_PAYROLL_TEMPLATE_DESCRIPTION =
  "Effective-dated Philippine statutory and payroll-rule foundation used to resolve company payroll setup versions.";

const GOLDEN_PAYROLL_TEMPLATE_INITIAL_VERSION = 1;
const GOLDEN_PAYROLL_TEMPLATE_INITIAL_VERSION_NAME =
  "Philippine Standard Payroll — Initial Statutory Baseline";

const GOLDEN_PAYROLL_TEMPLATE_INITIAL_EFFECTIVE_FROM =
  new Date("2026-01-06T00:00:00.000Z");

const GOLDEN_PAYROLL_TEMPLATE_INITIAL_CONFIG = {
  schemaVersion: 1,
  jurisdiction: "PH",

  statutory: {
    sss: {
      effectiveFrom: "2025-01-01",

      minimumMsc: "5000.00",
      maximumMsc: "35000.00",
      mscStep: "500.00",
      mscMidpoint: "250.00",

      regularSocialSecurityMaximumMsc: "20000.00",

      employeeRate: "0.0500",
      employerRate: "0.1000",

      mandatoryProvidentFund: {
        startsAboveMsc: "20000.00",
        employeeRate: "0.0500",
        employerRate: "0.1000",
      },

      employeesCompensation: {
        thresholdMsc: "14500.00",
        atOrBelowThresholdAmount: "10.00",
        aboveThresholdAmount: "30.00",
      },
    },

    philHealth: {
      effectiveFrom: "2025-01-01",

      salaryFloor: "10000.00",
      salaryCeiling: "100000.00",

      premiumRate: "0.0500",
      employeeShareRate: "0.5000",
      employerShareRate: "0.5000",

      oddCentavoRecipient: "EMPLOYER",
    },

    pagIbig: {
      effectiveFrom: "2024-02-01",

      maximumFundSalary: "10000.00",
      employeeRateThreshold: "1500.00",

      lowerEmployeeRate: "0.0100",
      upperEmployeeRate: "0.0200",
      employerRate: "0.0200",
    },

    tax: {
      withholding: {
        effectiveFrom: "2023-01-01",

        rules: {
          DAILY: {
            method: "PROGRESSIVE_TABLE",

            brackets: [
              {
                minInclusive: "0.00",
                maxExclusive: "685.01",
                baseTax: "0.00",
                rateOnExcess: "0.0000",
              },
              {
                minInclusive: "685.01",
                maxExclusive: "1096.00",
                baseTax: "0.00",
                rateOnExcess: "0.1500",
              },
              {
                minInclusive: "1096.00",
                maxExclusive: "2192.00",
                baseTax: "61.65",
                rateOnExcess: "0.2000",
              },
              {
                minInclusive: "2192.00",
                maxExclusive: "5479.00",
                baseTax: "280.85",
                rateOnExcess: "0.2500",
              },
              {
                minInclusive: "5479.00",
                maxExclusive: "21918.00",
                baseTax: "1102.60",
                rateOnExcess: "0.3000",
              },
              {
                minInclusive: "21918.00",
                maxExclusive: null,
                baseTax: "6034.00",
                rateOnExcess: "0.3500",
              },
            ],
          },

          WEEKLY: {
            method: "PROGRESSIVE_TABLE",

            brackets: [
              {
                minInclusive: "0.00",
                maxExclusive: "4808.01",
                baseTax: "0.00",
                rateOnExcess: "0.0000",
              },
              {
                minInclusive: "4808.01",
                maxExclusive: "7692.00",
                baseTax: "0.00",
                rateOnExcess: "0.1500",
              },
              {
                minInclusive: "7692.00",
                maxExclusive: "15385.00",
                baseTax: "432.60",
                rateOnExcess: "0.2000",
              },
              {
                minInclusive: "15385.00",
                maxExclusive: "38462.00",
                baseTax: "1971.20",
                rateOnExcess: "0.2500",
              },
              {
                minInclusive: "38462.00",
                maxExclusive: "153846.00",
                baseTax: "7740.45",
                rateOnExcess: "0.3000",
              },
              {
                minInclusive: "153846.00",
                maxExclusive: null,
                baseTax: "42355.65",
                rateOnExcess: "0.3500",
              },
            ],
          },

          SEMI_MONTHLY: {
            method: "PROGRESSIVE_TABLE",

            brackets: [
              {
                minInclusive: "0.00",
                maxExclusive: "10417.01",
                baseTax: "0.00",
                rateOnExcess: "0.0000",
              },
              {
                minInclusive: "10417.01",
                maxExclusive: "16667.00",
                baseTax: "0.00",
                rateOnExcess: "0.1500",
              },
              {
                minInclusive: "16667.00",
                maxExclusive: "33333.00",
                baseTax: "937.50",
                rateOnExcess: "0.2000",
              },
              {
                minInclusive: "33333.00",
                maxExclusive: "83333.00",
                baseTax: "4270.70",
                rateOnExcess: "0.2500",
              },
              {
                minInclusive: "83333.00",
                maxExclusive: "333333.00",
                baseTax: "16770.70",
                rateOnExcess: "0.3000",
              },
              {
                minInclusive: "333333.00",
                maxExclusive: null,
                baseTax: "91770.70",
                rateOnExcess: "0.3500",
              },
            ],
          },

          MONTHLY: {
            method: "PROGRESSIVE_TABLE",

            brackets: [
              {
                minInclusive: "0.00",
                maxExclusive: "20833.01",
                baseTax: "0.00",
                rateOnExcess: "0.0000",
              },
              {
                minInclusive: "20833.01",
                maxExclusive: "33333.00",
                baseTax: "0.00",
                rateOnExcess: "0.1500",
              },
              {
                minInclusive: "33333.00",
                maxExclusive: "66667.00",
                baseTax: "1875.00",
                rateOnExcess: "0.2000",
              },
              {
                minInclusive: "66667.00",
                maxExclusive: "166667.00",
                baseTax: "8541.80",
                rateOnExcess: "0.2500",
              },
              {
                minInclusive: "166667.00",
                maxExclusive: "666667.00",
                baseTax: "33541.80",
                rateOnExcess: "0.3000",
              },
              {
                minInclusive: "666667.00",
                maxExclusive: null,
                baseTax: "183541.80",
                rateOnExcess: "0.3500",
              },
            ],
          },
        },
      },

      annualIncomeTax: {
        effectiveFrom: "2023-01-01",

        rule: {
          method: "PROGRESSIVE_TABLE",

          brackets: [
            {
              minInclusive: "0.00",
              maxExclusive: "250000.00",
              baseTax: "0.00",
              rateOnExcess: "0.0000",
            },
            {
              minInclusive: "250000.00",
              maxExclusive: "400000.00",
              baseTax: "0.00",
              rateOnExcess: "0.1500",
            },
            {
              minInclusive: "400000.00",
              maxExclusive: "800000.00",
              baseTax: "22500.00",
              rateOnExcess: "0.2000",
            },
            {
              minInclusive: "800000.00",
              maxExclusive: "2000000.00",
              baseTax: "102500.00",
              rateOnExcess: "0.2500",
            },
            {
              minInclusive: "2000000.00",
              maxExclusive: "8000000.00",
              baseTax: "402500.00",
              rateOnExcess: "0.3000",
            },
            {
              minInclusive: "8000000.00",
              maxExclusive: null,
              baseTax: "2202500.00",
              rateOnExcess: "0.3500",
            },
          ],
        },
      },

      thirteenthMonthOtherBenefits: {
        effectiveFrom: "2018-01-01",
        taxExemptCeiling: "90000.00",
      },

      deMinimis: {
        effectiveFrom: "2026-01-06",

        benefits: [
          {
            code: "PRIVATE_UNUSED_VACATION_LEAVE",
            description:
              "Monetized unused vacation leave credits of private employees",
            limit: {
              type: "DAYS_PER_YEAR",
              days: 12,
            },
          },
          {
            code: "MEDICAL_CASH_ALLOWANCE_DEPENDENTS",
            description:
              "Medical cash allowance to dependents of employees",
            limit: {
              type: "AMOUNT_PER_SEMESTER_OR_MONTH",
              amountPerSemester: "2000.00",
              amountPerMonth: "333.00",
            },
          },
          {
            code: "RICE_SUBSIDY",
            description: "Rice subsidy",
            limit: {
              type: "AMOUNT_PER_MONTH",
              amount: "2500.00",
            },
          },
          {
            code: "UNIFORM_CLOTHING_ALLOWANCE",
            description: "Uniform and clothing allowance",
            limit: {
              type: "AMOUNT_PER_YEAR",
              amount: "8000.00",
            },
          },
          {
            code: "ACTUAL_MEDICAL_ASSISTANCE",
            description: "Actual medical assistance",
            limit: {
              type: "AMOUNT_PER_YEAR",
              amount: "12000.00",
            },
          },
          {
            code: "LAUNDRY_ALLOWANCE",
            description: "Laundry allowance",
            limit: {
              type: "AMOUNT_PER_MONTH",
              amount: "400.00",
            },
          },
          {
            code: "EMPLOYEE_ACHIEVEMENT_AWARDS",
            description: "Employee achievement awards",
            limit: {
              type: "AMOUNT_PER_YEAR",
              amount: "12000.00",
            },
          },
          {
            code: "CHRISTMAS_MAJOR_ANNIVERSARY_GIFTS",
            description:
              "Gifts during Christmas and major anniversary celebrations",
            limit: {
              type: "AMOUNT_PER_YEAR",
              amount: "6000.00",
            },
          },
          {
            code: "OT_NIGHT_SHIFT_MEAL_ALLOWANCE",
            description:
              "Daily meal allowance for overtime work and night or graveyard shifts",
            limit: {
              type: "PERCENT_OF_REGIONAL_BASIC_MINIMUM_WAGE_PER_DAY",
              rate: "0.3000",
            },
          },
          {
            code: "CBA_PRODUCTIVITY_INCENTIVES",
            description:
              "Combined CBA and productivity incentive benefits",
            limit: {
              type: "AMOUNT_PER_YEAR",
              amount: "12000.00",
            },
          },
        ],
      },
    },

    /*
     * Minimum wage is regional and company-context dependent.
     * Company Payroll Setup will select/resolve the applicable
     * wage-order reference rather than assuming one national rate.
     */
    minimumWageReferences: [],

    premium: {
      regularWorkRules: {
        "REST_DAY|NO_HOLIDAY": {
          multiplier: "1.3000",
          semantics: "TOTAL",
        },
        "WORKDAY|SPECIAL_NON_WORKING": {
          multiplier: "1.3000",
          semantics: "TOTAL",
        },
        "REST_DAY|SPECIAL_NON_WORKING": {
          multiplier: "1.5000",
          semantics: "TOTAL",
        },
        "WORKDAY|REGULAR": {
          multiplier: "2.0000",
          semantics: "TOTAL",
        },
        "REST_DAY|REGULAR": {
          multiplier: "2.6000",
          semantics: "TOTAL",
        },
        "WORKDAY|SPECIAL_WORKING": {
          multiplier: "1.0000",
          semantics: "TOTAL",
        },
        "REST_DAY|SPECIAL_WORKING": {
          multiplier: "1.3000",
          semantics: "TOTAL",
        },
      },

      overtimeRules: {
        REGULAR: {
          multiplier: "1.2500",
          semantics: "TOTAL",
        },
        REST_DAY: {
          multiplier: "1.6900",
          semantics: "TOTAL",
        },
        SPECIAL_HOLIDAY: {
          multiplier: "1.6900",
          semantics: "TOTAL",
        },
        REGULAR_HOLIDAY: {
          multiplier: "2.6000",
          semantics: "TOTAL",
        },
        REST_DAY_SPECIAL_HOLIDAY: {
          multiplier: "1.9500",
          semantics: "TOTAL",
        },
        REST_DAY_REGULAR_HOLIDAY: {
          multiplier: "3.3800",
          semantics: "TOTAL",
        },
      },

      nightDifferentialRate: "0.1000",
    },
  },
};

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

async function seedGoldenPayrollTemplate() {
  console.log("Seeding Golden Payroll Template...");

  const template = await prisma.payrollTemplate.upsert({
    where: {
      code: GOLDEN_PAYROLL_TEMPLATE_CODE,
    },

    update: {
      name: GOLDEN_PAYROLL_TEMPLATE_NAME,
      description: GOLDEN_PAYROLL_TEMPLATE_DESCRIPTION,
    },

    create: {
      code: GOLDEN_PAYROLL_TEMPLATE_CODE,
      name: GOLDEN_PAYROLL_TEMPLATE_NAME,
      description: GOLDEN_PAYROLL_TEMPLATE_DESCRIPTION,
      status: ConfigStatus.ACTIVE,
    },
  });

  /*
   * IMPORTANT:
   *
   * Golden versions are historical configuration records.
   * Re-running the seed must NEVER rewrite an existing version.
   *
   * Any future statutory change must create a new effective-dated
   * PayrollTemplateVersion rather than mutating version 1.
   */
  const existingVersion =
    await prisma.payrollTemplateVersion.findUnique({
      where: {
        payrollTemplateId_version: {
          payrollTemplateId: template.id,
          version: GOLDEN_PAYROLL_TEMPLATE_INITIAL_VERSION,
        },
      },

      select: {
        id: true,
        version: true,
        status: true,
        effectiveFrom: true,
      },
    });

  if (existingVersion) {
    console.log(
      `Golden Payroll Template version ${existingVersion.version} already exists; preserving historical configuration.`,
    );

    return;
  }

  const version =
    await prisma.payrollTemplateVersion.create({
      data: {
        payrollTemplateId: template.id,
        version: GOLDEN_PAYROLL_TEMPLATE_INITIAL_VERSION,
        name: GOLDEN_PAYROLL_TEMPLATE_INITIAL_VERSION_NAME,
        config: GOLDEN_PAYROLL_TEMPLATE_INITIAL_CONFIG,
        status: ConfigStatus.ACTIVE,
        effectiveFrom:
          GOLDEN_PAYROLL_TEMPLATE_INITIAL_EFFECTIVE_FROM,
        effectiveTo: null,
      },

      select: {
        id: true,
        version: true,
      },
    });

  console.log(
    `Golden Payroll Template version ${version.version} created.`,
  );
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
  await seedGoldenPayrollTemplate();
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
