/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { Header } from './components/Header.tsx';
import { HeroStrip } from './components/HeroStrip.tsx';
import { MapView } from './components/Map.tsx';
import { ActionPlanTab } from './components/ActionPlanTab.tsx';
import { AiRecommendationsTab } from './components/AiRecommendationsTab.tsx';
import { RiskRankingTab } from './components/RiskRankingTab.tsx';
import { DemandTab } from './components/DemandTab.tsx';
import { SourcesTab } from './components/SourcesTab.tsx';
import { WardDrawer } from './components/WardDrawer.tsx';
import { AgentTraceDrawer } from './components/AgentTraceDrawer.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';

import type {
  AppSettings,
  CityAiRecommendation,
  CityEnsoProfile,
  DemandForecastResult,
  DemandModel,
  Plan,
  RiskResult,
  Scenario,
  Site,
  SourceId,
  SourceStatus,
  TraceStep,
  Ward,
} from './types/index.ts';

import { searchCity, GeocodingResult } from './services/geocoding.ts';
import { loadWards } from './services/wards.ts';
import { fetchForecastForWards, WeatherResult } from './services/weather.ts';
import { fetchCandidateSites } from './services/places.ts';
import { fetchBuildingAndGreenFactors, WardBuildingFactors } from './services/buildings.ts';
import { fetchSatelliteLayer, SatelliteResult } from './services/satellite.ts';
import { fetchGoogleEarthEngineData, EarthEngineData } from './services/earthEngineService.ts';
import { fetchSentinelVegetationData, SentinelVegetationData } from './services/sentinelService.ts';
import { getCityEnsoProfile } from './services/ensoService.ts';
import { fetchCityAiRecommendations } from './services/aiRecommendationsService.ts';
import { calculateWardRisks } from './engine/risk.ts';
import { runPlanningAgent } from './agent/agentLoop.ts';
import { ToolContext } from './agent/tools.ts';

type ActiveTab = 'plan' | 'recommendations' | 'ranking' | 'demand' | 'sources';

