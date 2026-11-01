/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Flame,
  Search,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Activity,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { AppSettings, Scenario, SourceStatus } from '../types/index.ts';
import { searchCity, GeocodingResult } from '../services/geocoding.ts';

interface HeaderProps {
  currentCity: string;
  onSelectCity: (city: GeocodingResult) => void;
  scenario: Scenario;
  onToggleScenario: (s: Scenario) => void;
  sources: SourceStatus[];
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  isLoadingCity: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentCity,
  onSelectCity,
  scenario,
  onToggleScenario,
  sources,
  theme,
  onToggleTheme,
  onOpenSettings,
  isLoadingCity,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showHealthPopover, setShowHealthPopover] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setSearchError(null);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchCity(query);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No city found. Check spelling.');
      }
    } catch (err: any) {
      setSearchError('Geocoding service unavailable.');
    } finally {
      setIsSearching(false);
    }
  };

  const isSimulated = scenario === 'stress_plus_2c';

  return (
    <header
      className={`border-b transition-colors relative z-30 ${
        theme === 'dark' ? 'bg-[#0B0F14] border-[#1F2937]' : 'bg-slate-50 border-slate-200'
      } ${isSimulated ? (theme === 'dark' ? 'bg-amber-950/20 border-amber-900/40' : 'bg-amber-50/70 border-amber-300') : ''}`}
    >
      {/* El Niño Status Ribbon - Only when changed to El Niño mode */}
      {isSimulated && (
        <div className="bg-amber-500 text-black px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-wider flex flex-wrap items-center justify-center gap-2 shadow-sm">
          <Flame className="w-4 h-4 fill-black text-black" />
          <span>EL NIÑO CLIMATE STRESS MODE: {currentCity.toUpperCase()} (+2.0 °C HEAT SURGE ACTIVE)</span>
          <span className="text-[10px] bg-black text-amber-300 px-2 py-0.5 rounded font-bold tracking-normal animate-pulse">
            CRITICAL UPCOMING CONCERN • ACTION REQUIRED
          </span>
          <span className="text-[10px] font-normal opacity-95 hidden lg:inline">
            • Authoritative:
            <a
              href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml"
              target="_blank"
              rel="noreferrer"
              className="underline font-bold ml-1 hover:text-white"
            >
              NOAA CPC Niño-3.4 (+1.2 °C) &amp; WMO Guidance ↗
            </a>
          </span>
        </div>
      )}

      <div className="max-w-[1700px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5 dark:text-white light:text-slate-900">
                HeatShield
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Decision Support
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              City heatwave response &amp; cooling planner for Indian urban centers
            </p>
          </div>
        </div>

        {/* City Search Bar (F1) */}
        <div className="relative flex-1 max-w-xs sm:max-w-sm" ref={searchRef}>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              aria-label="Search Indian city"
              placeholder={isLoadingCity ? 'Resolving city...' : `Current: ${currentCity}`}
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => handleSearch(e.target.value)}
              className={`w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border transition-all outline-none ${
                theme === 'dark'
                  ? 'bg-[#121821] border-[#1F2937] text-slate-200 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
              }`}
            />
            {isSearching && (
              <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
            )}
          </div>

          {searchError && (
            <p className="text-[11px] text-red-400 mt-1 font-mono">{searchError}</p>
          )}

          {/* Autocomplete Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div
              className={`absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-xl z-50 overflow-hidden ${
                theme === 'dark' ? 'bg-[#121821] border-[#1F2937]' : 'bg-white border-slate-200'
              }`}
            >
              {searchResults.map((res) => (
                <button
                  key={res.id}
                  onClick={() => {
                    onSelectCity(res);
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                    theme === 'dark'
                      ? 'hover:bg-[#1A2332] text-slate-200'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <span className="font-medium">{res.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {res.admin1 ? `${res.admin1}, ` : ''}{res.country || 'India'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Section: Scenario Control, Source Health, Theme, Settings */}
        <div className="flex items-center gap-2.5">
          {/* Scenario Toggle Segmented Control */}
          <div
            className={`p-0.5 rounded-lg border flex items-center text-xs font-medium ${
              theme === 'dark' ? 'bg-[#121821] border-[#1F2937]' : 'bg-slate-200/70 border-slate-300'
            }`}
          >
            <button
              type="button"
              onClick={() => onToggleScenario('live')}
              className={`px-2.5 py-1 rounded-md transition-all text-xs flex items-center gap-1.5 ${
                scenario === 'live'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Live</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleScenario('stress_plus_2c')}
              title={`Simulate El Niño Climate Stress for ${currentCity} (+2 °C surge)`}
              className={`px-2.5 py-1 rounded-md transition-all text-xs flex items-center gap-1.5 ${
                scenario === 'stress_plus_2c'
                  ? 'bg-amber-500 text-black shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>El Niño (+2 °C)</span>
            </button>
          </div>

          {/* Source Data Health Dots */}
          <div className="relative">
            <button
              onClick={() => setShowHealthPopover(!showHealthPopover)}
              aria-label="Data source health indicators"
              className={`p-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
                theme === 'dark'
                  ? 'bg-[#121821] border-[#1F2937] hover:bg-[#1A2332]'
                  : 'bg-white border-slate-300 hover:bg-slate-100'
              }`}
              title="Data feed health status"
            >
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex items-center gap-1">
                {sources.slice(0, 5).map((s) => (
                  <span
                    key={s.source_id}
                    className={`w-2 h-2 rounded-full ${
                      s.status === 'live'
                        ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50'
                        : s.status === 'user_uploaded'
                        ? 'bg-blue-400'
                        : s.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-slate-600'
                    }`}
                    title={`${s.name}: ${s.status}`}
                  />
                ))}
              </div>
            </button>

            {/* Health Popover */}
            {showHealthPopover && (
              <div
                className={`absolute right-0 top-full mt-2 w-80 rounded-xl p-3 border shadow-2xl z-50 text-xs ${
                  theme === 'dark' ? 'bg-[#121821] border-[#1F2937] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <div className="font-semibold text-xs border-b border-slate-700/50 pb-1.5 mb-2 flex items-center justify-between">
                  <span>Data Feed Health &amp; Standards</span>
                  <span className="text-[10px] text-slate-400">{sources.length} Connected</span>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {sources.map((s) => {
                    let shortName = s.name;
                    if (s.source_id === 'open_meteo_forecast') shortName = 'Open-Meteo (Forecast)';
                    else if (s.source_id === 'open_meteo_archive') shortName = 'Open-Meteo (Archive)';
                    else if (s.source_id === 'noaa_enso') shortName = 'NOAA CPC (Niño-3.4 Index)';
                    else if (s.source_id === 'imd_mausam') shortName = 'IMD Mausam (Heat Standards)';
                    else if (s.source_id === 'wmo_climate') shortName = 'WMO (El Niño Climate)';
                    else if (s.source_id === 'data_gov_in') shortName = 'OGD India (data.gov.in)';
                    else if (s.source_id === 'osm_sites') shortName = 'OSM (Cooling Sites)';
                    else if (s.source_id === 'osm_buildings') shortName = 'OSM (Urban Fabric)';
                    else if (s.source_id === 'planetary_computer_stac') shortName = 'Planetary Computer (Sat)';
                    else if (s.source_id === 'google_earth_engine') shortName = 'Earth Engine (Thermal LST)';
                    else if (s.source_id === 'sentinel2_vegetation') shortName = 'Sentinel-2 (Tree Cover 10m)';
                    else if (s.source_id === 'ward_boundaries') shortName = 'Ward Geography (Grid)';
                    else if (s.source_id === 'demand_history') shortName = 'Official Grid Demand';

                    return (
                      <div key={s.source_id} className="flex items-center justify-between text-[11px] py-0.5">
                        <span className="truncate pr-2 font-medium text-slate-300">{shortName}</span>
                        <span
                          className={`font-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ${
                            s.status === 'live'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : s.status === 'user_uploaded'
                              ? 'bg-blue-500/20 text-blue-400'
                              : s.status === 'failed'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          {s.status === 'not_loaded' ? 'Awaiting Upload' : s.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className={`p-1.5 rounded-lg border transition-colors ${
              theme === 'dark'
                ? 'bg-[#121821] border-[#1F2937] text-slate-300 hover:text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:text-black'
            }`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            aria-label="Open settings"
            className={`p-1.5 rounded-lg border transition-colors ${
              theme === 'dark'
                ? 'bg-[#121821] border-[#1F2937] text-slate-300 hover:text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:text-black'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
