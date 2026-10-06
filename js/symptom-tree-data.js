// Symptom decision tree. Terminal nodes either jump into the fault-code
// lookup (filtered/keyword-searched against the real manual data) or show a
// short generic checklist of general good-practice checks (not sourced from
// any specific manufacturer manual — labelled as such in the UI).
const SYMPTOM_TREE = {
  start: "root",
  nodes: {
    root: {
      question: "What's the main symptom?",
      options: [
        { label: "Fault code is showing", next: "has_code" },
        { label: "No power / completely dead", next: "no_power" },
        { label: "No heating, hot water OK", next: "ch_only" },
        { label: "No hot water, heating OK", next: "hw_only" },
        { label: "No heating and no hot water", next: "both_out" },
        { label: "Keeps locking out / cycling", next: "cycling" },
        { label: "Noisy (banging, gurgling, whistling)", next: "noise" },
        { label: "Losing pressure / leaking", next: "pressure_leak" },
        { label: "Radiators not heating evenly", next: "rads_uneven" },
      ],
    },

    has_code: {
      question: "Do you know the code?",
      options: [
        { label: "Yes — take me to lookup", result: { type: "gotoLookup" } },
        { label: "Showing a lockout symbol but no clear code", next: "no_power" },
      ],
    },

    no_power: {
      question: "Completely dead — check in this order",
      options: [
        { label: "Mains/fused spur/isolator off or tripped", result: generic("No power — mains side", [
          "Check fused spur / isolator switch is on",
          "Check fuse rating and condition in the spur/plug",
          "Check upstream MCB/RCBO at the consumer unit hasn't tripped",
          "Check for a blown internal boiler fuse (with power isolated)",
        ])},
        { label: "Mains present, display still dead — PCB/transformer", result: { type: "search", keyword: "pcb" } },
        { label: "Boiler on a timer/programmer that's off", result: generic("Programmer/timer", [
          "Check programmer is set to 'on' for the current time/day",
          "Check programmer battery if it has a blank/reset display",
          "Check room thermostat is calling (set point above room temp)",
        ])},
      ],
    },

    ch_only: {
      question: "Heating not working, hot water fine — likely cause area",
      options: [
        { label: "Room thermostat / programmer not calling", result: generic("CH controls", [
          "Check room thermostat set point is above current room temperature",
          "Check programmer CH is scheduled on",
          "Check thermostat batteries / wireless link to receiver",
          "Check boiler is actually receiving the CH demand signal (bridge/link wires if stat removed)",
        ])},
        { label: "Diverter valve stuck to hot water", result: { type: "search", keyword: "diverter" } },
        { label: "Zone valve(s) not opening", result: generic("Zone valves", [
          "Check zone valve motor runs and opens fully",
          "Check zone valve end switch makes contact with the boiler/programmer",
          "Check valve isn't mechanically jammed (manual lever if fitted)",
        ])},
        { label: "Boiler attempts to fire but faults", result: { type: "gotoLookup" } },
      ],
    },

    hw_only: {
      question: "Hot water not working, heating fine — likely cause area",
      options: [
        { label: "Diverter valve stuck to CH side", result: { type: "search", keyword: "diverter" } },
        { label: "DHW flow switch / flow sensor not detecting tap on", result: { type: "search", keyword: "flow" } },
        { label: "Cylinder thermostat satisfied / stuck (system boiler + cylinder)", result: generic("Stored hot water (cylinder)", [
          "Check cylinder thermostat setting and wiring",
          "Check cylinder thermostat is making contact (not stuck open)",
          "Check 2-port/3-port valve for the cylinder circuit operates",
        ])},
        { label: "Boiler attempts to fire but faults", result: { type: "gotoLookup" } },
      ],
    },

    both_out: {
      question: "No heating or hot water — start here",
      options: [
        { label: "No power at all", next: "no_power" },
        { label: "Low system pressure warning shown", next: "pressure_leak" },
        { label: "Boiler tries to fire then faults", result: { type: "gotoLookup" } },
        { label: "Nothing happens when there's a demand", result: { type: "search", keyword: "ignition" } },
      ],
    },

    cycling: {
      question: "Locks out repeatedly or short-cycles — most likely area",
      options: [
        { label: "Locks out with the same code each time", result: { type: "gotoLookup" } },
        { label: "Short-cycles on CH (on/off rapidly, no fault code)", result: generic("Short cycling (no fault code)", [
          "Check system bypass is fitted and set correctly (TRVs on all radiators with no bypass is a common cause)",
          "Check boiler is not oversized for the system/zone",
          "Check flow/return NTC sensors read sensibly and match each other",
          "Check for a sticking diverter valve causing cross-flow",
        ])},
        { label: "Locks out intermittently with flame loss", result: { type: "search", keyword: "flame" } },
      ],
    },

    noise: {
      question: "What does it sound like?",
      options: [
        { label: "Banging/kettling from the heat exchanger", result: generic("Kettling", [
          "Check for limescale/sludge restricting flow through the heat exchanger",
          "Check central heating flow rate and pump speed setting",
          "Check magnetic filter and strainers for debris",
          "Consider a power flush if scale/sludge is confirmed",
        ])},
        { label: "Gurgling / air noise", result: generic("Air in system", [
          "Bleed radiators and check auto air vents on the boiler",
          "Check for a slow leak introducing air (falling pressure)",
          "Check pump is not drawing air (loose connection, low pressure)",
        ])},
        { label: "Whistling / humming from the fan or gas valve", result: { type: "search", keyword: "fan" } },
      ],
    },

    pressure_leak: {
      question: "Pressure / leak — where's the water going?",
      options: [
        { label: "Visible leak at boiler or pipework", result: generic("Leak — boiler/pipework", [
          "Isolate electrics before inspecting a leaking boiler",
          "Check plate heat exchanger, pump seal, and auto air vent for weeping",
          "Check pressure relief valve discharge pipe for continuous dripping (PRV seat issue or overpressure)",
          "Check all pipe joints and radiator valves for the actual source before assuming the boiler",
        ])},
        { label: "No visible leak, pressure still drops", result: generic("No visible leak", [
          "Check for a hidden leak under floors or in unseen pipe runs",
          "Check expansion vessel charge pressure and condition (may be passing water internally)",
          "Check filling loop isn't passing/weeping",
          "Pressure test the system if no leak is found and loss continues",
        ])},
        { label: "Pressure fine but boiler shows a pressure fault code", result: { type: "gotoLookup" } },
      ],
    },

    rads_uneven: {
      question: "Radiators not heating evenly",
      options: [
        { label: "Cold at the top", result: generic("Cold at top of radiator", [
          "Bleed the radiator to remove trapped air",
        ])},
        { label: "Cold at the bottom", result: generic("Cold at bottom of radiator", [
          "Likely sludge/debris build-up — check magnetic filter condition",
          "Consider a power flush or chemical clean if widespread",
        ])},
        { label: "One zone/circuit cold, others fine", result: generic("One zone cold", [
          "Check that zone's valve/actuator operates and opens",
          "Check lockshield/balancing valves for that circuit",
          "Check for a closed isolation valve on that circuit",
        ])},
      ],
    },
  },
};

function generic(title, steps) {
  return { type: "generic", title, steps };
}
