import getDb from '@/lib/db';
import { KpiInput, KpiMeasurementInput, KpiMeasurementRecord, KpiRecord } from '@/types/pm-os';

interface KpiRow {
    id: string;
    outcome_id: string;
    outcome_title: string | null;
    name: string;
    metric_type: KpiRecord['metricType'];
    unit: string | null;
    baseline_value: number | null;
    current_value: number | null;
    target_value: number | null;
    measurement_frequency: KpiRecord['measurementFrequency'];
    source_type: KpiRecord['sourceType'];
    source_notes: string | null;
    last_measured_at: string | null;
    created_at: string;
    updated_at: string;
}

interface MeasurementRow {
    id: string;
    kpi_id: string;
    measured_at: string;
    value: number;
    note: string | null;
    created_at: string;
}

interface KpiFilters {
    outcomeId?: string | null;
}

function mapMeasurementRow(row: MeasurementRow): KpiMeasurementRecord {
    return {
        id: row.id,
        kpiId: row.kpi_id,
        measuredAt: row.measured_at,
        value: row.value,
        note: row.note,
        createdAt: row.created_at,
    };
}

function getMeasurementsByKpiIds(ids: string[]): Map<string, KpiMeasurementRecord[]> {
    if (ids.length === 0) return new Map();
    const db = getDb();
    const rows = db.prepare(`
      SELECT *
      FROM kpi_measurements
      WHERE kpi_id IN (${ids.map(() => '?').join(',')})
      ORDER BY measured_at DESC, created_at DESC
    `).all(...ids) as MeasurementRow[];

    const map = new Map<string, KpiMeasurementRecord[]>();
    for (const row of rows) {
        const current = map.get(row.kpi_id) || [];
        current.push(mapMeasurementRow(row));
        map.set(row.kpi_id, current);
    }
    return map;
}

function mapKpiRows(rows: KpiRow[]): KpiRecord[] {
    const measurementsByKpiId = getMeasurementsByKpiIds(rows.map((row) => row.id));
    return rows.map((row) => ({
        id: row.id,
        outcomeId: row.outcome_id,
        outcomeTitle: row.outcome_title,
        name: row.name,
        metricType: row.metric_type,
        unit: row.unit,
        baselineValue: row.baseline_value,
        currentValue: row.current_value,
        targetValue: row.target_value,
        measurementFrequency: row.measurement_frequency,
        sourceType: row.source_type,
        sourceNotes: row.source_notes,
        lastMeasuredAt: row.last_measured_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        measurements: measurementsByKpiId.get(row.id) || [],
    }));
}

function buildUpdate(fields: Record<string, unknown>) {
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return null;
    return {
        clause: entries.map(([column]) => `${column} = ?`).join(', '),
        values: entries.map(([, value]) => value),
    };
}

export function listKpis(filters: KpiFilters = {}): KpiRecord[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.outcomeId) {
        conditions.push('k.outcome_id = ?');
        params.push(filters.outcomeId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT
        k.*,
        o.title AS outcome_title
      FROM kpis k
      LEFT JOIN outcomes o ON o.id = k.outcome_id
      ${where}
      ORDER BY k.updated_at DESC
    `).all(...params) as KpiRow[];
    return mapKpiRows(rows);
}

export function getKpiById(id: string): KpiRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        k.*,
        o.title AS outcome_title
      FROM kpis k
      LEFT JOIN outcomes o ON o.id = k.outcome_id
      WHERE k.id = ?
      LIMIT 1
    `).get(id) as KpiRow | undefined;
    if (!row) return null;
    return mapKpiRows([row])[0] || null;
}

export function createKpi(input: KpiInput): KpiRecord {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO kpis (
        id, outcome_id, name, metric_type, unit, baseline_value, current_value, target_value,
        measurement_frequency, source_type, source_notes, last_measured_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.outcomeId,
        input.name,
        input.metricType,
        input.unit,
        input.baselineValue,
        input.currentValue,
        input.targetValue,
        input.measurementFrequency,
        input.sourceType,
        input.sourceNotes,
        null,
        now,
        now
    );
    const created = getKpiById(id);
    if (!created) throw new Error('Failed to create KPI.');
    return created;
}

export function updateKpi(id: string, input: Partial<KpiInput>): KpiRecord | null {
    const update = buildUpdate({
        outcome_id: input.outcomeId,
        name: input.name,
        metric_type: input.metricType,
        unit: input.unit,
        baseline_value: input.baselineValue,
        current_value: input.currentValue,
        target_value: input.targetValue,
        measurement_frequency: input.measurementFrequency,
        source_type: input.sourceType,
        source_notes: input.sourceNotes,
        updated_at: new Date().toISOString(),
    });
    if (!update) return getKpiById(id);
    const db = getDb();
    const result = db.prepare(`
      UPDATE kpis
      SET ${update.clause}
      WHERE id = ?
    `).run(...update.values, id);
    if (result.changes === 0) return null;
    return getKpiById(id);
}

export function addKpiMeasurement(input: KpiMeasurementInput): KpiMeasurementRecord {
    const db = getDb();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const transaction = db.transaction(() => {
        db.prepare(`
          INSERT INTO kpi_measurements (
            id, kpi_id, measured_at, value, note, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            id,
            input.kpiId,
            input.measuredAt,
            input.value,
            input.note,
            createdAt
        );

        db.prepare(`
          UPDATE kpis
          SET current_value = ?, last_measured_at = ?, updated_at = ?
          WHERE id = ?
        `).run(
            input.value,
            input.measuredAt,
            createdAt,
            input.kpiId
        );
    });
    transaction();

    return {
        id,
        kpiId: input.kpiId,
        measuredAt: input.measuredAt,
        value: input.value,
        note: input.note,
        createdAt,
    };
}
