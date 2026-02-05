import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Sun, 
  Battery, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Home, 
  Zap, 
  CloudSun, 
  ArrowRight, 
  RefreshCcw,
  Wind,
  Droplets,
  Car,
  Calculator,
  LayoutDashboard,
  Waves,
  Fish,
  PlugZap,
  DollarSign,
  Banknote,
  PiggyBank,
  CalendarDays,
  Coins,
  Moon,
  Cloud
} from 'lucide-react';

/**
 * CONSTANTS & CALCULATIONS (Malaysian Context)
 */
const TARIFF_TIERS = [
  { limit: 200, rate: 0.218 },
  { limit: 100, rate: 0.334 }, // 201-300
  { limit: 300, rate: 0.516 }, // 301-600
  { limit: 300, rate: 0.546 }, // 601-900
  { limit: Infinity, rate: 0.571 } // >900
];

const NEM_EXPORT_RATE = 0.24; // Approx avg selling price (simplified)
const AVG_GRID_RATE = 0.45; // Blended avg buying price for estimation
const SOLAR_YIELD_PER_KW = 3.5; // kWh/day per kWp
const SYSTEM_COST_PER_KW = 2800; // Competitive rate
const BATTERY_COST_PER_KWH = 1200; // Affordable modular storage

// Helper: Calculate Bill from kWh
const calculateKwhToBill = (kwh) => {
  let remaining = kwh;
  let totalBill = 0;
  for (const tier of TARIFF_TIERS) {
    const amountInTier = Math.min(remaining, tier.limit);
    if (amountInTier > 0) {
        totalBill += amountInTier * tier.rate;
        remaining -= amountInTier;
    }
    if (remaining <= 0) break;
  }
  return totalBill; 
};

// Helper: Estimate kWh from Bill (Reverse Calc)
const calculateBillToKwh = (billAmount) => {
  let remainingBill = billAmount;
  let totalKwh = 0;
  
  for (const tier of TARIFF_TIERS) {
    const tierCost = tier.limit * tier.rate;
    if (remainingBill <= tierCost) {
      totalKwh += remainingBill / tier.rate;
      remainingBill = 0;
      break;
    } else {
      totalKwh += tier.limit;
      remainingBill -= tierCost;
    }
  }
  if (remainingBill > 0) { // Top tier
      totalKwh += remainingBill / TARIFF_TIERS[TARIFF_TIERS.length - 1].rate;
  }
  return totalKwh;
};

const APPLIANCES = [
  { id: 'ac', name: 'Air Con', icon: <Wind className="w-5 h-5 text-white" />, load: 1.5, color: 'bg-blue-500', costColor: 'text-blue-600' },
  { id: 'wm', name: 'Washer', icon: <Waves className="w-5 h-5 text-white" />, load: 0.8, color: 'bg-purple-500', costColor: 'text-purple-600' },
  { id: 'dw', name: 'Dishwasher', icon: <Droplets className="w-5 h-5 text-white" />, load: 1.2, color: 'bg-indigo-500', costColor: 'text-indigo-600' },
];