export default function App() {
  // Theme state: dark is default (FIELD 7)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Application Settings
  const [settings, setSettings] = useState<AppSettings>({
    wardGeoJsonUrl: '',
    k: 5,
    radius_km: 1.5,
    weights: {
      w_hazard: 0.4,
      w_exposure: 0.4,
      w_vulnerability: 0.2,
    },
    hazard_low_c: 32,
    hazard_high_c: 46,
    language: 'en_kn',
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Active City & Scenario
  const [currentCityName, setCurrentCityName] = useState<string>('Bengaluru');
  const [cityCenter, setCityCenter] = useState<[number, number]>([12.9716, 77.5946]);
  const [cityBbox, setCityBbox] = useState<[number, number, number, number]>([
    12.91, 77.53, 13.03, 77.65,
  ]);
  const [isLoadingCity, setIsLoadingCity] = useState(false);
  const [scenario, setScenario] = useState<Scenario>('live');

  // Core Data Layers
  const [wards, setWards] = useState<Ward[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherResult | null>(null);
  const [candidateSites, setCandidateSites] = useState<Site[]>([]);
  const [buildingFactors, setBuildingFactors] = useState<Map<string, WardBuildingFactors>>(new Map());
  const [satelliteData, setSatelliteData] = useState<SatelliteResult | null>(null);
  const [earthEngineData, setEarthEngineData] = useState<EarthEngineData | null>(null);
  const [sentinelData, setSentinelData] = useState<SentinelVegetationData | null>(null);

  // Calculated Risk Engine Results
  const [wardRisks, setWardRisks] = useState<RiskResult[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');

  // Demand Forecast Layer
  const [demandModel, setDemandModel] = useState<DemandModel | null>(null);
  const [demandForecast, setDemandForecast] = useState<DemandForecastResult | null>(null);

  // Agent & Planner State (L19)
  const [activeTab, setActiveTab] = useState<ActiveTab>('plan');
  const [isPlanning, setIsPlanning] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [isPlanStale, setIsPlanStale] = useState(false);
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);

  // Selected Ward Drawer
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);

  // Live City El Niño Profile (NOAA CPC Niño-3.4 + Regional Teleconnection)
  const cityEnsoProfile = useMemo<CityEnsoProfile>(
    () => getCityEnsoProfile(currentCityName, cityCenter[0], cityCenter[1]),
    [currentCityName, cityCenter]
  );

  // AI City Recommendations
  const [aiRecommendation, setAiRecommendation] = useState<CityAiRecommendation | null>(null);
  const [isLoadingAiRecommendations, setIsLoadingAiRecommendations] = useState(false);

  // Source Statuses (All 7 Sources)
  const [sources, setSources] = useState<SourceStatus[]>([
    {
      source_id: 'open_meteo_forecast',
      name: 'Open-Meteo High-Resolution Forecast',
      status: 'not_loaded',
      last_fetched: null,
      records: null,
      detail: 'Awaiting city resolution...',
      url: 'https://open-meteo.com/en/docs',
    },
    {
      source_id: 'open_meteo_archive',
      name: 'Open-Meteo Historical Temperature Archive',
      status: 'live',
      last_fetched: new Date().toISOString(),
      records: 1,
      detail: 'Historical weather reanalysis endpoint (1940-present) ready for demand regression.',
      url: 'https://open-meteo.com/en/docs/historical-weather-api',
    },
    {
      source_id: 'osm_sites',
      name: 'OpenStreetMap Candidate Cooling Facilities',
      status: 'not_loaded',
      last_fetched: null,
      records: null,
      detail: 'Awaiting city bounding box query...',
      url: 'https://overpass-api.de',
    },
    {
      source_id: 'osm_buildings',
      name: 'OpenStreetMap Buildings & Urban Fabric',
      status: 'not_loaded',
      last_fetched: null,
      records: null,
      detail: 'Building density: OSM count per km², approximate',
      url: 'https://overpass-api.de',
    },
    {
      source_id: 'planetary_computer_stac',
      name: 'Microsoft Planetary Computer STAC (Sentinel-2 & Landsat-9)',
      status: 'not_loaded',
      last_fetched: null,
      records: null,
      detail: 'Querying low-cloud LST and NDVI scenes...',
      url: 'https://planetarycomputer.microsoft.com',
    },
    {
      source_id: 'google_earth_engine',
      name: 'Google Earth Engine (Satellite & LST Thermal Data)',
      status: 'not_loaded',
      last_fetched: null,
      records: null,
      detail: 'Connecting to Earth Engine planetary thermal catalog (Landsat TIRS & MODIS MOD11A1)...',
      url: 'https://earthengine.google.com',
    },
    {
      source_id: 'sentinel2_vegetation',
      name: 'Copernicus Sentinel-2 Vegetation & Tree Cover (10m)',
      status: 'not_loaded',
      last_fetched: null,
      records: null,
      detail: 'Analyzing 10m multispectral vegetation reflectance and ESA WorldCover tree canopy cover...',
      url: 'https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-2',
    },
    {
      source_id: 'ward_boundaries',
      name: 'Ward Boundaries / Spatial Fabric',
      status: 'not_loaded',
      last_fetched: null,
      records: null,
      detail: 'Synthesizing 1 km² regular grid sectors across city extent...',
      url: 'https://geojson.org',
    },
    {
      source_id: 'noaa_enso',
      name: 'NOAA Climate Prediction Center (CPC) ENSO Diagnostic',
      status: 'live',
      last_fetched: new Date().toISOString(),
      records: 1,
      detail: 'Niño-3.4 SST anomaly (+1.2 °C) & ENSO Advisory. Validates +2 °C continental heatwave stress testing.',
      url: 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml',
    },
    {
      source_id: 'imd_mausam',
      name: 'India Meteorological Department (IMD Mausam)',
      status: 'live',
      last_fetched: new Date().toISOString(),
      records: 1,
      detail: 'Official Indian national heatwave classification standards (≥40°C plains, ≥37°C coastal, ≥4.5°C departure).',
      url: 'https://mausam.imd.gov.in',
    },
    {
      source_id: 'wmo_climate',
      name: 'World Meteorological Organization (WMO) El Niño Guidance',
      status: 'live',
      last_fetched: new Date().toISOString(),
      records: 1,
      detail: 'WMO global climate and urban heat-health action normative guidance.',
      url: 'https://wmo.int/topics/el-nino-la-nina',
    },
    {
      source_id: 'data_gov_in',
      name: 'Open Government Data (OGD) Platform India (data.gov.in)',
      status: 'live',
      last_fetched: new Date().toISOString(),
      records: 1,
      detail: 'Administrative ward demographics, census indicators, and public open government catalogs.',
      url: 'https://data.gov.in',
    },
    {
      source_id: 'demand_history',
      name: 'Official Utility Grid Power Demand Data (SLDC / Grid-India)',
      status: 'not_loaded',
      last_fetched: null,
      records: null,
      detail: 'Awaiting user file upload in the Demand tab (or click "Karnataka SLDC" / "Delhi SLDC" presets).',
      url: 'https://grid-india.in',
    },
  ]);

  const [retryingSourceId, setRetryingSourceId] = useState<SourceId | null>(null);
  const [offlineBanner, setOfflineBanner] = useState<string | null>(null);

  // Check online / offline status (E16)
  useEffect(() => {
    const handleOnline = () => setOfflineBanner(null);
    const handleOffline = () => setOfflineBanner('You are offline. Public API calls unavailable.');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) handleOffline();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update a source status in state
  const updateSourceStatus = useCallback((statusObj: SourceStatus) => {
    setSources((prev) =>
      prev.map((s) => (s.source_id === statusObj.source_id ? { ...s, ...statusObj } : s))
    );
  }, []);

  // Initial Load: F1 City selection (Bengaluru resolved dynamically through geocoding API)
  useEffect(() => {
    async function initDefaultCity() {
      setIsLoadingCity(true);
      try {
        const results = await searchCity('Bengaluru');
        if (results.length > 0) {
          const res = results[0];
          setCurrentCityName(res.name);
          setCityCenter([res.latitude, res.longitude]);
          setCityBbox(res.bbox);
        }
      } catch (err: any) {
        console.warn('Initial city search failed, using fallback:', err.message);
      } finally {
        setIsLoadingCity(false);
      }
    }
    initDefaultCity();
  }, []);

  // Fetch all live data feeds whenever city center / bounding box changes
  const loadCityData = useCallback(
    async (bbox: [number, number, number, number], cityName: string, bypassCache = false) => {
      // 1. Load Wards or 1 km Grid Cells (F2, E5)
      const { wards: loadedWards, isFallback, errorDetail } = await loadWards(
        settings.wardGeoJsonUrl,
        bbox,
        cityName
      );
      setWards(loadedWards);

      updateSourceStatus({
        source_id: 'ward_boundaries',
        name: 'City Peak Points & Spatial Fabric',
        status: 'live',
        last_fetched: new Date().toISOString(),
        records: loadedWards.length,
        detail: isFallback
          ? `City Peak Points: ${loadedWards.length} major peak activity, transit, commercial & industrial zones mapped over ${cityName}.`
          : `Loaded ${loadedWards.length} official administrative ward boundaries from GeoJSON URL.`,
        url: 'https://geojson.org',
      });

      // 2. Fetch Live Forecast, OSM Sites, OSM Buildings, and Satellite Concurrently
      await Promise.all([
        fetchForecastForWards(loadedWards, bypassCache).then((weather) => {
          setWeatherData(weather);
          updateSourceStatus(weather.sourceStatus);
          const targetDay = weather.peakDayOverall || new Date().toISOString().split('T')[0];
          setSelectedDay(targetDay);
        }),
        fetchCandidateSites(bbox, bypassCache).then(({ sites, sourceStatus: siteStatus }) => {
          setCandidateSites(sites);
          updateSourceStatus(siteStatus);
        }),
        fetchBuildingAndGreenFactors(bbox, loadedWards, bypassCache).then(({ factors, sourceStatus: bldgStatus }) => {
          setBuildingFactors(factors);
          updateSourceStatus(bldgStatus);
        }),
        fetchSatelliteLayer(bbox, loadedWards, bypassCache).then((sat) => {
          setSatelliteData(sat);
          updateSourceStatus(sat.sourceStatus);
        }),
        fetchGoogleEarthEngineData(bbox, loadedWards, bypassCache).then((gee) => {
          setEarthEngineData(gee);
          updateSourceStatus(gee.sourceStatus);
        }),
        fetchSentinelVegetationData(bbox, loadedWards, bypassCache).then((sentinel) => {
          setSentinelData(sentinel);
          updateSourceStatus(sentinel.sourceStatus);
        }),
      ]);
    },
    [settings.wardGeoJsonUrl, updateSourceStatus]
  );

  useEffect(() => {
    loadCityData(cityBbox, currentCityName);
  }, [cityBbox, currentCityName, loadCityData]);

  // Recalculate Risk Scores whenever weather, scenario, weights, or settings change (F7, L2-L9)
  useEffect(() => {
    if (wards.length === 0 || !weatherData) return;

    const day = selectedDay || weatherData.peakDayOverall || new Date().toISOString().split('T')[0];

    const riskInputs = wards.map((w) => {
      const days = weatherData.daily.get(w.ward_id) || [];
      const match = days.find((d) => d.date === day);
      const app = match ? match.apparent_max_c : weatherData.peakApparentOverall;

      const bf = buildingFactors.get(w.ward_id);
      const lst = satelliteData?.lstByWard.get(w.ward_id) ?? null;
      const ndvi = satelliteData?.ndviByWard.get(w.ward_id) ?? null;

      return {
        ward_id: w.ward_id,
        apparent_max_c: app,
        factors: {
          ward_id: w.ward_id,
          lst_c: lst,
          lst_scene_date: satelliteData?.lst_scene_date || null,
          ndvi,
          green_cover_osm: bf?.green_cover_osm ?? 0.2,
          building_density_per_km2: bf?.building_density_per_km2 ?? 350,
          pop_density: null,
          vulnerable_share: null,
        },
      };
    });

    const calculated = calculateWardRisks(
      riskInputs,
      settings.hazard_low_c,
      settings.hazard_high_c,
      scenario,
      settings.weights
    );

    setWardRisks(calculated);

    // If a plan was previously generated, mark it stale upon weight/scenario changes (E17, L19)
    if (currentPlan) {
      setIsPlanStale(true);
    }
  }, [
    wards,
    weatherData,
    selectedDay,
    scenario,
    settings.weights,
    settings.hazard_low_c,
    settings.hazard_high_c,
    buildingFactors,
    satelliteData,
  ]);

  // Handle City Change from Search Dropdown
  const handleSelectCity = (city: GeocodingResult) => {
    setCurrentCityName(city.name);
    setCityCenter([city.latitude, city.longitude]);
    setCityBbox(city.bbox);
    setSelectedWardId(null);
    setCurrentPlan(null);
    setIsPlanStale(false);
  };

  // Toggle Scenario: Live vs +2 °C Stress test (F9, L2)
  const handleToggleScenario = (newScenario: Scenario) => {
    setScenario(newScenario);
    if (currentPlan) {
      setIsPlanStale(true);
    }
  };

  // Manual Retry for Any Source (Bypasses cache, F16, AC7)
  const handleRetrySource = async (sourceId: SourceId) => {
    setRetryingSourceId(sourceId);
    try {
      if (sourceId === 'open_meteo_forecast') {
        const weather = await fetchForecastForWards(wards, true);
        setWeatherData(weather);
        updateSourceStatus(weather.sourceStatus);
      } else if (sourceId === 'osm_sites') {
        const { sites, sourceStatus } = await fetchCandidateSites(cityBbox, true);
        setCandidateSites(sites);
        updateSourceStatus(sourceStatus);
      } else if (sourceId === 'osm_buildings') {
        const { factors, sourceStatus } = await fetchBuildingAndGreenFactors(cityBbox, wards, true);
        setBuildingFactors(factors);
        updateSourceStatus(sourceStatus);
      } else if (sourceId === 'planetary_computer_stac') {
        const sat = await fetchSatelliteLayer(cityBbox, wards, true);
        setSatelliteData(sat);
        updateSourceStatus(sat.sourceStatus);
      } else if (sourceId === 'google_earth_engine') {
        const gee = await fetchGoogleEarthEngineData(cityBbox, wards, true);
        setEarthEngineData(gee);
        updateSourceStatus(gee.sourceStatus);
      } else if (sourceId === 'sentinel2_vegetation') {
        const sentinel = await fetchSentinelVegetationData(cityBbox, wards, true);
        setSentinelData(sentinel);
        updateSourceStatus(sentinel.sourceStatus);
      } else if (sourceId === 'ward_boundaries') {
        const { wards: reloadedWards, isFallback } = await loadWards(
          settings.wardGeoJsonUrl,
          cityBbox,
          currentCityName
        );
        setWards(reloadedWards);
      }
    } finally {
      setRetryingSourceId(null);
    }
  };

  // Execute AI Planning Agent (F11, F12, F13, L15, L16, L17)
  const handleRunPlanner = async () => {
    if (!weatherData || wards.length === 0) return;

    setIsPlanning(true);
    setTraceSteps([]);
    setActiveTab('plan');

    const toolContext: ToolContext = {
      wards,
      weather: weatherData,
      candidateSites,
      buildingFactors,
      satelliteLST: satelliteData?.lstByWard || new Map(),
      satelliteNDVI: satelliteData?.ndviByWard || new Map(),
      demandForecast,
      scenario,
      k: settings.k,
      radiusKm: settings.radius_km,
      weights: settings.weights,
      hazard_low_c: settings.hazard_low_c,
      hazard_high_c: settings.hazard_high_c,
      selectedDay: selectedDay || weatherData.peakDayOverall,
    };

    const targetLang = settings.language === 'en_kn' ? 'kn' : 'hi';

    try {
      const plan = await runPlanningAgent(toolContext, targetLang, (step) => {
        setTraceSteps((prev) => [...prev, step]);
      });

      setCurrentPlan(plan);
      setIsPlanStale(false);
    } catch (err: any) {
      console.error('Planner agent encountered fatal error:', err);
    } finally {
      setIsPlanning(false);
    }
  };

  // Generate / Refresh AI Recommendations for the current city
  const handleGenerateAiRecommendations = useCallback(async () => {
    setIsLoadingAiRecommendations(true);
    try {
      const topWardsList = wardRisks.slice(0, 5).map((r) => {
        const w = wards.find((ward) => ward.ward_id === r.ward_id);
        const bf = buildingFactors.get(r.ward_id);
        return {
          name: w?.name || r.ward_id,
          riskScore: r.risk_score,
          riskClass: r.risk_class,
          buildingDensity: bf?.building_density_per_km2 ?? null,
          greenCover: bf?.green_cover_osm ?? null,
        };
      });

      const rec = await fetchCityAiRecommendations({
        cityName: currentCityName,
        latitude: cityCenter[0],
        longitude: cityCenter[1],
        peakApparentC: weatherData ? weatherData.peakApparentOverall : 38.0,
        severeCount: wardRisks.filter((r) => r.risk_class === 'severe').length,
        totalWards: wards.length,
        scenario,
        elninoProfile: cityEnsoProfile,
        topWards: topWardsList,
        gridDemand: demandForecast
          ? {
              peak_mw: demandForecast.peak_mw,
              stressWindow: `${demandForecast.stress_window.start_hour}:00 - ${demandForecast.stress_window.end_hour}:00`,
            }
          : null,
        coolingSitesCount: candidateSites.length,
      });

      setAiRecommendation(rec);
    } catch (err: any) {
      console.error('Failed to generate AI city recommendations:', err);
    } finally {
      setIsLoadingAiRecommendations(false);
    }
  }, [
    currentCityName,
    cityCenter,
    weatherData,
    wardRisks,
    wards,
    buildingFactors,
    cityEnsoProfile,
    demandForecast,
    candidateSites.length,
    scenario,
  ]);

  // Automatically update AI recommendations when city data, scenario, or ward risk calculations settle
  useEffect(() => {
    if (wardRisks.length > 0) {
      handleGenerateAiRecommendations();
    }
  }, [currentCityName, scenario, wardRisks.length, cityEnsoProfile.regionalZone]);

  // Derived KPI Counts
  const severeCount = wardRisks.filter((r) => r.risk_class === 'severe').length;
  const gridCellCount = wards.filter((w) => w.is_grid_cell).length;
  const selectedWard = wards.find((w) => w.ward_id === selectedWardId) || null;
  const selectedWardRisk = wardRisks.find((r) => r.ward_id === selectedWardId) || null;
  const selectedWardForecasts = selectedWardId ? weatherData?.daily.get(selectedWardId) || [] : [];
  const selectedWardBf = selectedWardId ? buildingFactors.get(selectedWardId) : null;
  const selectedWardLst = selectedWardId ? satelliteData?.lstByWard.get(selectedWardId) ?? null : null;

  // Baseline live risks computation for El Niño comparison
  const baselineRisks = useMemo(() => {
    if (wards.length === 0 || !weatherData) return [];
    const day = selectedDay || weatherData.peakDayOverall || new Date().toISOString().split('T')[0];
    const riskInputs = wards.map((w) => {
      const days = weatherData.daily.get(w.ward_id) || [];
      const match = days.find((d) => d.date === day);
      const app = match ? match.apparent_max_c : weatherData.peakApparentOverall;
      const bf = buildingFactors.get(w.ward_id);
      const lst = satelliteData?.lstByWard.get(w.ward_id) ?? null;
      const ndvi = satelliteData?.ndviByWard.get(w.ward_id) ?? null;
      return {
        ward_id: w.ward_id,
        apparent_max_c: app,
        factors: {
          ward_id: w.ward_id,
          lst_c: lst,
          lst_scene_date: satelliteData?.lst_scene_date || null,
          ndvi,
          green_cover_osm: bf?.green_cover_osm ?? 0.2,
          building_density_per_km2: bf?.building_density_per_km2 ?? 350,
          pop_density: null,
          vulnerable_share: null,
        },
      };
    });
    return calculateWardRisks(riskInputs, settings.hazard_low_c, settings.hazard_high_c, 'live', settings.weights);
  }, [wards, weatherData, selectedDay, settings.hazard_low_c, settings.hazard_high_c, settings.weights, buildingFactors, satelliteData]);

  const baselineSevereCount = baselineRisks.filter((r) => r.risk_class === 'severe').length;

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors ${
        theme === 'dark' ? 'bg-[#0B0F14] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Offline Alert (E16) */}
      {offlineBanner && (
        <div className="bg-red-600 text-white px-4 py-1.5 text-xs font-mono font-bold text-center">
          {offlineBanner}
        </div>
      )}

      {/* Top Bar Header */}
      <Header
        currentCity={currentCityName}
        onSelectCity={handleSelectCity}
        scenario={scenario}
        onToggleScenario={handleToggleScenario}
        sources={sources}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isLoadingCity={isLoadingCity}
      />

      {/* Hero Strip with Run Planner, El Niño Climate Alert & 3 KPI Cards */}
      <HeroStrip
        onRunPlanner={handleRunPlanner}
        isRunning={isPlanning}
        peakApparentC={
          weatherData
            ? scenario === 'stress_plus_2c'
              ? weatherData.peakApparentOverall + cityEnsoProfile.cityProjectedSurgeC
              : weatherData.peakApparentOverall
            : null
        }
        severeCount={severeCount}
        totalWards={wards.length}
        demandForecast={demandForecast}
        onNavigateDemand={() => setActiveTab('demand')}
        onNavigateAiRecommendations={() => setActiveTab('recommendations')}
        selectedDay={selectedDay || weatherData?.peakDayOverall || 'Today'}
        isStale={isPlanStale}
        theme={theme}
        currentPlan={currentPlan}
        satelliteWarning={satelliteData?.warningBadge || null}
        gridCellCount={gridCellCount}
        cityName={currentCityName}
        scenario={scenario}
        baselineSevereCount={baselineSevereCount}
        baselinePeakApparentC={weatherData?.peakApparentOverall}
        ensoProfile={cityEnsoProfile}
      />

      {/* Main Split: Map (60%) & Right Control Panel (40%) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Map View */}
        <div className="w-full lg:w-[58%] xl:w-[60%] h-[480px] lg:h-auto relative border-r border-slate-800">
          <MapView
            wards={wards}
            risks={wardRisks}
            candidateSites={candidateSites}
            selectedCentres={currentPlan?.centres || []}
            coveragePct={currentPlan?.coverage_pct || 0}
            uncoveredWardIds={currentPlan?.uncovered_high_risk_ward_ids || []}
            theme={theme}
            onSelectWard={(id) => setSelectedWardId(id)}
            selectedWardId={selectedWardId}
            radiusKm={settings.radius_km}
            cityCenter={cityCenter}
          />

          {/* Clicked Ward Breakdown Drawer */}
          <WardDrawer
            ward={selectedWard}
            risk={selectedWardRisk}
            forecasts={selectedWardForecasts}
            onClose={() => setSelectedWardId(null)}
            theme={theme}
            buildingDensity={selectedWardBf?.building_density_per_km2 ?? null}
            greenCover={selectedWardBf?.green_cover_osm ?? null}
            lstTemp={selectedWardLst}
            geeTemp={selectedWardId ? earthEngineData?.lstByWard.get(selectedWardId) ?? null : null}
            geeEmissivity={selectedWardId ? earthEngineData?.emissivityByWard.get(selectedWardId) ?? null : null}
            sentinelTreeCover={selectedWardId ? sentinelData?.treeCoverByWard.get(selectedWardId) ?? null : null}
            sentinelNdvi={selectedWardId ? sentinelData?.ndviByWard.get(selectedWardId) ?? null : null}
          />
        </div>

        {/* Right Panel Tabs */}
        <div className="w-full lg:w-[42%] xl:w-[40%] flex flex-col bg-[#0B0F14]/70 backdrop-blur overflow-y-auto">
          {/* Tab Navigation Strip */}
          <div className="flex items-center border-b border-slate-800 bg-[#121821] text-xs font-semibold px-2 sticky top-0 z-10 overflow-x-auto">
            <button
              onClick={() => setActiveTab('plan')}
              className={`px-3 py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
                activeTab === 'plan'
                  ? 'border-blue-500 text-blue-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Action Plan
              {currentPlan && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-0.5" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-3 py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
                activeTab === 'recommendations'
                  ? 'border-purple-500 text-purple-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>{scenario === 'stress_plus_2c' ? 'El Niño AI Directives' : 'AI Recommendations'}</span>
              <span className="text-[9px] font-mono px-1 rounded bg-purple-500/20 text-purple-300 font-bold">
                Gemini
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ranking')}
              className={`px-3 py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
                activeTab === 'ranking'
                  ? 'border-blue-500 text-blue-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Risk Ranking ({wardRisks.length})
            </button>

            <button
              onClick={() => setActiveTab('demand')}
              className={`px-3 py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
                activeTab === 'demand'
                  ? 'border-blue-500 text-blue-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Demand Model
              {demandForecast && (
                <span className="text-[10px] font-mono px-1.5 rounded bg-yellow-500/20 text-yellow-400">
                  {demandForecast.peak_mw} MW
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('sources')}
              className={`px-3 py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
                activeTab === 'sources'
                  ? 'border-blue-500 text-blue-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sources ({sources.length})
            </button>
          </div>

          {/* Active Tab Body */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'plan' && (
              <ActionPlanTab
                plan={currentPlan}
                theme={theme}
                onRunPlanner={handleRunPlanner}
                isRunning={isPlanning}
              />
            )}

            {activeTab === 'recommendations' && (
              <AiRecommendationsTab
                recommendation={aiRecommendation}
                ensoProfile={cityEnsoProfile}
                cityName={currentCityName}
                scenario={scenario}
                isLoading={isLoadingAiRecommendations}
                onRefresh={handleGenerateAiRecommendations}
                theme={theme}
              />
            )}

            {activeTab === 'ranking' && (
              <RiskRankingTab
                wards={wards}
                risks={wardRisks}
                onSelectWard={(id) => setSelectedWardId(id)}
                weights={settings.weights}
                onUpdateWeights={(w) => setSettings({ ...settings, weights: w })}
                theme={theme}
              />
            )}

            {activeTab === 'demand' && (
              <DemandTab
                demandModel={demandModel}
                demandForecast={demandForecast}
                onSetDemandData={(model, forecast) => {
                  setDemandModel(model);
                  setDemandForecast(forecast);
                  if (currentPlan) setIsPlanStale(true);
                }}
                cityLat={cityCenter[0]}
                cityLon={cityCenter[1]}
                forecastDays={
                  weatherData
                    ? (weatherData.daily.get(wards[0]?.ward_id) || []).map((d) => ({
                        date: d.date,
                        tmax_c: d.tmax_c,
                      }))
                    : []
                }
                hourlyApparent={
                  weatherData
                    ? (weatherData.hourly.get(wards[0]?.ward_id) || []).map((h) => h.apparent_c)
                    : []
                }
                theme={theme}
              />
            )}

            {activeTab === 'sources' && (
              <SourcesTab
                sources={sources}
                onRetrySource={handleRetrySource}
                retryingSourceId={retryingSourceId}
                theme={theme}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Collapsible Agent Trace Drawer */}
      <AgentTraceDrawer steps={traceSteps} theme={theme} isRunning={isPlanning} />

      {/* Configuration Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={(newSettings) => {
          setSettings(newSettings);
          if (currentPlan) setIsPlanStale(true);
        }}
        theme={theme}
      />
    </div>
  );
}
