// Generic fan-assisted combi/system boiler firing sequence.
// This is standard industry sequence knowledge (consistent across modern
// Worcester Bosch / Vaillant / Baxi / Ideal fan-assisted appliances), not
// taken from any single manufacturer's manual. Exact timings, sensor names
// and interlock order vary by model — always check the specific manual.
const FIRING_SEQUENCE = [
  {
    title: "Call for heat",
    body: "A demand is received from the room thermostat, programmer, DHW flow switch or system controller. The PCB checks safety interlocks (overheat stat, pressure switch/APS, low water pressure switch) before starting the pump.",
    checks: [
      "Confirm a genuine demand is present (room stat calling, or tap open for DHW)",
      "Check system/boiler water pressure is within range (typically 1-2 bar cold)",
      "Check no external interlocks (frost stat, timer, zone valve end switches) are blocking the call",
    ],
    faultKeywords: ["low water pressure", "interlock", "no demand"],
  },
  {
    title: "Pump proving",
    body: "The pump runs and the PCB looks for proof of flow — via a flow switch, differential pressure switch, or (on modern boilers) by monitoring flow/return NTC sensor behaviour. No proven flow within the allowed time causes a lockout.",
    checks: [
      "Listen/feel for pump running, check it is not air-locked",
      "Check pump speed setting matches installation requirements",
      "Check flow switch or differential pressure switch operation if fitted",
      "Bleed air from pump and system if flow is not proven",
    ],
    faultKeywords: ["pump", "flow", "circulation"],
  },
  {
    title: "Fan / pre-purge",
    body: "The fan starts and is proven (by air pressure switch, Hall-effect speed sensor, or fan-speed feedback to the PCB). The fan runs for a pre-purge period to clear the combustion chamber and flue of any residual gas before ignition is attempted.",
    checks: [
      "Check fan runs freely and reaches expected speed/pressure signal",
      "Check air pressure switch (APS) operates and resets correctly",
      "Inspect flue and terminal for blockage, damage or incorrect termination",
      "Check condensate trap/pipe is not blocked (can affect pressure-switch readings on condensing boilers)",
    ],
    faultKeywords: ["fan", "flue", "air pressure", "blocked"],
  },
  {
    title: "Ignition",
    body: "The gas valve opens and the spark/ignition electrode fires (direct spark ignition on most modern boilers). The PCB expects flame detection within a set number of ignition attempts/sparks.",
    checks: [
      "Gas-side: check inlet (supply) gas pressure at the test point under load",
      "Gas-side: check burner pressure or gas valve modulation against the data badge/manual",
      "Check ignition electrode condition, gap and position",
      "Check spark generator/ignition lead and earthing",
      "Check gas valve opens (listen/feel, or check coil resistance) and is not seized",
    ],
    faultKeywords: ["ignition", "no ignition", "spark", "gas valve"],
  },
  {
    title: "Flame proving / detection",
    body: "Flame is confirmed via flame rectification (same electrode) or a separate flame sensor. Loss of a proven flame signal, or failure to detect flame after ignition, results in a fault — often with limited retries before lockout.",
    checks: [
      "Check flame sense electrode is clean and correctly positioned (not just the spark electrode)",
      "Check flame picture — correct colour, even across burner, no lifting/floating",
      "Check earth continuity/bonding — poor earth badly affects flame rectification",
      "Check condensate/water ingress is not affecting the electrode or wiring",
    ],
    faultKeywords: ["flame", "flame loss", "rectification", "flame fail"],
  },
  {
    title: "Running / modulation",
    body: "Once flame is proven, the boiler modulates gas/fan speed to match heat demand, using flow/return (and sometimes flue) temperature sensors. The PCB continuously monitors for overheat, loss of flow, or flame signal degradation.",
    checks: [
      "Gas-side: check CO/CO2 ratio and flue gas readings with an analyser against the manual's commissioning data",
      "Check flow and return NTC sensor readings are sensible and match each other's resistance/temperature curve",
      "Check central heating flow rate and delta T (aim ~20°C flow-return on most UK systems unless manual states otherwise)",
      "Check for kettling, restricted flow, or sludge/debris (magnetic filter condition)",
    ],
    faultKeywords: ["overheat", "sensor", "ntc", "modulation", "thermistor"],
  },
  {
    title: "Shutdown",
    body: "When demand is satisfied, the gas valve closes and flame extinguishes. Many boilers run a post-purge on the fan, and a pump overrun (CH and/or anti-cycle on DHW) to dissipate residual heat before the next cycle.",
    checks: [
      "Check gas valve closes fully (no residual flame/smell)",
      "Check pump overrun completes and pump stops correctly after",
      "Check boiler does not short-cycle (on/off repeatedly) — may indicate oversized boiler, poor bypass, or sensor fault",
    ],
    faultKeywords: ["overrun", "short cycle", "cycling"],
  },
];
