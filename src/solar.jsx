import React, { useState, useMemo } from 'react';
import { 
  Sun, 
    Battery, 
  AlertTriangle, 
  CheckCircle2, 
  Home, 
  Zap, 
  ArrowRight, 
  RefreshCcw,
  Car,
  Calculator,
  LayoutDashboard,
  Waves,
  Fish,
  PiggyBank,
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
const TNB_RATE_PER_KWH = 0.5; // Fixed rate per kWh for TNB
const EXPORT_RATE_FACTOR = 0.7; // Export credit as % of TNB rate (no battery)
const BATTERY_EXPORT_FACTOR = 0.3; // Export credit as % of TNB rate (excess after battery)
const BATTERY_UNIT_KWH = 10; // Each battery module is 10kWh

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

export default function SolarSimulator() {
    const [step, setStep] = useState(0); // 0: Testimonials, 1: Welcome, 2: Audit, 3: Strategy, 4: Simulation, 5: Report
  
  // Phase 1: Audit State
  const [audit, setAudit] = useState({
        phone: '',
        monthlyKwh: 900,
    housePhase: 'Single',
    roofType: 'Pitched',
    futureEV: false,
    futurePool: false,
    futurePond: false
  });

        const [monthlyKwhInput, setMonthlyKwhInput] = useState('900');

  // Phase 2: Strategy State
    const [dayUsagePercent, setDayUsagePercent] = useState(60);
    const [panelWattage, setPanelWattage] = useState(615);
    const [panelCount, setPanelCount] = useState(12);
    const [panelCountInput, setPanelCountInput] = useState('12');
    const [hasBattery, setHasBattery] = useState(false);
    const [batteryUnits, setBatteryUnits] = useState(1);

  // Phase 3: Simulation State
  const [simProgress, setSimProgress] = useState(0);
  const [simStats, setSimStats] = useState({
    tankLevel: 0,
    gridExport: 0,
    gridImport: 0,
    solarGenerated: 0,
    houseConsumed: 0
  });

    // Phase 4: Report State
    const [finalReport, setFinalReport] = useState(null);

  // --- Derived Calculations ---
    const adjustedMonthlyKwh = useMemo(() => {
        let multiplier = 1;
        if (audit.futureEV) multiplier += 0.3;
        if (audit.futurePool) multiplier += 0.2;
        if (audit.futurePond) multiplier += 0.15;
        return Math.round(audit.monthlyKwh * multiplier);
    }, [audit.futureEV, audit.futurePool, audit.futurePond, audit.monthlyKwh]);

    const currentKwhUsage = useMemo(() => adjustedMonthlyKwh, [adjustedMonthlyKwh]);
  
  const recommendedSystemSize = useMemo(() => {
    // Target to offset 90% of usage (sweet spot)
    const dailyKwh = currentKwhUsage / 30;
    return Math.min(15, Math.max(3, Math.ceil((dailyKwh * 0.9) / SOLAR_YIELD_PER_KW)));
  }, [currentKwhUsage]);

    const selectedSystemSize = (panelWattage * panelCount) / 1000;
    const effectiveSystemSize = panelCount > 0 ? selectedSystemSize : recommendedSystemSize;

    const batteryCapacity = batteryUnits * BATTERY_UNIT_KWH;

    const phoneDigits = audit.phone.replace(/\D+/g, '');
    const isPhoneValid = /^\d{9,12}$/.test(phoneDigits);

  // --- Handlers ---

    const computeFormula = () => {
        const A = currentKwhUsage;
        const B = (dayUsagePercent / 100) * A;
        const C = A - B;

        const B1 = B / 30;
        const C1 = C / 30;

        const D = panelCount;
        const E = panelWattage / 1000;
        const F = SOLAR_YIELD_PER_KW;
        const G = D * E * F;

        const H = hasBattery ? batteryUnits : 0;
        const I = BATTERY_UNIT_KWH;
        const J = H * I;
        const K = TNB_RATE_PER_KWH;

        let dailyTnbKwh = 0;
        let dailyExportKwh = 0;
        let dailyStoredKwh = 0;

        if (B1 > G) {
            dailyTnbKwh = (B1 - G) + C1;
        } else {
            const excess = G - B1;
            if (H === 0) {
                dailyExportKwh = excess;
                const credit = excess * K * EXPORT_RATE_FACTOR;
                const cost = Math.max(0, (C1 * K) - credit);
                dailyTnbKwh = cost / K;
            } else {
                dailyStoredKwh = Math.min(excess, J);
                const remainingExcess = Math.max(0, excess - J);
                if (remainingExcess > 0) {
                    dailyExportKwh = remainingExcess;
                }
                const cost = Math.max(0, (Math.max(0, C1 - dailyStoredKwh) * K) - (dailyExportKwh * K * BATTERY_EXPORT_FACTOR));
                dailyTnbKwh = cost / K;
            }
        }

        const dailyTnbCost = dailyTnbKwh * K;
        const monthlyTnbCost = dailyTnbCost * 30;

        return {
            A,
            B,
            C,
            B1,
            C1,
            D,
            E,
            F,
            G,
            H,
            I,
            J,
            K,
            dailyTnbKwh,
            dailyTnbCost,
            dailyExportKwh,
            dailyStoredKwh,
            monthlyTnbCost
        };
    };

    const runSimulation = () => {
    setStep(4);
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
    const animationSpeed = 70; // ms per tick

    const interval = setInterval(() => {
      day += 0.5; // Half day increments for faster anim
      const progress = (day / totalDays) * 100;
      setSimProgress(progress);

            const formula = computeFormula();
            const dailySolar = formula.G;
            const dailyConsumption = formula.A / 30;
            const imported = formula.dailyTnbKwh;
            const exported = formula.dailyExportKwh;

      // Accumulate
      currentStats.solarGenerated += dailySolar / 2; // /2 because we run 2 ticks per day in loop
            currentStats.houseConsumed += dailyConsumption / 2;
      currentStats.gridExport += exported / 2;
      currentStats.gridImport += imported / 2;
            currentStats.tankLevel = hasBattery && batteryCapacity > 0
                ? (formula.dailyStoredKwh / batteryCapacity) * 100
                : 0;
      
      setSimStats({...currentStats});

                if (day >= totalDays) {
        clearInterval(interval);
        calculateFinalReport(currentStats);
                setTimeout(() => setStep(5), 1000);
      }
    }, animationSpeed);
  };

    const calculateFinalReport = (stats) => {
        const formula = computeFormula();
        const oldBill = formula.A * formula.K;
        const newBill = formula.monthlyTnbCost;

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

  const renderTestimonials = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-5 sm:p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-center mb-4">
                    <img
                        src="https://homifytech.com.my/wp-content/uploads/2025/04/homi-%E6%A9%AB-1536x369.png"
                        alt="HomifyTech"
                        className="h-8 sm:h-9 md:h-10 w-auto"
                    />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 text-center">
                    Real Client Results
                </h2>
                <p className="text-sm text-slate-500 text-center mt-2">
                    Two recent semi-D projects with verified savings.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-5">
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                        <img
                            src="/house1.jpeg"
                            alt="Puchong Semi-D"
                            className="w-full h-44 sm:h-52 object-cover"
                        />
                        <div className="p-4 sm:p-5 space-y-1 text-sm text-slate-600">
                            <div className="text-base font-bold text-slate-800">Puchong Semi-D</div>
                            <div>Total Electricity Usage: 1230kW</div>
                            <div>Solar Panel: 18 pieces</div>
                            <div>Battery: None</div>
                            <div>Total Saving: 78% (RM481 per month)</div>
                            <div>Total Savings 30 years: RM173,150</div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                        <img
                            src="/house2.jpeg"
                            alt="Rawang Semi-D"
                            className="w-full h-44 sm:h-52 object-cover"
                        />
                        <div className="p-4 sm:p-5 space-y-1 text-sm text-slate-600">
                            <div className="text-base font-bold text-slate-800">Rawang Semi-D</div>
                            <div>Total Electricity Usage: 1500kW</div>
                            <div>Solar Panel: 22 pieces</div>
                            <div>Battery: 2 Batteries</div>
                            <div>Total Saving: 84% (RM633 per month)</div>
                            <div>Total Savings 30 years: RM227,880</div>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={() => setStep(1)}
                className="w-full py-3.5 sm:py-4 rounded-2xl text-base sm:text-lg font-bold flex items-center justify-center transition-all shadow-lg shadow-slate-200 bg-[#145A0D] text-white hover:bg-[#0F450A]"
            >
                Continue <ArrowRight className="ml-2 w-5 h-5" />
            </button>
        </div>
  );

  const renderWelcome = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-5 sm:p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-center mb-4">
                    <img
                        src="https://homifytech.com.my/wp-content/uploads/2025/04/homi-%E6%A9%AB-1536x369.png"
                        alt="HomifyTech"
                        className="h-8 sm:h-9 md:h-10 w-auto"
                    />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 text-center">
                    Welcome to the Solar Planner
                </h2>
                <p className="text-sm text-slate-500 text-center mt-2">
                    Start with your contact number and we will tailor the estimate for you.
                </p>

                <div className="mt-6">
                    <label className="block text-sm font-semibold text-slate-600 mb-2">Phone Number</label>
                    <div className="flex items-center w-full rounded-2xl border px-4 py-3 bg-white transition-all">
                        <span className="text-sm font-semibold text-slate-500 pr-3 border-r border-slate-200">+60</span>
                        <input
                            type="tel"
                            inputMode="numeric"
                            placeholder="12 345 6789"
                            value={audit.phone}
                            onChange={(e) => setAudit({...audit, phone: e.target.value})}
                            className="w-full pl-3 text-base font-medium outline-none"
                        />
                    </div>
                    <div className="text-xs text-slate-500 mt-2">Digits only. Spaces allowed.</div>
                </div>
            </div>

            <button 
                onClick={() => setStep(2)}
                disabled={!isPhoneValid}
                className={`w-full py-3.5 sm:py-4 rounded-2xl text-base sm:text-lg font-bold flex items-center justify-center transition-all shadow-lg shadow-slate-200 ${isPhoneValid ? 'bg-[#145A0D] text-white hover:bg-[#0F450A]' : 'bg-[#145A0D]/15 text-[#145A0D]/50 cursor-not-allowed'}`}
            >
                Continue <ArrowRight className="ml-2 w-5 h-5" />
            </button>
        </div>
  );

  const renderAudit = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-4 sm:p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-[#145A0D]"/> Phase 1: The Audit
        </h2>
        
        {/* Monthly Usage */}
        <div className="mb-8">
            <label className="block text-sm font-semibold text-slate-600 mb-2">Monthly Usage (kW)</label>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min="200"
                    max="3000"
                    step="50"
                    value={monthlyKwhInput}
                    onChange={(e) => {
                        const rawValue = e.target.value;
                        setMonthlyKwhInput(rawValue);
                        if (rawValue !== '') {
                            const parsedValue = Number(rawValue);
                            if (!Number.isNaN(parsedValue)) {
                                setAudit({...audit, monthlyKwh: parsedValue});
                            }
                        }
                    }}
                    onBlur={() => {
                        const parsedValue = Number(monthlyKwhInput);
                        const normalizedValue = Number.isNaN(parsedValue)
                            ? audit.monthlyKwh
                            : Math.min(3000, Math.max(200, parsedValue));
                        setAudit({...audit, monthlyKwh: normalizedValue});
                        setMonthlyKwhInput(String(normalizedValue));
                    }}
                    className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
                />
                <span className="text-sm font-semibold text-slate-500">kW</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
                Future plans can increase this estimate to {adjustedMonthlyKwh} kW.
            </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
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
                {(audit.futureEV || audit.futurePool || audit.futurePond) && (
                    <div className="text-xs text-slate-500">
                        Estimated monthly usage increases to {adjustedMonthlyKwh} kW.
                    </div>
                )}
            </div>
        </div>
      </div>
      
                        <button 
                            onClick={() => setStep(3)}
                            className="w-full py-3.5 sm:py-4 rounded-2xl text-base sm:text-lg font-bold flex items-center justify-center transition-all shadow-lg shadow-[0_10px_20px_rgba(20,90,13,0.2)] bg-[#145A0D] text-white hover:bg-[#0F450A]"
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
                <LayoutDashboard className="w-5 h-5 mr-2 text-[#145A0D]"/> Phase 2: Usage Strategy
            </h2>
            <div className="text-[11px] sm:text-xs font-medium px-3 py-1 bg-slate-100 rounded-full text-slate-500">
                System: {effectiveSystemSize.toFixed(1)} kWp
            </div>
        </div>

        {/* Usage Split + Hardware */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-3">1. Day vs Night Usage Split</h3>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-bold text-slate-500 uppercase">Usage Allocation</div>
                            <div className="text-xs font-semibold text-slate-700">
                                {dayUsagePercent}% Day / {100 - dayUsagePercent}% Night
                            </div>
                        </div>
                        <input
                            type="range" min="10" max="90" step="5"
                            value={dayUsagePercent}
                            onChange={(e) => setDayUsagePercent(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#145A0D]"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                            <span className="flex items-center gap-1"><Sun className="w-3 h-3" /> Day</span>
                            <span className="flex items-center gap-1"><Moon className="w-3 h-3" /> Night</span>
                        </div>
                        <div className="mt-3 text-[11px] text-slate-500">
                            Night usage uses TNB unless a battery is installed.
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-3">2. Panel Selection</h3>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="text-xs font-bold text-slate-500 uppercase">Panel Type</div>
                        <div className="grid grid-cols-2 gap-2">
                            {[615, 700].map(watt => (
                                <button
                                    key={watt}
                                    onClick={() => setPanelWattage(watt)}
                                    className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${panelWattage === watt ? 'bg-white border-[#145A0D] text-slate-800 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-white'}`}
                                >
                                    {watt}W
                                </button>
                            ))}
                        </div>

                        <div className="pt-2">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-bold text-slate-500 uppercase">Panel Quantity</div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="6"
                                        max="40"
                                        step="1"
                                        value={panelCountInput}
                                        onChange={(e) => {
                                            const rawValue = e.target.value;
                                            setPanelCountInput(rawValue);
                                            if (rawValue !== '') {
                                                const parsedValue = Number(rawValue);
                                                if (!Number.isNaN(parsedValue)) {
                                                    setPanelCount(parsedValue);
                                                }
                                            }
                                        }}
                                        onBlur={() => {
                                            const parsedValue = Number(panelCountInput);
                                            const normalizedValue = Number.isNaN(parsedValue)
                                                ? panelCount
                                                : Math.min(40, Math.max(6, parsedValue));
                                            setPanelCount(normalizedValue);
                                            setPanelCountInput(String(normalizedValue));
                                        }}
                                        className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                                    />
                                    <span className="text-xs font-semibold text-slate-500">pcs</span>
                                </div>
                            </div>
                        </div>

                        <div className="text-xs text-slate-600">
                            Total system size: <span className="font-semibold">{effectiveSystemSize.toFixed(1)} kWp</span>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-3">3. Battery Storage</h3>
                    <div className={`rounded-xl border-2 transition-all p-1 ${hasBattery ? 'border-green-500 bg-green-50' : 'border-slate-200'}`}>
                        <button
                            onClick={() => setHasBattery(!hasBattery)}
                            className={`w-full py-3 px-3 rounded-lg flex items-center justify-between transition-all ${hasBattery ? 'bg-white shadow-sm text-green-800' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <Battery className={hasBattery ? "fill-green-600" : ""} />
                                <div className="text-left">
                                    <div className="font-bold text-sm">Add Battery Storage</div>
                                    <div className="text-[10px] opacity-70">Powers night usage first</div>
                                </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${hasBattery ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}>
                                {hasBattery && <CheckCircle2 className="w-4 h-4 text-white" />}
                            </div>
                        </button>
                        
                        {/* Battery Sizing Slider */}
                        {hasBattery && (
                            <div className="px-3 pb-3 pt-2 animate-in slide-in-from-top-2 fade-in">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs font-bold text-green-700">Capacity: {batteryCapacity} kWh</span>
                                </div>
                                <input 
                                    type="range" min="1" max="6" step="1"
                                    value={batteryUnits}
                                    onChange={(e) => setBatteryUnits(Number(e.target.value))}
                                    className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                                />
                                <div className="flex justify-between text-[9px] text-green-600/60 mt-1 font-medium px-1">
                                    <span>1 Unit (10kWh)</span>
                                    <span>6 Units (60kWh)</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        <button 
            onClick={runSimulation}
            className="w-full py-3.5 sm:py-4 bg-[#145A0D] text-white rounded-2xl text-base sm:text-lg font-bold hover:bg-[#0F450A] flex items-center justify-center transition-all shadow-lg shadow-[0_10px_20px_rgba(20,90,13,0.2)] mt-6"
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
                 <div className="bg-[#E9F5E7] p-4 rounded-xl border border-[#D7EED4] flex items-center justify-between">
                     <div className="flex items-center gap-3">
                         <div className="p-2 bg-[#D7EED4] rounded-lg text-[#145A0D]">
                             <Sun className="w-5 h-5" />
                         </div>
                         <div>
                             <div className="text-xs font-bold text-[#145A0D] uppercase">Generated</div>
                             <div className="text-sm text-[#145A0D]/70">Potential Energy</div>
                         </div>
                     </div>
                     <div className="text-xl font-bold text-[#145A0D] tabular-nums">
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

        const savingsPercent = finalReport.oldBill > 0
            ? Math.max(0, Math.round((finalReport.monthlySavings / finalReport.oldBill) * 100))
            : 0;

        const savingsAmount = Math.max(0, Math.round(finalReport.monthlySavings));
        const formula = computeFormula();

    const isTrapDetected = finalReport.lossAmount > 50;

    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700 pb-10">
        
        {/* Section 1: Selected Configuration */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-xl border border-slate-200">
             <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
                    <PiggyBank className="w-5 h-5 mr-2 text-[#145A0D]"/> Your Configuration
                </h2>
                <div className="bg-[#145A0D]/10 text-[#145A0D] px-3 py-1 rounded-lg text-xs font-bold border border-[#145A0D]/20">
                    Solar Applied
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Monthly Usage</div>
                    <div className="text-lg font-bold text-slate-800">{audit.monthlyKwh} kW</div>
                    {adjustedMonthlyKwh !== audit.monthlyKwh && (
                        <div className="text-xs text-slate-500">Adjusted: {adjustedMonthlyKwh} kW</div>
                    )}
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">System Size</div>
                    <div className="text-lg font-bold text-slate-800">{effectiveSystemSize.toFixed(1)} kWp</div>
                    <div className="text-xs text-slate-500">{panelWattage}W x {panelCount} pcs</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Day vs Night</div>
                    <div className="text-lg font-bold text-slate-800">{dayUsagePercent}% / {100 - dayUsagePercent}%</div>
                    <div className="text-xs text-slate-500">Day / Night split</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Battery</div>
                    <div className="text-lg font-bold text-slate-800">{hasBattery ? `${batteryUnits} unit${batteryUnits > 1 ? 's' : ''}` : 'None'}</div>
                    <div className="text-xs text-slate-500">{hasBattery ? `${batteryCapacity} kWh total` : 'No storage selected'}</div>
                </div>
             </div>
        </div>

        {/* Section 2: Before vs After */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">Before vs After</h3>
                <div className="text-xs font-bold uppercase text-slate-500">Monthly</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-stretch">
                <div className="md:col-span-2 rounded-2xl p-4 border border-slate-200 bg-white/70">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Before (TNB)</div>
                    <div className="mt-2 text-2xl font-bold text-slate-800">RM {Math.round(finalReport.oldBill)}</div>
                    <div className="text-xs text-slate-500">{audit.monthlyKwh} kW usage</div>
                </div>

                <div className="hidden md:flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-[#145A0D]/10 text-[#145A0D] flex items-center justify-center">
                        <ArrowRight className="w-5 h-5" />
                    </div>
                </div>

                <div className="md:col-span-2 rounded-2xl p-4 border border-[#145A0D]/20 bg-gradient-to-br from-[#145A0D] via-[#145A0D] to-[#0F450A] text-white shadow-[0_12px_24px_rgba(20,90,13,0.2)]">
                    <div className="text-[10px] font-bold uppercase text-emerald-100">After (TNB)</div>
                    <div className="mt-2 text-2xl font-bold">RM {Math.round(finalReport.newBill)}</div>
                    <div className="text-xs text-emerald-100">Estimated after solar</div>
                    <div className="mt-4 border border-white/20 rounded-xl p-3 bg-white/5">
                        <div className="text-[11px] uppercase tracking-wide text-emerald-100">Monthly Savings</div>
                        <div className="mt-1 text-lg font-bold">RM {savingsAmount}</div>
                        <div className="text-xs text-emerald-100">{savingsPercent}% reduction</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Section 3: How This Estimate Works */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">How This Estimate Works</h3>
                <div className="text-xs font-bold uppercase text-slate-500">Simple View</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold text-slate-500 uppercase">Your Monthly Use</div>
                    <div className="mt-1 text-lg font-bold text-slate-800">{formula.A.toFixed(0)} kWh</div>
                    <div className="text-xs text-slate-500">Day {dayUsagePercent}% / Night {100 - dayUsagePercent}%</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold text-slate-500 uppercase">Solar Output (Daily)</div>
                    <div className="mt-1 text-lg font-bold text-slate-800">{formula.G.toFixed(1)} kWh</div>
                    <div className="text-xs text-slate-500">{panelCount} panels @ {panelWattage}W</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold text-slate-500 uppercase">Battery Capacity</div>
                    <div className="mt-1 text-lg font-bold text-slate-800">{hasBattery ? `${formula.J.toFixed(0)} kWh` : 'None'}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold text-slate-500 uppercase">Grid Purchase</div>
                    <div className="mt-1 text-lg font-bold text-slate-800">{formula.monthlyTnbCost.toFixed(0)} RM / month</div>
                    <div className="text-xs text-slate-500">RM {formula.K.toFixed(2)} / kWh</div>
                </div>
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
                    <button onClick={() => {setStep(3); setHasBattery(true);}} className="underline ml-1 font-bold">Add Battery to fix.</button>
                </p>
            </div>
        )}

        <button 
            onClick={() => { setStep(2); setSimStats({}); setFinalReport(null); }}
            className="w-full py-3.5 sm:py-4 bg-[#145A0D] text-white rounded-2xl font-bold hover:bg-[#0F450A] transition-all flex items-center justify-center shadow-xl"
        >
            <RefreshCcw className="w-4 h-4 mr-2" /> Start New Client Audit
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-[#145A0D]/20">
      {/* App Header */}
      <div className="bg-white border-b border-[#145A0D]/15 sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <img
                      src="https://homifytech.com.my/wp-content/uploads/2025/04/homi-%E6%A9%AB-1536x369.png"
                      alt="HomifyTech"
                      className="h-6 sm:h-7 md:h-8 w-auto"
                  />
              </div>
              <div className="flex items-center gap-2">
                  {step > 0 && (
                      <button
                          type="button"
                          onClick={() => setStep(prev => Math.max(0, prev - 1))}
                          className="px-2.5 py-1 text-xs sm:text-sm font-semibold text-[#145A0D] bg-[#145A0D]/10 rounded-lg hover:bg-[#145A0D]/15 transition-all"
                      >
                          Back
                      </button>
                  )}
                  <div className="flex gap-1">
                      {[0,1,2,3,4,5].map(s => (
                          <div key={s} className={`h-1.5 w-5 sm:w-6 rounded-full transition-all ${step >= s ? 'bg-[#145A0D]' : 'bg-[#145A0D]/20'}`} />
                      ))}
                  </div>
              </div>
          </div>
      </div>

      <main className="max-w-3xl mx-auto px-3 py-4 sm:p-4 md:p-6 pb-16 sm:pb-24">
                                {step === 0 && renderTestimonials()}
                                {step === 1 && renderWelcome()}
                                {step === 2 && renderAudit()}
                                {step === 3 && renderStrategy()}
                                {step === 4 && renderSimulation()}
                                {step === 5 && renderReport()}
      </main>
    </div>
  );
}