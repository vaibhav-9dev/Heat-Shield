/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Papa from 'papaparse';
import {
  DemandForecastResult,
  DemandModel,
  DemandRecord,
  SourceStatus,
} from '../types/index.ts';
import { fitQuadraticOLS, MatchedDemandDay, trainDemandModel } from '../engine/demandModel.ts';
import { calculateShiftWindow, calculateStressWindow } from '../engine/stressWindow.ts';
import { fetchHistoricalArchiveTemperatures } from './weather.ts';

export interface ColumnMapping {
  dateCol: string;
  demandCol: string;
  hourCol?: string;
}

export interface ParseResult {
  headers: string[];
  rawRows: Record<string, string>[];
  totalRows: number;
}

/**
 * Parses uploaded CSV file. Enforces max 10 MB limit (E7).
 */
export function parseDemandCSV(fileContent: string, fileSize: number): ParseResult {
  if (fileSize > 10 * 1024 * 1024) {
    throw new Error('Please upload a CSV or XLSX under 10 MB.');
  }

  const result = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0 && (!result.data || result.data.length === 0)) {
    throw new Error('Unable to parse CSV content.');
  }

  const headers = result.meta.fields || [];
  return {
    headers,
    rawRows: result.data,
    totalRows: result.data.length,
  };
}

/**
 * Normalizes date strings (YYYY-MM-DD or DD-MM-YYYY) into ISO YYYY-MM-DD.
 */
function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  // DD-MM-YYYY
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // DD-MM-YYYY
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    } else if (parts[0].length === 4) {
      // YYYY-MM-DD
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Processes raw rows using user column mapping.
 * Counts and skips invalid rows (E8).
 */
export function mapDemandRecords(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): { records: DemandRecord[]; skippedRows: number } {
  const records: DemandRecord[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    const rawDate = row[mapping.dateCol];
    const rawDemand = row[mapping.demandCol];
    const rawHour = mapping.hourCol ? row[mapping.hourCol] : undefined;

    const date = normalizeDate(rawDate);
    const demand = parseFloat(String(rawDemand).replace(/,/g, ''));

    if (!date || isNaN(demand) || demand <= 0) {
      skippedRows++;
      continue;
    }

    let hour: number | null = null;
    if (rawHour !== undefined && rawHour !== '') {
      const h = parseInt(rawHour, 10);
      if (!isNaN(h) && h >= 0 && h <= 23) {
        hour = h;
      }
    }

    records.push({
      date,
      demand_mw: Number(demand.toFixed(1)),
      hour,
    });
  }

  return { records, skippedRows };
}

/**
 * Builds the demand model and forecasts peak demand for the 7-day weather window.
 */
export async function buildDemandForecast(
  records: DemandRecord[],
  cityLat: number,
  cityLon: number,
  forecastDays: Array<{ date: string; tmax_c: number }>,
  hourlyApparentPeakDay: number[]
): Promise<{
  model: DemandModel;
  forecast: DemandForecastResult;
  sourceStatus: SourceStatus;
}> {
  if (records.length === 0) {
    throw new Error('No valid demand records provided.');
  }

  // Find date span of uploaded records
  const dates = records.map((r) => r.date).sort();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  // Aggregate daily total/peak demand if multiple records per day
  const dailyDemandMap = new Map<string, number>();
  for (const r of records) {
    // If multiple hours, take maximum demand of that day
    const cur = dailyDemandMap.get(r.date);
    if (cur === undefined || r.demand_mw > cur) {
      dailyDemandMap.set(r.date, r.demand_mw);
    }
  }

  // Fetch historical archive temperatures for this span
  const archiveTemps = await fetchHistoricalArchiveTemperatures(
    cityLat,
    cityLon,
    startDate,
    endDate
  );

  const archiveTempMap = new Map<string, number>();
  for (const a of archiveTemps) {
    archiveTempMap.set(a.date, a.tmax_c);
  }

  // Match records by date
  const matched: MatchedDemandDay[] = [];
  for (const [date, demand] of dailyDemandMap.entries()) {
    if (archiveTempMap.has(date)) {
      matched.push({
        date,
        demand_mw: demand,
        tmax_c: archiveTempMap.get(date)!,
      });
    }
  }

  // Enforce >= 90 matched days check (E9, L10, T6)
  const model = trainDemandModel(matched);

  // Forecast next 7 days
  const [a, b, c] = model.coefficients;
  const predictMw = (t: number) => a + b * t + c * t * t;

  let peakDay = forecastDays[0]?.date || '';
  let peakMw = -1;
  let peakLow = 0;
  let peakHigh = 0;

  const dailyForecasts = forecastDays.map((fd) => {
    const rawPred = predictMw(fd.tmax_c);
    const pred = Math.max(100, Number(rawPred.toFixed(1)));
    const margin = 1.96 * model.residual_std_mw;
    const low = Math.max(0, Number((pred - margin).toFixed(1)));
    const high = Number((pred + margin).toFixed(1));

    if (pred > peakMw) {
      peakMw = pred;
      peakDay = fd.date;
      peakLow = low;
      peakHigh = high;
    }

    return {
      date: fd.date,
      tmax_c: fd.tmax_c,
      predicted_mw: pred,
      low_mw: low,
      high_mw: high,
    };
  });

  // Calculate stress window and shift window (L11, L12)
  const stressWindow = calculateStressWindow(
    hourlyApparentPeakDay.length > 0 ? hourlyApparentPeakDay : [30, 31, 33, 36, 38, 39, 41, 41, 39, 36]
  );
  const shiftWindow = calculateShiftWindow(stressWindow.end_hour);

  const forecast: DemandForecastResult = {
    peak_day: peakDay,
    peak_mw: peakMw,
    interval_mw: [peakLow, peakHigh],
    stress_window: {
      start_hour: stressWindow.start_hour,
      end_hour: stressWindow.end_hour,
    },
    shift_window: {
      start_hour: shiftWindow.start_hour,
      end_hour: shiftWindow.end_hour,
    },
    dailyForecasts,
  };

  const sourceStatus: SourceStatus = {
    source_id: 'demand_history',
    name: 'Official Utility Grid Power Demand Data',
    status: 'user_uploaded',
    last_fetched: new Date().toISOString(),
    records: matched.length,
    detail: `Trained quadratic model on ${matched.length} matched days (R²: ${model.r2_test}, MAPE: ${model.mape_test_pct}%). City/state level demand, not ward level.`,
    url: 'https://grid-india.in',
  };

  return { model, forecast, sourceStatus };
}
