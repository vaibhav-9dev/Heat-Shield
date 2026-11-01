/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Play,
  Thermometer,
  ShieldAlert,
  Zap,
  AlertCircle,
  Sparkles,
  Clock,
  RefreshCw,
  Flame,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { DemandForecastResult, Plan, Scenario } from '../types/index.ts';

interface HeroStripProps {
  onRunPlanner: () => void;
  isRunning: boolean;
  peakApparentC: number | null;
  severeCount: number;
  totalWards: number;
  demandForecast: DemandForecastResult | null;
  onNavigateDemand: () => void;
  selectedDay: string;
  isStale: boolean;
  theme: 'dark' | 'light';
  currentPlan: Plan | null;
  satelliteWarning: string | null;
  gridCellCount: number;
  cityName: string;
  scenario: Scenario;
  baselineSevereCount?: number;
  baselinePeakApparentC?: number;
}

export const HeroStrip: React.FC<HeroStripProps> = ({
  onRunPlanner,
  isRunning,
  peakApparentC,
  severeCount,
  totalWards,
  demandForecast,
  onNavigateDemand,
  selectedDay,
  isStale,
  theme,
  currentPlan,
  satelliteWarning,
  gridCellCount,
  cityName,
  scenario,
  baselineSevereCount = 0,
  baselinePeakApparentC,
}) => {
  const isDark = theme === 'dark';
  const isElNino = scenario === 'stress_plus_2c';
  const [showElNinoDetails, setShowElNinoDetails] = useState(true);

  const severeWardDelta = Math.max(0, severeCount - baselineSevereCount);

  return (
    <div className={`border-b ${isDark ? 'bg-[#0B0F14] border-[#1F2937]' : 'bg-slate-100/60 border-slate-200'}`}>
      <div className="max-w-[1700px] mx-auto px-4 py-3 space-y-2.5">
        {/* EL NIÑO CLIMATE IMPACT DIRECTIVE - Prominently Highlighted Upcoming Concern */}
        {isElNino && (
          <div className="rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-950/40 via-red-950/30 to-slate-900/60 p-3.5 shadow-xl transition-all animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-black flex items-center justify-center font-bold">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-amber-300 uppercase tracking-wide">
                      El Niño Climate Stress Directives: {cityName}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 font-bold uppercase animate-pulse">
                      Critical Upcoming Concern
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    NOAA CPC Niño-3.4 anomaly (+1.2 °C) &amp; WMO consensus project heightened continental heat accumulation over {cityName}.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-[11px] font-mono font-medium flex items-center gap-1.5 transition border border-slate-700"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>NOAA Bulletin ↗</span>
                </a>
                <button
                  onClick={() => setShowElNinoDetails(!showElNinoDetails)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  {showElNinoDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Impact Highlights Breakdown */}
            {showElNinoDetails && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2.5 text-xs">
                {/* 1. Temperature Escalation */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/20">
                  <span className="text-[10px] font-mono uppercase text-amber-400 font-semibold block">
                    Thermal Escalation
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-mono text-white">
                      {peakApparentC ? peakApparentC.toFixed(1) : '--'} °C
                    </span>
                    <span className="text-xs font-mono font-bold text-red-400">
                      (+2.0 °C surge)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Severe heat-index threshold breached across {cityName}
                  </span>
                </div>

                {/* 2. Severe Wards Jump */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/20">
                  <span className="text-[10px] font-mono uppercase text-red-400 font-semibold block">
                    Sectors Pushed to Severe
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-mono text-red-400">
                      {severeCount}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      wards (vs {baselineSevereCount} live)
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono block mt-0.5">
                    {severeWardDelta > 0 ? `+${severeWardDelta} newly vulnerable sectors` : 'Elevated across all sectors'}
                  </span>
                </div>

                {/* 3. Grid Thermal Stress Window */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/20">
                  <span className="text-[10px] font-mono uppercase text-yellow-400 font-semibold block">
                    Grid Cooling Strain
                  </span>
                  <div className="mt-1 font-mono font-bold text-base text-yellow-300">
                    {demandForecast
                      ? `${demandForecast.stress_window.start_hour}:00 - ${demandForecast.stress_window.end_hour}:00`
                      : 'Extended afternoon window'}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {demandForecast ? `Peak: ${demandForecast.peak_mw} MW with high AC load` : 'Peak AC and fan load clustering'}
                  </span>
                </div>

                {/* 4. Mandatory Precautionary Action */}
                <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-amber-300 font-bold block">
                      Immediate Preparedness Action
                    </span>
                    <p className="text-[11px] text-slate-200 mt-0.5 leading-snug">
                      Pre-designate public cooling shelters and mandate outdoor worker rest pauses during peak afternoon hours.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stale Plan Alert Banner (E17, L19) */}
        {isStale && (
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center justify-between font-mono">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Plan is out of date. Scenario or tuning parameters have changed. Run Planner again.</span>
            </div>
            <button
              onClick={onRunPlanner}
              className="px-2 py-0.5 rounded bg-amber-500 text-black text-[11px] font-semibold hover:bg-amber-400 transition"
            >
              Update Now
            </button>
          </div>
        )}

        {/* Warning Badge for Satellite fallback (E6, L5) */}
        {satelliteWarning && (
          <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{satelliteWarning}</span>
          </div>
        )}

        {/* Active Spatial Fabric: Major City Peak Points or Grid Cells */}
        {gridCellCount > 0 ? (
          <div className="px-3 py-1 rounded-md bg-slate-800/40 border border-slate-700/50 text-slate-300 text-[11px] flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>Active geography: <strong>grid cells, not wards</strong> ({gridCellCount} 1km² regular sectors generated over {cityName})</span>
          </div>
        ) : totalWards > 0 ? (
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-200 text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
              <span className="font-semibold text-white">
                Major City Peak Points &amp; Urban Zones Active:
              </span>
              <span className="text-slate-300 text-[11px]">
                {totalWards} recognized heat, transit, commercial &amp; industrial peak hubs mapped across {cityName}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-bold uppercase tracking-wider">
              Landmark Nodal Geofabric
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Action Button & Subtitle */}
          <div className="lg:col-span-5 flex items-center gap-3">
            <button
              onClick={onRunPlanner}
              disabled={isRunning}
              aria-label="Run Planner"
              className={`px-5 py-2.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg flex items-center gap-2.5 shrink-0 ${
                isRunning
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-blue-600/30 ring-2 ring-blue-500/50'
              }`}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Planning in Progress...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>Run Planner</span>
                </>
              )}
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Target Day: {selectedDay}
                </span>
                {currentPlan && (
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      currentPlan.mode === 'llm'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                    }`}
                  >
                    {currentPlan.mode === 'llm' ? 'LLM Verified' : 'Template mode (no LLM)'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Runs deterministic multi-factor risk scoring, greedy maximal coverage, and AI agent verification across live public feeds.
              </p>
            </div>
          </div>

          {/* 3 KPI Tiles */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Tile 1: Peak Feels-Like Temperature */}
            <div
              className={`p-2.5 rounded-xl border transition-all ${
                isDark ? 'bg-[#121821] border-[#1F2937]' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  Peak Feels-Like
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  {isElNino ? '+2°C El Niño' : 'Open-Meteo'}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                {peakApparentC !== null ? (
                  <>
                    <span className={`text-xl font-mono font-bold ${isElNino ? 'text-amber-400' : 'text-white'}`}>
                      {peakApparentC.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">°C</span>
                  </>
                ) : (
                  <div className="h-6 w-16 bg-slate-700/50 rounded animate-pulse" />
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                {isElNino ? 'Elevated under El Niño scenario' : 'Median ward apparent max'}
              </div>
            </div>

            {/* Tile 2: Wards at Severe Risk */}
            <div
              className={`p-2.5 rounded-xl border transition-all ${
                isDark ? 'bg-[#121821] border-[#1F2937]' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  Severe Risk
                </span>
                <span className="text-[9px] font-mono text-slate-400">Score ≥ 75</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                {totalWards > 0 ? (
                  <>
                    <span className="text-xl font-mono font-bold text-red-400">
                      {severeCount}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      of {totalWards} wards
                    </span>
                  </>
                ) : (
                  <div className="h-6 w-16 bg-slate-700/50 rounded animate-pulse" />
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                {isElNino ? `${severeWardDelta > 0 ? `+${severeWardDelta}` : 'Peak'} severe surge` : 'Multi-factor risk model'}
              </div>
            </div>

            {/* Tile 3: Demand Peak Window */}
            <div
              className={`p-2.5 rounded-xl border transition-all ${
                isDark ? 'bg-[#121821] border-[#1F2937]' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  Stress Window
                </span>
                <span className="text-[9px] font-mono text-slate-400">SLDC / Grid</span>
              </div>
              <div className="mt-1">
                {demandForecast ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-mono font-bold text-yellow-400">
                      {demandForecast.stress_window.start_hour}:00 - {demandForecast.stress_window.end_hour}:00
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={onNavigateDemand}
                    className="text-xs text-blue-400 hover:text-blue-300 underline font-medium mt-0.5 text-left block"
                  >
                    Upload demand file →
                  </button>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                {demandForecast ? `Peak: ${demandForecast.peak_mw} MW` : '7-day load shifting'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
