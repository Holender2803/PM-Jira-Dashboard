import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'src/lib/migrations');

function ensureMigrationTable(db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    `);
}

export function runMigrations(db: Database.Database): void {
    ensureMigrationTable(db);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
        return;
    }

    const appliedRows = db.prepare(`
      SELECT name
      FROM schema_migrations
    `).all() as { name: string }[];
    const applied = new Set(appliedRows.map((row) => row.name));

    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.endsWith('.sql'))
        .sort((left, right) => left.localeCompare(right));

    const insertApplied = db.prepare(`
      INSERT INTO schema_migrations (name)
      VALUES (?)
    `);

    for (const file of files) {
        if (applied.has(file)) continue;
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        const transaction = db.transaction(() => {
            db.exec(sql);
            insertApplied.run(file);
        });
        transaction();
    }
}