export default function SolarSimulator() {
  const [step, setStep] = useState(1); // 1: Audit, 2: Strategy, 3: Simulation, 4: Report
  
  // Phase 1: Audit State
  const [audit, setAudit] = useState({
    currentBill: 450,
    housePhase: 'Single',
    roofType: 'Pitched',
    residentProfile: '9-to-5', // '9-to-5' or 'Home'
    futureEV: false,
    futurePool: false,
    futurePond: false
  });

  // Phase 2: Strategy State
  const [schedule, setSchedule] = useState({});
  const [selectedTool, setSelectedTool] = useState(null);
  const [hasBattery, setHasBattery] = useState(false);
  const [batterySize, setBatterySize] = useState(5); // Default to smaller 5kWh start

  // Phase 3: Simulation State
  const [simProgress, setSimProgress] = useState(0);
  const [simStats, setSimStats] = useState({
    tankLevel: 0,
    gridExport: 0,
    gridImport: 0,
    solarGenerated: 0,
    houseConsumed: 0
  });

  // Phase 4: Report & Finance State
  const [finalReport, setFinalReport] = useState(null);
  const [finance, setFinance] = useState({
    subsidy: 10000,
    tenureYears: 5,
    interestRate: 2.5,
    includeBattery: true 
  });

  // --- Derived Calculations ---
  const currentKwhUsage = useMemo(() => calculateBillToKwh(audit.currentBill), [audit.currentBill]);
  
  const recommendedSystemSize = useMemo(() => {
    // Target to offset 90% of usage (sweet spot)
    const dailyKwh = currentKwhUsage / 30;
    return Math.min(15, Math.max(3, Math.ceil((dailyKwh * 0.9) / SOLAR_YIELD_PER_KW)));
  }, [currentKwhUsage]);

  const panelCost = recommendedSystemSize * SYSTEM_COST_PER_KW;
  const batteryCost = hasBattery ? batterySize * BATTERY_COST_PER_KWH : 0;
  const estimatedTotalCost = panelCost + batteryCost;

  // --- Handlers ---

  const toggleScheduleItem = (hour) => {
    if (!selectedTool) return;
    
    // Check constraints
    const isWorkHours = hour >= 9 && hour <= 17;
    const isOfficeWorker = audit.residentProfile === '9-to-5';
    const isLocked = isOfficeWorker && isWorkHours;

    if (isLocked) {
        alert("Client is at work during these hours! Add a battery to schedule usage here.");
        return;
    }

    setSchedule(prev => {
      const currentItems = prev[hour] || [];
      const exists = currentItems.includes(selectedTool);
      let newItems;
      if (exists) {
        newItems = currentItems.filter(id => id !== selectedTool);
      } else {
        newItems = [...currentItems, selectedTool];
      }
      return { ...prev, [hour]: newItems };
    });
  };

  const runSimulation = () => {
    setStep(3);
    setSimProgress(0);
    
    // Reset stats
    let currentStats = {
      tankLevel: 0,
      gridExport: 0,
      gridImport: 0,
      solarGenerated: 0,
      houseConsumed: 0,
      wastedMoney: 0
    };

    let day = 0;
    const totalDays = 30;
    const animationSpeed = 75; // ms per tick

    const interval = setInterval(() => {
      day += 0.5; // Half day increments for faster anim
      const progress = (day / totalDays) * 100;
      setSimProgress(progress);

      // Simulate a "Day" cycle (Simplified aggregate)
      const dailySolar = recommendedSystemSize * SOLAR_YIELD_PER_KW;
      
      // Calculate Daily Consumption based on Strategy
      let dailyBaseLoad = 5; // Fridge etc
      if (audit.futurePond) dailyBaseLoad += 4;
      if (audit.futurePool) dailyBaseLoad += 6;
      
      let dailyActiveLoad = 0;
      Object.entries(schedule).forEach(([hour, apps]) => {
         apps.forEach(appId => {
             const app = APPLIANCES.find(a => a.id === appId);
             dailyActiveLoad += app.load;
         });
      });
      if (audit.futureEV) dailyActiveLoad += 12; // Big chunk

      const totalDailyConsumption = dailyBaseLoad + dailyActiveLoad;

      // Smart Logic: Solar covers day load first, then battery, then grid
      
      // 1. Generation Phase (Daytime)
      const sunWindowConsumption = calculateLoadInWindow(11, 15); 
      const solarUsedDirectly = Math.min(dailySolar, sunWindowConsumption + (dailyBaseLoad * 0.4));
      let excessSolar = Math.max(0, dailySolar - solarUsedDirectly);

      // 2. Storage Phase
      let toBattery = 0;
      if (hasBattery) {
          toBattery = Math.min(excessSolar, batterySize);
          excessSolar -= toBattery;
      }

      // 3. Export Phase (Waste)
      const exported = excessSolar;
      
      // 4. Night/Evening Consumption
      const remainingLoad = Math.max(0, totalDailyConsumption - solarUsedDirectly);
      let fromBattery = 0;
      if (hasBattery) {
          fromBattery = Math.min(remainingLoad, toBattery); // Can only use what we stored
      }
      const imported = Math.max(0, remainingLoad - fromBattery);

      // Accumulate
      currentStats.solarGenerated += dailySolar / 2; // /2 because we run 2 ticks per day in loop
      currentStats.houseConsumed += totalDailyConsumption / 2;
      currentStats.gridExport += exported / 2;
      currentStats.gridImport += imported / 2;
      currentStats.tankLevel = hasBattery ? (toBattery / batterySize) * 100 : 0;
      
      setSimStats({...currentStats});

      if (day >= totalDays) {
        clearInterval(interval);
        calculateFinalReport(currentStats);
        setTimeout(() => setStep(4), 1000);
      }
    }, animationSpeed);
  };

  const calculateLoadInWindow = (start, end) => {
      let load = 0;
      for (let i = start; i <= end; i++) {
          const apps = schedule[i] || [];
          apps.forEach(appId => {
              const app = APPLIANCES.find(a => a.id === appId);
              load += app.load;
          });
          // Add baseload portion
          load += (0.2); // constant base
      }
      return load;
  };

  const calculateFinalReport = (stats) => {
      const oldBill = audit.currentBill;
      
      // New Bill Logic
      const importCost = calculateKwhToBill(stats.gridImport);
      const exportCredit = stats.gridExport * NEM_EXPORT_RATE;
      const newBill = Math.max(0, importCost - exportCredit);
      
      // The "Trap" Calculation
      const potentialValueIfUsed = stats.gridExport * AVG_GRID_RATE; 
      const actualValueSold = stats.gridExport * NEM_EXPORT_RATE;
      const lossAmount = potentialValueIfUsed - actualValueSold;

      const monthlySavings = oldBill - newBill;

      setFinalReport({
          oldBill,
          newBill,
          monthlySavings,
          totalGenerated: stats.solarGenerated,
          totalUsed: stats.houseConsumed - stats.gridImport, // Self consumed
          totalExported: stats.gridExport,
          lossAmount,
      });
  };

  // --- Render Components ---

  const renderAudit = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-4 sm:p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-orange-500"/> Phase 1: The Audit
        </h2>
        
        {/* Bill Slider */}
        <div className="mb-8">
            <label className="block text-sm font-semibold text-slate-600 mb-2">Monthly Electricity Bill</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <input 
                    type="range" min="100" max="1500" step="10" 
                    value={audit.currentBill}
                    onChange={(e) => setAudit({...audit, currentBill: parseInt(e.target.value)})}
                    className="w-full h-4 bg-slate-200 rounded-full appearance-none cursor-pointer accent-orange-500"
                />
                <div className="sm:min-w-[120px] sm:text-right">
                    <span className="text-2xl sm:text-3xl font-bold text-slate-800">RM {audit.currentBill}</span>
                </div>
            </div>
            {audit.currentBill < 350 && (
                <div className="mt-2 flex items-center text-amber-600 bg-amber-50 p-2 rounded-lg text-sm">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    <span>Efficiency Warning: ROI may exceed 8 years at this bill level.</span>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Toggles */}
            <div className="space-y-4">
                <label className="text-sm font-semibold text-slate-600">Resident Profile</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setAudit({...audit, residentProfile: '9-to-5'})}
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${audit.residentProfile === '9-to-5' ? 'bg-white shadow-md text-slate-800' : 'text-slate-500'}`}
                    >
                        🏢 9-to-5 Worker
                    </button>
                    <button 
                        onClick={() => setAudit({...audit, residentProfile: 'Home'})}
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${audit.residentProfile === 'Home' ? 'bg-white shadow-md text-slate-800' : 'text-slate-500'}`}
                    >
                        🏠 Home All Day
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <label className="text-sm font-semibold text-slate-600">Future Plans</label>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setAudit({...audit, futureEV: !audit.futureEV})}
                        className={`flex-1 py-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${audit.futureEV ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-400'}`}
                    >
                        <Car className="w-5 h-5"/> <span className="text-xs font-bold">EV</span>
                    </button>
                    <button 
                        onClick={() => setAudit({...audit, futurePool: !audit.futurePool})}
                        className={`flex-1 py-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${audit.futurePool ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-slate-200 text-slate-400'}`}
                    >
                        <Waves className="w-5 h-5"/> <span className="text-xs font-bold">Pool</span>
                    </button>
                    <button 
                        onClick={() => setAudit({...audit, futurePond: !audit.futurePond})}
                        className={`flex-1 py-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${audit.futurePond ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-400'}`}
                    >
                        <Fish className="w-5 h-5"/> <span className="text-xs font-bold">Pond</span>
                    </button>
                </div>
            </div>
        </div>
      </div>
      
            <button 
                onClick={() => setStep(2)}
                className="w-full py-3.5 sm:py-4 bg-slate-900 text-white rounded-2xl text-base sm:text-lg font-bold hover:bg-slate-800 flex items-center justify-center transition-all shadow-lg shadow-slate-200"
            >
        Start Strategy Session <ArrowRight className="ml-2 w-5 h-5" />
      </button>
    </div>
  );

  const renderStrategy = () => {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-500">
        <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
                <LayoutDashboard className="w-5 h-5 mr-2 text-orange-500"/> Phase 2: Usage Strategy
            </h2>
            <div className="text-[11px] sm:text-xs font-medium px-3 py-1 bg-slate-100 rounded-full text-slate-500">
                System: {recommendedSystemSize} kWp
            </div>
        </div>

        {/* The Timeline */}
        <div className="bg-white p-3 sm:p-4 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="hidden md:flex justify-between text-xs font-bold text-slate-400 mb-2 px-1">
                <span>6 AM</span>
                <span className="text-orange-500">NOON (Peak Sun)</span>
                <span>6 PM</span>
                <span>MIDNIGHT</span>
            </div>
            
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2 md:gap-1 mb-6">
                {Array.from({ length: 24 }).map((_, i) => {
                    const isSunWindow = i >= 11 && i <= 15;
                    const isWorkHours = i >= 9 && i <= 17;
                    const isLocked = audit.residentProfile === '9-to-5' && isWorkHours;
                    const appliances = schedule[i] || [];

                    let bgClass = "bg-slate-100";
                    if (isSunWindow) bgClass = "bg-orange-50 border-orange-200";
                    if (isLocked) bgClass = "bg-slate-200 opacity-60 cursor-not-allowed pattern-diagonal-lines";

                    return (
                        <button
                            key={i}
                            onClick={() => toggleScheduleItem(i)}
                            className={`
                                relative h-14 sm:h-16 md:h-20 rounded-md border border-slate-200 flex flex-col items-center justify-end pb-1 transition-all
                                hover:border-slate-300
                                ${bgClass} 
                                ${selectedTool && !isLocked ? 'hover:bg-blue-50 ring-2 ring-transparent hover:ring-blue-200' : ''}
                            `}
                        >
                            {/* Hour Label */}
                            <span className="absolute top-1 left-1 text-[8px] sm:text-[9px] text-slate-400 font-mono">{i}</span>
                            
                            {/* Icons in slot - Updated for better overflow handling */}
                            <div className="flex flex-wrap-reverse justify-center content-end gap-1 w-full px-0.5 mb-0.5">
                                {appliances.map((appId, idx) => {
                                    const app = APPLIANCES.find(a => a.id === appId);
                                    const isFree = isSunWindow || hasBattery; 
                                    const colorClass = isFree ? "bg-green-500" : "bg-red-500";
                                    return (
                                        <div key={`${i}-${idx}`} className={`p-1 rounded-full ${colorClass} shadow-sm`} title={app.name}>
                                            {React.cloneElement(app.icon, { className: "w-2.5 h-2.5 text-white" })}
                                        </div>
                                    );
                                })}
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tools */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-3">1. Select Appliance to Schedule</h3>
                    <div className="flex gap-2">
                        {APPLIANCES.map(app => (
                            <button
                                key={app.id}
                                onClick={() => setSelectedTool(selectedTool === app.id ? null : app.id)}
                                className={`flex-1 py-3 px-2 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${selectedTool === app.id ? `${app.color} text-white border-transparent shadow-lg scale-105` : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-white'}`}
                            >
                                {app.icon}
                                <span className="text-xs font-bold mt-1">{app.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Hardware */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-3">2. System Upgrades</h3>
                    <div className={`rounded-xl border-2 transition-all p-1 ${hasBattery ? 'border-green-500 bg-green-50' : 'border-slate-200'}`}>
                        <button
                            onClick={() => setHasBattery(!hasBattery)}
                            className={`w-full py-3 px-3 rounded-lg flex items-center justify-between transition-all ${hasBattery ? 'bg-white shadow-sm text-green-800' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <Battery className={hasBattery ? "fill-green-600" : ""} />
                                <div className="text-left">
                                    <div className="font-bold text-sm">Add Battery Storage</div>
                                    <div className="text-[10px] opacity-70">Unlocks night-time savings</div>
                                </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${hasBattery ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}>
                                {hasBattery && <CheckCircle2 className="w-4 h-4 text-white" />}
                            </div>
                        </button>
                        
                        {/* Battery Sizing Slider - NEW */}
                        {hasBattery && (
                            <div className="px-3 pb-3 pt-2 animate-in slide-in-from-top-2 fade-in">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs font-bold text-green-700">Capacity: {batterySize} kWh</span>
                                    <span className="text-[10px] font-mono text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                        +RM {(batterySize * BATTERY_COST_PER_KWH).toLocaleString()}
                                    </span>
                                </div>
                                <input 
                                    type="range" min="5" max="30" step="5"
                                    value={batterySize}
                                    onChange={(e) => setBatterySize(Number(e.target.value))}
                                    className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                                />
                                <div className="flex justify-between text-[9px] text-green-600/60 mt-1 font-medium px-1">
                                    <span>Small (5kWh)</span>
                                    <span>Large (30kWh)</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        <button 
            onClick={runSimulation}
            className="w-full py-3.5 sm:py-4 bg-orange-500 text-white rounded-2xl text-base sm:text-lg font-bold hover:bg-orange-600 flex items-center justify-center transition-all shadow-lg shadow-orange-200 mt-6"
        >
            <Zap className="mr-2 w-5 h-5 fill-white" /> Run 30-Day Simulation
        </button>
      </div>
    );
  };

  const renderSimulation = () => {
    // Calculate rotation for celestial bodies (0 to 100 progress -> 0 to 4 full rotations for visual effect)
    // We want it to loop a few times to show "days passing" without strobing too fast
    const cycleCount = 4;
    const rotation = simProgress * (360 * cycleCount / 100); 
    const normalizedRotation = rotation % 360;
    
    // Sky Color Logic (align day/night with sun position)
    let skyClass = "bg-sky-400"; // Day
    if (normalizedRotation > 150 && normalizedRotation < 210) skyClass = "bg-orange-400"; // Sunset/Sunrise
    else if (normalizedRotation >= 210 && normalizedRotation <= 330) skyClass = "bg-slate-900"; // Night

    return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-8 py-6 sm:py-10 animate-in zoom-in-95 duration-700 max-w-5xl mx-auto">
        
        {/* 1. Visualizer: The Sky Window */}
        <div className="relative group shrink-0">
           {/* Main Circle */}
           <div className={`w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-full overflow-hidden border-8 border-slate-800 relative z-10 shadow-2xl transition-colors duration-500 ${skyClass}`}>
               
               {/* Celestial Container - Rotates */}
               <div 
                  className="absolute inset-0 transition-transform duration-75 ease-linear"
                  style={{ transform: `rotate(${rotation}deg)` }}
               >
                   {/* Sun */}
                   <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-12 bg-yellow-400 rounded-full shadow-[0_0_40px_rgba(250,204,21,0.6)] flex items-center justify-center">
                       <Sun className="text-yellow-100 w-8 h-8 animate-pulse" />
                   </div>

                    {/* Moon */}
                   <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-slate-100 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.4)] flex items-center justify-center transform rotate-180">
                       <Moon className="text-slate-400 w-6 h-6" />
                   </div>
               </div>

               {/* Clouds (Parallax effect optional, keep simple for performance) */}
               <Cloud className="absolute top-12 right-10 text-white/30 w-16 h-16" />
               <Cloud className="absolute top-24 left-4 text-white/20 w-12 h-12" />

               {/* House Silhouette (Static Foreground) */}
               <div className="absolute bottom-0 left-0 right-0 h-24 flex items-end justify-center z-20">
                   {/* Ground */}
                   <div className="absolute bottom-0 w-full h-8 bg-emerald-900/50 backdrop-blur-sm z-10"></div>
                   {/* House Icon */}
                   <Home className="w-20 h-20 sm:w-24 sm:h-24 text-slate-800 fill-slate-800 relative z-20 -mb-2" />
                   {/* Battery Indicator on House */}
                   {hasBattery && (
                       <div className="absolute bottom-4 right-12 sm:right-16 z-30 bg-green-500 rounded px-1.5 py-0.5 shadow-lg animate-pulse">
                           <Battery className="w-3 h-3 text-white fill-white" />
                       </div>
                   )}
               </div>
           </div>
           
           {/* Progress Ring / Time Indicator */}
           <div className="absolute -inset-4 rounded-full border-2 border-slate-200 border-dashed animate-spin-slow opacity-30 z-0"></div>
        </div>

        {/* 2. Stats Panel (Right Side) */}
        <div className="w-full max-w-sm space-y-5">
            {/* Header with Day Counter */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Simulating Usage</h2>
                    <div className="text-xs text-slate-500">Calculating grid interactions...</div>
                </div>
                <div className="text-right">
                     <div className="text-xs font-bold uppercase text-slate-400">Time Elapsed</div>
                     <div className="text-3xl font-mono font-bold text-slate-800 tabular-nums">
                        Day {Math.min(30, Math.floor((simProgress / 100) * 30))}
                     </div>
                </div>
            </div>

            {/* Live Metrics Cards */}
            <div className="space-y-3">
                 {/* Solar Production */}
                 <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                         <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                             <Sun className="w-5 h-5" />
                         </div>
                         <div>
                             <div className="text-xs font-bold text-orange-600 uppercase">Generated</div>
                             <div className="text-sm text-orange-800/70">Potential Energy</div>
                         </div>
                     </div>
                     <div className="text-xl font-bold text-orange-700 tabular-nums">
                         {Math.round(simStats.solarGenerated)} <span className="text-xs font-medium">kWh</span>
                     </div>
                 </div>

                 {/* Grid Import */}
                 <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                         <div className="p-2 bg-red-100 rounded-lg text-red-600">
                             <Zap className="w-5 h-5 fill-red-600" />
                         </div>
                         <div>
                             <div className="text-xs font-bold text-red-600 uppercase">Grid Import</div>
                             <div className="text-sm text-red-800/70">Billable Usage</div>
                         </div>
                     </div>
                     <div className="text-xl font-bold text-red-700 tabular-nums">
                         {Math.round(simStats.gridImport)} <span className="text-xs font-medium">kWh</span>
                     </div>
                 </div>

                 {/* Battery/Self-Use */}
                 <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                         <div className="p-2 bg-green-100 rounded-lg text-green-600">
                             {hasBattery ? <Battery className="w-5 h-5" /> : <Home className="w-5 h-5" />}
                         </div>
                         <div>
                             <div className="text-xs font-bold text-green-600 uppercase">Direct Use</div>
                             <div className="text-sm text-green-800/70">{hasBattery ? 'Battery + Direct' : 'Self-Consumption'}</div>
                         </div>
                     </div>
                     <div className="text-xl font-bold text-green-700 tabular-nums">
                         {Math.round(simStats.houseConsumed - simStats.gridImport)} <span className="text-xs font-medium">kWh</span>
                     </div>
                 </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                    className="bg-slate-800 h-full transition-all duration-75" 
                    style={{ width: `${simProgress}%` }}
                ></div>
            </div>
        </div>
      </div>
    );
  };

  const renderReport = () => {
    if (!finalReport) return null;

    // Financial Calcs
    const financedAmount = finance.includeBattery ? estimatedTotalCost : panelCost;
    const loanPrincipal = Math.max(0, financedAmount - finance.subsidy);
    const totalInterest = loanPrincipal * (finance.interestRate / 100) * finance.tenureYears;
    const totalLoanPayable = loanPrincipal + totalInterest;
    const monthlyInstallment = totalLoanPayable / (finance.tenureYears * 12);
    
    // Monthly Cashflow
    const newMonthlyCommitment = finalReport.newBill + monthlyInstallment;
    const monthlyNetSavings = finalReport.oldBill - newMonthlyCommitment;
    const isCashflowPositive = monthlyNetSavings > 0;
    
    // Breakeven Month Calculation
    let monthsToBreakeven = 0;
    let breakEvenText = "Immediate";
    if (!isCashflowPositive) {
       monthsToBreakeven = Math.abs(monthlyNetSavings * (finance.tenureYears * 12)) / (finalReport.monthlySavings);
       breakEvenText = `${Math.ceil(monthsToBreakeven)} Months`;
    }

    const isTrapDetected = finalReport.lossAmount > 50;

    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700 pb-10">
        
        {/* Section 1: Bill Swap Cashflow Visualizer */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-xl border border-slate-200">
             <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
                    <Banknote className="w-5 h-5 mr-2 text-green-600"/> The "Bill Swap" Strategy
                </h2>
                <div className="flex gap-2">
                    <div className="bg-green-50 text-green-700 px-3 py-1 rounded-lg text-xs font-bold border border-green-200">
                        SolaRIS Applied
                    </div>
                </div>
             </div>

             {/* Finance Controls */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-6 bg-slate-50 p-3 sm:p-4 rounded-xl">
                 <div>
                     <label className="text-[9px] font-bold text-slate-500 uppercase">Subsidy (RM)</label>
                     <input 
                        type="number" 
                        value={finance.subsidy}
                        onChange={(e) => setFinance({...finance, subsidy: Number(e.target.value)})}
                        className="w-full bg-white border border-slate-200 rounded p-1 text-sm font-bold text-slate-700"
                     />
                 </div>
                 <div>
                     <label className="text-[9px] font-bold text-slate-500 uppercase">Loan (Yrs)</label>
                     <select 
                        value={finance.tenureYears}
                        onChange={(e) => setFinance({...finance, tenureYears: Number(e.target.value)})}
                        className="w-full bg-white border border-slate-200 rounded p-1 text-sm font-bold text-slate-700"
                     >
                         <option value="3">3 Years</option>
                         <option value="5">5 Years</option>
                         <option value="7">7 Years</option>
                     </select>
                 </div>
                 <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Loan Amount</label>
                    <div className="text-sm font-bold text-slate-800 mt-1">RM {(loanPrincipal/1000).toFixed(1)}k</div>
                 </div>
                 
                 {hasBattery && (
                     <div className="flex items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={finance.includeBattery}
                                onChange={(e) => setFinance({...finance, includeBattery: e.target.checked})}
                                className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500"
                            />
                            <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight">Include Battery in Loan?</span>
                        </label>
                     </div>
                 )}
             </div>

             {/* Visual Comparison */}
             <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-stretch">
                 {/* Before */}
                 <div className="flex-1 bg-slate-100 rounded-xl p-3 sm:p-4 flex flex-col justify-between opacity-70">
                     <div className="text-center text-sm font-semibold text-slate-500 mb-2">CURRENT REALITY</div>
                     <div className="flex flex-col items-center justify-center flex-grow space-y-2">
                        <div className="w-full bg-slate-400 text-white py-4 rounded-lg text-center font-bold">
                            TNB: RM {finalReport.oldBill}
                        </div>
                     </div>
                     <div className="text-center font-bold text-slate-600 mt-4 text-xl">RM {finalReport.oldBill}</div>
                 </div>

                 <div className="flex items-center justify-center">
                    <ArrowRight className="text-slate-300 w-8 h-8" />
                 </div>

                 {/* After (Years 1-5) */}
                 <div className="flex-1 bg-white border-2 border-green-500 rounded-xl p-3 sm:p-4 flex flex-col relative overflow-hidden shadow-lg">
                     <div className="absolute top-0 left-0 w-full bg-green-500 text-white text-[10px] font-bold text-center py-1">YEARS 1-{finance.tenureYears}</div>
                     <div className="text-center text-sm font-semibold text-slate-500 mb-2 mt-4">NEW COMMITMENT</div>
                     <div className="flex flex-col items-center justify-center flex-grow w-full space-y-2">
                        <div className="w-full bg-blue-600 text-white py-3 rounded-lg text-center font-bold shadow-sm flex justify-between px-4 items-center">
                            <span className="text-xs opacity-80">BANK</span>
                            <span>RM {Math.round(monthlyInstallment)}</span>
                        </div>
                        <div className="w-full bg-slate-600 text-white py-2 rounded-lg text-center font-bold shadow-sm flex justify-between px-4 items-center">
                            <span className="text-xs opacity-80">TNB</span>
                            <span>RM {Math.round(finalReport.newBill)}</span>
                        </div>
                     </div>
                     <div className="flex justify-between items-end mt-4 border-t pt-2">
                         <div className="text-xs text-slate-500">Total Out:</div>
                         <div className="text-center font-bold text-green-600 text-xl">RM {Math.round(newMonthlyCommitment)}</div>
                     </div>
                 </div>
             </div>

             {/* The Verdict */}
             <div className={`mt-6 p-3 sm:p-4 rounded-xl flex items-center justify-between ${isCashflowPositive ? 'bg-green-100 text-green-900' : 'bg-amber-50 text-amber-900'}`}>
                 <div className="flex items-center">
                     {isCashflowPositive ? <PiggyBank className="w-8 h-8 mr-3 text-green-600"/> : <TrendingDown className="w-8 h-8 mr-3 text-amber-600"/>}
                     <div>
                         <div className="font-bold text-base sm:text-lg">{isCashflowPositive ? 'Cashflow Positive Day 1' : 'Short Term Investment'}</div>
                         <div className="text-sm opacity-80">
                             {isCashflowPositive 
                                ? `You save RM ${Math.round(monthlyNetSavings)} extra every month while paying the loan.` 
                                : `You pay RM ${Math.abs(Math.round(monthlyNetSavings))} extra for ${finance.tenureYears} years to own the asset.`}
                         </div>
                     </div>
                 </div>
                 <div className="text-right">
                     <div className="text-xs font-bold opacity-60 uppercase">{isCashflowPositive ? 'Instant Savings' : 'Breakeven'}</div>
                     <div className="text-xl sm:text-2xl font-bold">{isCashflowPositive ? 'IMMEDIATE' : breakEvenText}</div>
                 </div>
             </div>
        </div>

        {/* Section 2: Technical Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 text-xs font-bold uppercase mb-2">System Size</div>
                <div className="text-xl sm:text-2xl font-bold text-slate-800">{recommendedSystemSize} kWp</div>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 text-xs font-bold uppercase mb-2">Total Project Value</div>
                <div className="text-xl sm:text-2xl font-bold text-slate-800">RM {(estimatedTotalCost / 1000).toFixed(1)}k</div>
            </div>
        </div>

        {/* The 60% Trap Highlight (Reduced size) */}
        {isTrapDetected && !hasBattery && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                <h3 className="font-bold text-red-900 text-sm flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2"/> Efficiency Alert: The "60% Trap"
                </h3>
                <p className="text-red-700 text-xs mt-1">
                    Exporting <strong>{Math.round(finalReport.totalExported)} kWh</strong> back to grid creates a lost value of <strong>RM {Math.round(finalReport.lossAmount)}/mo</strong>. 
                    <button onClick={() => {setStep(2); setHasBattery(true);}} className="underline ml-1 font-bold">Add Battery to fix.</button>
                </p>
            </div>
        )}

        <button 
            onClick={() => { setStep(1); setSimStats({}); setFinalReport(null); }}
            className="w-full py-3.5 sm:py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center shadow-xl"
        >
            <RefreshCcw className="w-4 h-4 mr-2" /> Start New Client Audit
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-orange-100">
      {/* App Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                      <Sun className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="font-bold text-base sm:text-lg tracking-tight">Solar <span className="text-orange-500">Pro</span></span>
              </div>
              <div className="flex items-center gap-2">
                  {step > 1 && (
                      <button
                          type="button"
                          onClick={() => setStep(prev => Math.max(1, prev - 1))}
                          className="px-2.5 py-1 text-xs sm:text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all"
                      >
                          Back
                      </button>
                  )}
                  <div className="flex gap-1">
                      {[1,2,3,4].map(s => (
                          <div key={s} className={`h-1.5 w-5 sm:w-6 rounded-full transition-all ${step >= s ? 'bg-orange-500' : 'bg-slate-200'}`} />
                      ))}
                  </div>
              </div>
          </div>
      </div>

      <main className="max-w-3xl mx-auto px-3 py-4 sm:p-4 md:p-6 pb-16 sm:pb-24">
        {step === 1 && renderAudit()}
        {step === 2 && renderStrategy()}
        {step === 3 && renderSimulation()}
        {step === 4 && renderReport()}
      </main>
    </div>
  );
}