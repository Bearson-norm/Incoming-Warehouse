/**
 * One-shot import from a legacy SQLite file into PostgreSQL.
 *
 * Usage (from Dashboard/api):
 *   SQLITE_PATH=C:\path\to\incoming-warehouse.db DATABASE_URL=postgresql://... npx ts-node scripts/import-sqlite.ts
 *
 * Requires the sqlite3 CLI on PATH.
 */
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { labelMetadataToGrams, toGrams } from '../src/common/weight-unit';

type Row = Record<string, unknown>;

function sqliteJson(dbPath: string, sql: string): Row[] {
  const raw = execSync(`sqlite3 -json "${dbPath}" "${sql.replace(/"/g, '""')}"`, {
    encoding: 'utf8',
  }).trim();
  if (!raw) {
    return [];
  }
  return JSON.parse(raw) as Row[];
}

function asDate(value: unknown): Date | null {
  if (value == null || value === '') {
    return null;
  }
  return new Date(String(value));
}

async function main() {
  const sqlitePath = process.env.SQLITE_PATH?.trim();
  if (!sqlitePath) {
    throw new Error('SQLITE_PATH is required.');
  }

  const prisma = new PrismaClient();
  try {
    const users = sqliteJson(sqlitePath, 'SELECT * FROM User');
    for (const user of users) {
      await prisma.user.upsert({
        where: { username: String(user.username) },
        update: {},
        create: {
          username: String(user.username),
          passwordHash: String(user.passwordHash),
          role: String(user.role || 'user'),
        },
      });
    }

    const usernameToId = new Map(
      (await prisma.user.findMany()).map((u) => [u.username, u.id]),
    );

    const vendors = sqliteJson(sqlitePath, 'SELECT * FROM Vendor');
    const vendorIdMap = new Map<number, number>();
    for (const vendor of vendors) {
      const created = await prisma.vendor.create({
        data: { name: String(vendor.name) },
      });
      vendorIdMap.set(Number(vendor.id), created.id);
    }

    const packagings = sqliteJson(sqlitePath, 'SELECT * FROM Packaging');
    const sessions = sqliteJson(sqlitePath, 'SELECT * FROM WeighSession');
    const readings = sqliteJson(sqlitePath, 'SELECT * FROM WeighReading');
    const legacyKilograms = sourceStillKilograms(readings, sessions);
    const packagingIdMap = new Map<number, number>();
    for (const packaging of packagings) {
      const tare =
        packaging.tareWeight == null ? null : Number(packaging.tareWeight);
      const created = await prisma.packaging.create({
        data: {
          vendorId: vendorIdMap.get(Number(packaging.vendorId))!,
          name: String(packaging.name),
          tareWeight:
            tare == null ? null : legacyKilograms ? tare * 1000 : tare,
          metadata: packaging.metadata == null ? null : String(packaging.metadata),
        },
      });
      packagingIdMap.set(Number(packaging.id), created.id);
    }

    const sqliteUsers = new Map(users.map((u) => [Number(u.id), String(u.username)]));
    const sessionIdMap = new Map<number, number>();
    for (const session of sessions) {
      const username = sqliteUsers.get(Number(session.userId));
      const userId = username ? usernameToId.get(username) : undefined;
      if (!userId) {
        continue;
      }
      const created = await prisma.weighSession.create({
        data: {
          userId,
          vendorId: session.vendorId == null ? null : vendorIdMap.get(Number(session.vendorId)) ?? null,
          packagingId:
            session.packagingId == null
              ? null
              : packagingIdMap.get(Number(session.packagingId)) ?? null,
          packageUid: session.packageUid == null ? null : String(session.packageUid),
          startedAt: asDate(session.startedAt) ?? new Date(),
          endedAt: asDate(session.endedAt),
          autosaveEnabled: Boolean(session.autosaveEnabled),
          weighingStarted: Boolean(session.weighingStarted),
          labelMetadata:
            session.labelMetadata == null
              ? null
              : labelMetadataToGrams(String(session.labelMetadata)) ?? null,
        },
      });
      sessionIdMap.set(Number(session.id), created.id);
    }

    for (const reading of readings) {
      const sessionId = sessionIdMap.get(Number(reading.sessionId));
      if (!sessionId) {
        continue;
      }
      const sourceUnit = String(reading.unit || 'kg');
      const asGrams = (value: unknown) =>
        value == null ? null : toGrams(Number(value), sourceUnit);
      await prisma.weighReading.create({
        data: {
          sessionId,
          weight: toGrams(Number(reading.weight), sourceUnit),
          unit: 'g',
          stable: Boolean(reading.stable),
          rawLine: reading.rawLine == null ? null : String(reading.rawLine),
          capturedAt: asDate(reading.capturedAt) ?? new Date(),
          savedAt: asDate(reading.savedAt),
          packageUid: reading.packageUid == null ? null : String(reading.packageUid),
          odooLogId: reading.odooLogId == null ? null : Number(reading.odooLogId),
          odooPackageId:
            reading.odooPackageId == null ? null : Number(reading.odooPackageId),
          grossWeight: asGrams(reading.grossWeight),
          tareWeight: asGrams(reading.tareWeight),
          netWeight: asGrams(reading.netWeight),
          weightStatus:
            reading.weightStatus == null ? null : String(reading.weightStatus),
          odooMessage: reading.odooMessage == null ? null : String(reading.odooMessage),
          odooError: reading.odooError == null ? null : String(reading.odooError),
        },
      });
    }

    console.log(
      `Imported ${users.length} users, ${sessions.length} sessions, ${readings.length} readings.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

function sourceStillKilograms(readings: Row[], sessions: Row[]): boolean {
  if (
    readings.some((reading) => {
      const unit = String(reading.unit ?? 'kg').trim().toLowerCase();
      return unit === '' || unit === 'kg';
    })
  ) {
    return true;
  }
  return sessions.some((session) => {
    const meta = String(session.labelMetadata || '');
    return meta.includes('"sampleTareKg"') && !meta.includes('"sampleTareG"');
  });
}
