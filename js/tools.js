// Standard industry/physics calculations — not manufacturer-specific data.
const Tools = {
  // Simplified B-parameter NTC equation. Default R0/T0/Beta are the commonly
  // cited generic values for HVAC NTC sensors — ALWAYS prefer the exact
  // table/constants in the specific boiler's manual if given; this is a
  // generic estimator for when you just need a sanity-check reading.
  ntcResistanceToTemp(resistanceOhm, r0 = 10000, t0C = 25, beta = 3977) {
    const T0 = t0C + 273.15;
    const r = Number(resistanceOhm);
    if (!(r > 0)) return null;
    const invT = 1 / T0 + (1 / beta) * Math.log(r / r0);
    const Tk = 1 / invT;
    return Tk - 273.15;
  },
  ntcTempToResistance(tempC, r0 = 10000, t0C = 25, beta = 3977) {
    const T0 = t0C + 273.15;
    const Tk = Number(tempC) + 273.15;
    if (!(Tk > 0)) return null;
    return r0 * Math.exp(beta * (1 / Tk - 1 / T0));
  },

  // Gas rate from a timed meter test. Standard Gas Safe / ACS method:
  //  volumeRate (m3/h) = 3600 / seconds_per_rev * volumePerRev(m3)
  //  grossKW = volumeRate(m3/h) * CV(MJ/m3) / 3.6
  //  netKW = grossKW * netGrossRatio (0.901 typical for natural gas)
  gasRate({ seconds, volumePerRev, volumeUnit, cvMJm3 = 38.76, netGrossRatio = 0.901 }) {
    const secs = Number(seconds);
    let volPerRev = Number(volumePerRev);
    if (!(secs > 0) || !(volPerRev > 0)) return null;
    if (volumeUnit === "ft3") volPerRev = volPerRev * 0.0283168; // -> m3
    const volumeRateM3h = (3600 / secs) * volPerRev;
    const grossKW = (volumeRateM3h * cvMJm3) / 3.6;
    const netKW = grossKW * netGrossRatio;
    return { volumeRateM3h, grossKW, netKW };
  },

  deltaT(flowC, returnC) {
    const f = Number(flowC), r = Number(returnC);
    if (Number.isNaN(f) || Number.isNaN(r)) return null;
    return f - r;
  },
};

const TYPICAL_VALUES = [
  { item: "Natural gas supply pressure at meter/ECV", value: "~20 mbar nominal (per BS 6891)", note: "Confirm against current working pressure under load — check manual for appliance-specific tolerance." },
  { item: "Typical CH system design delta T (flow−return)", value: "~20°C", note: "Common UK design convention, not a hard rule for every system." },
  { item: "Cold fill system pressure (sealed system)", value: "~1.0–1.5 bar", note: "Check the specific boiler's manual — varies by model/height of system." },
  { item: "Mains cold water pressure for combi flow rate", value: "Varies by property", note: "Low mains pressure/flow is a common cause of poor DHW performance — check manual's minimum requirement." },
  { item: "Natural gas CV used for rate calculations", value: "~38.76 MJ/m³ (typical, varies by supply)", note: "Use the actual local CV if known; this is only a typical default." },
  { item: "Net/Gross calorific value ratio (natural gas)", value: "~0.901", note: "Standard conversion factor used in gas rating calculations." },
];
