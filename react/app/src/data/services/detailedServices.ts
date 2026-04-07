/**
 * detailedServices.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Standardized pricing for RAHI platform — Chandigarh Tricity Market
 *
 * Prices are calibrated using:
 *   1. Urban Company benchmark rates for comparable Indian markets
 *   2. Chandigarh Administration Minimum Wage Notification (skilled @₹15,069/month)
 *   3. Hyper-local benchmarks: JustDial / Sector 22 / Mani Majra market rates
 *   4. Cost-Plus logic reverse-engineered from parts + labor rates
 *
 * Worker Payout Target: ~65-70% of ticket. Daily target: ₹1,000–₹1,200 (3–4 jobs).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ServiceItem {
  id: string;
  name: string;
  nameHi?: string;
  description?: string;
  durationMins?: number;  // estimated duration in minutes
  price: number;
  category: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// 🔧 PLUMBING
// Starts at ₹69 (aggressive entry to compete with ₹200+ local visit fees)
// Recovery on installations (₹349–₹499) — local contractors charge ₹500-700+
// ──────────────────────────────────────────────────────────────────────────────
export const PLUMBING_SERVICES: ServiceItem[] = [
  {
    id: 'tap-repair',
    name: 'Tap Repair',
    nameHi: 'नल की मरम्मत',
    description: 'Repair of a single leaking tap (washer change or spindle adjustment). Excludes spare parts.',
    durationMins: 20,
    price: 69,
    category: 'Tap & Mixer',
  },
  {
    id: 'mixer-tap-inst',
    name: 'Mixer Tap Installation',
    nameHi: 'मिक्सर नल लगाना',
    description: 'Installation of wall mixer units for hot/cold water. Includes eccentric union alignment.',
    durationMins: 45,
    price: 329,
    category: 'Tap & Mixer',
  },
  {
    id: 'shower-installation',
    name: 'Shower Installation',
    nameHi: 'शॉवर लगाना',
    description: 'Installation of overhead or telephonic shower units. Includes Teflon taping and alignment.',
    durationMins: 30,
    price: 149,
    category: 'Bath & Shower',
  },
  {
    id: 'pipe-leak-repair',
    name: 'Pipe Leak Repair',
    nameHi: 'पाइप लीकेज ठीक करना',
    description: 'Repair of visible leakage in PVC/CPVC pipes. Includes cutting and coupling. Parts extra.',
    durationMins: 45,
    price: 199,
    category: 'Pipes',
  },
  {
    id: 'blockage-removal',
    name: 'Blockage Removal (Sink / Bathroom)',
    nameHi: 'बंद नाली खोलना',
    description: 'Removal of blockage in floor traps, kitchen sinks, or washbasins using manual rodding.',
    durationMins: 45,
    price: 299,
    category: 'Blockage',
  },
  {
    id: 'flush-tank-repair',
    name: 'Flush Tank Repair',
    nameHi: 'फ्लश टैंक मरम्मत',
    description: 'Fixing internal siphon mechanism, ball cock, or float valve issues in ceramic or PVC tanks.',
    durationMins: 30,
    price: 169,
    category: 'Toilet',
  },
  {
    id: 'basin-installation',
    name: 'Basin Installation',
    nameHi: 'बेसिन लगाना',
    description: 'Installation of standard wall-hung washbasin. Includes waste coupling and bottle trap fixing.',
    durationMins: 60,
    price: 349,
    category: 'Basin & Sink',
  },
  {
    id: 'toilet-seat-inst',
    name: 'Toilet Seat Installation',
    nameHi: 'टॉयलेट सीट लगाना',
    description: 'Replacement/installation of western commode seat cover (hydraulic or standard). Labor only.',
    durationMins: 30,
    price: 199,
    category: 'Toilet',
  },
  {
    id: 'bathroom-fittings',
    name: 'Bathroom Fittings Installation',
    nameHi: 'बाथरूम फिटिंग्स',
    description: 'Installation of towel rods, soap dishes, or shelves (per item). Includes drilling.',
    durationMins: 15,
    price: 89,
    category: 'Bath & Shower',
  },
  {
    id: 'kitchen-sink-inst',
    name: 'Kitchen Sink Installation',
    nameHi: 'किचन सिंक लगाना',
    description: 'Fitting of steel/granite sink, including waste pipe connection and silicone sealing.',
    durationMins: 90,
    price: 499,
    category: 'Basin & Sink',
  },
  {
    id: 'water-motor-conn',
    name: 'Water Motor Connection',
    nameHi: 'मोटर कनेक्शन',
    description: 'Installation or replacement of a monoblock water pump. Includes electrical + plumbing connection.',
    durationMins: 60,
    price: 349,
    category: 'Water Tank & Motor',
  },
  {
    id: 'tank-inlet-outlet',
    name: 'Water Tank Inlet/Outlet Repair',
    nameHi: 'टंकी की मरम्मत',
    description: 'Repairing ball valves or overflow pipes in overhead tanks. Includes roof access.',
    durationMins: 45,
    price: 199,
    category: 'Water Tank & Motor',
  },
  {
    id: 'plumbing-cons',
    name: 'Plumber Consultation',
    nameHi: 'प्लम्बर सलाह',
    description: 'Inspection visit and quote for plumbing work. Free if you book the service.',
    durationMins: 30,
    price: 49,
    category: 'Consultation',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// ⚡ ELECTRICAL
// Starts at ₹69 (undercuts local ₹200-500 visit fees significantly)
// Emergency electricians in Chandigarh charge ₹500–₹2,500 for night visits
// ──────────────────────────────────────────────────────────────────────────────
export const ELECTRICAL_SERVICES: ServiceItem[] = [
  {
    id: 'switchboard-repair',
    name: 'Switch Board Repair',
    nameHi: 'स्विच बोर्ड मरम्मत',
    description: 'Diagnosing/fixing loose connections or sparking in existing board.',
    durationMins: 20,
    price: 79,
    category: 'Switch & Socket',
  },
  {
    id: 'switch-install',
    name: 'New Switch Installation',
    nameHi: 'नया स्विच लगाना',
    description: 'Replacement of a faulty switch/socket (per switch). Board typically needs 2-3 switches.',
    durationMins: 10,
    price: 69,
    category: 'Switch & Socket',
  },
  {
    id: 'fan-install',
    name: 'Fan Installation',
    nameHi: 'पंखा लगाना',
    description: 'Assembling and hanging a ceiling fan. Competitive with local rates of ₹150–₹200.',
    durationMins: 30,
    price: 129,
    category: 'Fan',
  },
  {
    id: 'fan-repair',
    name: 'Fan Repair',
    nameHi: 'पंखा मरम्मत',
    description: 'Capacitor change or bearing check. Labor only — part cost extra (capacitor ~₹30–₹150).',
    durationMins: 30,
    price: 109,
    category: 'Fan',
  },
  {
    id: 'light-fixing',
    name: 'Tube Light / LED Light Fixing',
    nameHi: 'लाइट लगाना',
    description: 'Installation of wall-mounted LED battens or tube light sets.',
    durationMins: 15,
    price: 69,
    category: 'Lighting',
  },
  {
    id: 'mcb-repair',
    name: 'MCB Repair',
    nameHi: 'MCB मरम्मत',
    description: 'Replacing burnt/faulty MCB in distribution box. Technical expertise required.',
    durationMins: 30,
    price: 149,
    category: 'Wiring',
  },
  {
    id: 'inverter-conn',
    name: 'Inverter Connection',
    nameHi: 'इन्वर्टर कनेक्शन',
    description: 'Installing inverter/battery, connecting input/output to main board. Sector 35 electricians charge ₹500+.',
    durationMins: 60,
    price: 399,
    category: 'Inverter',
  },
  {
    id: 'house-wiring',
    name: 'House Wiring (per 5m)',
    nameHi: 'घर की वायरिंग',
    description: 'Pulling new wires through existing conduits. Per-5m pricing protects worker from scope creep.',
    durationMins: 45,
    price: 159,
    category: 'Wiring',
  },
  {
    id: 'socket-install',
    name: 'Socket Installation',
    nameHi: 'सॉकेट लगाना',
    description: 'Installation of 5A or 15A power socket. Load testing included.',
    durationMins: 15,
    price: 89,
    category: 'Switch & Socket',
  },
  {
    id: 'doorbell-repair',
    name: 'Door Bell Repair',
    nameHi: 'दरवाज़ा घंटी मरम्मत',
    description: 'Fixing wireless or wired doorbell connections. Involves circuit tracing.',
    durationMins: 20,
    price: 99,
    category: 'Lighting',
  },
  {
    id: 'appliance-elec-fix',
    name: 'Appliance Electrical Fixing',
    nameHi: 'उपकरण बिजली ठीक करना',
    description: 'Minor electrical fixes (plugs, cords) for small appliances. Saves a trip to Sector 18 market.',
    durationMins: 30,
    price: 149,
    category: 'Appliances',
  },
  {
    id: 'elec-cons',
    name: 'Electrician Consultation',
    nameHi: 'इलेक्ट्रीशियन सलाह',
    description: 'Inspection visit and quote. Free if you book the service.',
    durationMins: 20,
    price: 49,
    category: 'Consultation',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// 🪚 CARPENTRY
// Market: daily-wage carpenter ₹900–₹1,200/day → itemized model is preferred
// Hardware hub: Mani Majra influences local benchmark pricing
// ──────────────────────────────────────────────────────────────────────────────
export const CARPENTRY_SERVICES: ServiceItem[] = [
  {
    id: 'furniture-repair',
    name: 'Furniture Repair',
    nameHi: 'फर्नीचर मरम्मत',
    description: 'Repair of wobbling chairs, tables, or fixing loose ply. Complex repairs quoted on-site.',
    durationMins: 45,
    price: 249,
    category: 'Furniture Repair',
  },
  {
    id: 'door-lock-fix',
    name: 'Door Lock Fix',
    nameHi: 'दरवाज़ा लॉक ठीक करना',
    description: 'Repairing jammed cylindrical or mortise locks. For maintenance, not emergency opening.',
    durationMins: 30,
    price: 149,
    category: 'Wooden Door Services',
  },
  {
    id: 'door-hinge-fix',
    name: 'Door Hinge Fixing',
    nameHi: 'दरवाज़ा कब्ज़ा लगाना',
    description: 'Replacement/tightening of door hinges (up to 2 hinges). Ensures door closes without dragging.',
    durationMins: 30,
    price: 129,
    category: 'Wooden Door Services',
  },
  {
    id: 'bed-repair',
    name: 'Bed Repair',
    nameHi: 'पलंग मरम्मत',
    description: 'Fixing creaking beds, broken support ply, or leg repair. Heavy lifting involved.',
    durationMins: 60,
    price: 319,
    category: 'Furniture Repair',
  },
  {
    id: 'table-chair-repair',
    name: 'Table / Chair Repair',
    nameHi: 'मेज़ / कुर्सी मरम्मत',
    description: 'Fixing wobbling or broken table and chair joints.',
    durationMins: 30,
    price: 149,
    category: 'Furniture Repair',
  },
  {
    id: 'shelf-install',
    name: 'New Shelf Installation',
    nameHi: 'शेल्फ लगाना',
    description: 'Installation of wooden wall shelves. Level and load-bearing guaranteed.',
    durationMins: 45,
    price: 179,
    category: 'Cupboard & Drawer',
  },
  {
    id: 'curtain-rod-inst',
    name: 'Curtain Rod Installation',
    nameHi: 'पर्दा रॉड लगाना',
    description: 'Installation of brackets and rod (per set of brackets). Competitive with Zirakpur rates ₹100–₹150.',
    durationMins: 30,
    price: 129,
    category: 'Fixture Installation',
  },
  {
    id: 'wooden-partition',
    name: 'Wooden Partition Work',
    nameHi: 'लकड़ी का विभाजन',
    description: 'Consultation/survey visit for partition work. Major work quoted per sq ft afterward.',
    durationMins: 30,
    price: 149,
    category: 'Carpentry Work',
  },
  {
    id: 'drill-hang',
    name: 'Drill & Hang (Frames / Mirrors)',
    nameHi: 'ड्रिल और टांगना',
    description: 'Drilling into masonry for pictures, clocks, mirrors (per hole). Gateway to larger jobs.',
    durationMins: 10,
    price: 49,
    category: 'Fixture Installation',
  },
  {
    id: 'carp-cons',
    name: 'Carpenter Consultation',
    nameHi: 'कारपेंटर सलाह',
    description: 'Inspection visit and quote. Free if you book the service.',
    durationMins: 20,
    price: 49,
    category: 'Consultation',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// 🎨 PAINTING
// Seasonal spikes: pre-Diwali and pre-summer. Tenant turnover drives "quick" jobs.
// Local contract rate: ₹10–₹15 per sq ft (distemper/emulsion including material)
// ──────────────────────────────────────────────────────────────────────────────
export const PAINTING_SERVICES: ServiceItem[] = [
  {
    id: 'wall-touchup',
    name: 'Wall Touch-up',
    nameHi: 'दीवार टच-अप',
    description: 'Patch repair and painting of small damaged areas (up to 25 sq ft). Minimum engagement fee.',
    durationMins: 120,
    price: 499,
    category: 'Few Walls',
  },
  {
    id: 'full-room-painting',
    name: 'Full Room Painting',
    nameHi: 'पूरे कमरे की पेंटिंग',
    description: 'Standard room labor at ~₹8–10/sq ft. Competes with local contractors at ₹10–₹12/sq ft.',
    durationMins: 480,
    price: 2000,
    category: 'Room Painting',
  },
  {
    id: 'ceiling-painting',
    name: 'Ceiling Painting',
    nameHi: 'छत की पेंटिंग',
    description: 'Per ceiling at ~₹6/sq ft. Requires less finishing vs eye-level walls.',
    durationMins: 360,
    price: 600,
    category: 'Room Painting',
  },
  {
    id: 'door-window-painting',
    name: 'Door / Window Painting',
    nameHi: 'दरवाज़ा / खिड़की पेंट',
    description: 'Enamel painting for wooden/metal doors (per side). Skill-intensive to avoid brush marks.',
    durationMins: 240,
    price: 450,
    category: 'Surface Painting',
  },
  {
    id: 'exterior-painting',
    name: 'Exterior Wall Painting',
    nameHi: 'बाहरी दीवार पेंटिंग',
    description: 'Weather-proof exterior coating. ₹15/sq ft labor starting price. Scaffolding charged at actuals.',
    durationMins: 480,
    price: 999,
    category: 'Exterior',
  },
  {
    id: 'putty-primer',
    name: 'Putty + Primer Work',
    nameHi: 'पुट्टी + प्राइमर',
    description: 'Base preparation for smooth finish. ₹5/sq ft standard labor rate. Often bundled with full package.',
    durationMins: 360,
    price: 499,
    category: 'Surface Prep',
  },
  {
    id: 'texture-design',
    name: 'Texture Design (Basic)',
    nameHi: 'टेक्सचर डिज़ाइन',
    description: 'Royal Play or specialized texture application for a highlight wall. ₹50/sq ft, locals charge ₹40–₹150.',
    durationMins: 360,
    price: 999,
    category: 'Texture & Design',
  },
  {
    id: 'paint-cons',
    name: 'Painter Consultation',
    nameHi: 'पेंटर सलाह',
    description: 'Inspection visit and painting quote. Free if you book the service.',
    durationMins: 30,
    price: 49,
    category: 'Consultation',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// 🧱 TILES INSTALLER
// Aggregators engage primarily for repairs, not full-floor projects.
// Epoxy grouting is high-value — common in Sec 4,9,18 marble floors.
// ──────────────────────────────────────────────────────────────────────────────
export const TILES_SERVICES: ServiceItem[] = [
  {
    id: 'floor-tiles-inst',
    name: 'Floor Tiles Installation',
    nameHi: 'फर्श टाइल्स लगाना',
    description: 'Laying of vitrified/ceramic floor tiles. ₹35/sq ft labor — better quality than ₹25 roadside mason.',
    durationMins: 240,
    price: 999,
    category: 'Installation',
  },
  {
    id: 'wall-tiles-inst',
    name: 'Wall Tiles Installation',
    nameHi: 'दीवार टाइल्स लगाना',
    description: 'Bathroom/kitchen dado tiles at ₹45/sq ft. Vertical tiling requires adhesive skill to prevent slippage.',
    durationMins: 240,
    price: 1299,
    category: 'Installation',
  },
  {
    id: 'tile-replacement',
    name: 'Tile Replacement',
    nameHi: 'टाइल बदलना',
    description: 'Cutting out broken tiles and fixing new ones (up to 5 tiles). Includes dust/cutting.',
    durationMins: 120,
    price: 499,
    category: 'Repair',
  },
  {
    id: 'tile-gap-filling',
    name: 'Tile Gap / Grout Filling',
    nameHi: 'टाइल जोड़ भरना',
    description: 'Standard cement-based filling for gaps. ₹4/sq ft — basic maintenance rate.',
    durationMins: 60,
    price: 299,
    category: 'Repair',
  },
  {
    id: 'epoxy-grouting',
    name: 'Epoxy Grouting',
    nameHi: 'एपॉक्सी ग्राउटिंग',
    description: 'Specialized waterproof grouting for bathrooms. ₹25/sq ft. Solves seepage common in Chandigarh apartments.',
    durationMins: 120,
    price: 799,
    category: 'Repair',
  },
  {
    id: 'tile-cleaning',
    name: 'Tile Cleaning / Polishing',
    nameHi: 'टाइल साफ़ / पॉलिश',
    description: 'Cleaning and buffing of existing floors. ₹15/sq ft standard scrubbing rate.',
    durationMins: 120,
    price: 499,
    category: 'Cleaning',
  },
  {
    id: 'tiles-cons',
    name: 'Tiles Installer Consultation',
    nameHi: 'टाइल्स सलाह',
    description: 'Inspection visit and quote. Free if you book the service.',
    durationMins: 20,
    price: 49,
    category: 'Consultation',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// 🛠 APPLIANCE REPAIR
// "Check-up Fee" model: entry fee waived if repair is availed.
// Spare parts charged at actuals on top of the labor rate.
// ──────────────────────────────────────────────────────────────────────────────
export const APPLIANCE_SERVICES: ServiceItem[] = [
  {
    id: 'washing-machine-repair',
    name: 'Washing Machine Repair',
    nameHi: 'वॉशिंग मशीन मरम्मत',
    description: 'Check-up for Front/Top load. Fee waived if repair availed. Drain motor replacement ~₹800 extra.',
    durationMins: 60,
    price: 199,
    category: 'Home Appliances',
  },
  {
    id: 'refrigerator-repair',
    name: 'Refrigerator Repair',
    nameHi: 'फ्रिज मरम्मत',
    description: 'Inspection of cooling/compressor issues. Relay/OLP replacement ~₹400 extra.',
    durationMins: 60,
    price: 199,
    category: 'Home Appliances',
  },
  {
    id: 'ac-service-repair',
    name: 'AC Service / Repair',
    nameHi: 'AC सर्विस / मरम्मत',
    description: 'Jet pump cleaning of indoor/outdoor units. High-volume SKU — market standard ₹599.',
    durationMins: 60,
    price: 599,
    category: 'AC',
  },
  {
    id: 'ac-gas-charging',
    name: 'AC Gas Charging',
    nameHi: 'AC गैस भरना',
    description: 'R32/R410 refrigerant refill. Includes leak check. Gas cost ~₹800–₹1,000 included.',
    durationMins: 120,
    price: 2500,
    category: 'AC',
  },
  {
    id: 'microwave-repair',
    name: 'Microwave Repair',
    nameHi: 'माइक्रोवेव मरम्मत',
    description: 'Diagnosis of magnetron, fuse, or keypad. Magnetron replacement ~₹1,200 extra.',
    durationMins: 60,
    price: 199,
    category: 'Kitchen Appliances',
  },
  {
    id: 'cooler-repair',
    name: 'Cooler Repair',
    nameHi: 'कूलर मरम्मत',
    description: 'Motor check, pump replacement, or grass pad change. Seasonal (Apr–June). Parts extra.',
    durationMins: 45,
    price: 149,
    category: 'Home Appliances',
  },
  {
    id: 'geyser-repair-inst',
    name: 'Geyser Installation / Repair',
    nameHi: 'गीजर लगाना / मरम्मत',
    description: 'Wall mounting or element fixing. Safety critical. Heating element cost ~₹300 extra.',
    durationMins: 60,
    price: 349,
    category: 'Home Appliances',
  },
  {
    id: 'appliance-cons',
    name: 'Appliance Repair Consultation',
    nameHi: 'उपकरण सलाह',
    description: 'Inspection visit and diagnosis. Free if you book the repair service.',
    durationMins: 20,
    price: 49,
    category: 'Consultation',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// ❄️ AC REPAIR (Dedicated — detailed breakdown)
// Chandigarh peaks at 45°C — AC servicing is inelastic demand
// ──────────────────────────────────────────────────────────────────────────────
export const AC_SERVICES: ServiceItem[] = [
  {
    id: 'ac-install',
    name: 'Split AC Installation',
    nameHi: 'AC इन्स्टालेशन',
    description: 'Installation of split AC. Includes pipe fitting and electrical connection.',
    durationMins: 90,
    price: 1499,
    category: 'Service & Installation',
  },
  {
    id: 'ac-uninstall',
    name: 'Split AC Uninstallation',
    nameHi: 'AC हटाना',
    description: 'Safe removal of indoor and outdoor units.',
    durationMins: 60,
    price: 899,
    category: 'Service & Installation',
  },
  {
    id: 'ac-service-power',
    name: 'Power Jet Service (Split AC)',
    nameHi: 'स्प्लिट AC सर्विस',
    description: 'Deep jet cleaning of indoor + outdoor units. Market standard ₹599.',
    durationMins: 60,
    price: 599,
    category: 'Service & Installation',
  },
  {
    id: 'ac-service-window',
    name: 'Power Jet Service (Window AC)',
    nameHi: 'विंडो AC सर्विस',
    description: 'Jet pump cleaning for window units.',
    durationMins: 45,
    price: 449,
    category: 'Service & Installation',
  },
  {
    id: 'ac-antirust',
    name: 'Anti-rust Deep Clean Service',
    nameHi: 'डीप क्लीन सर्विस',
    description: 'Anti-corrosion treatment + deep clean for extended AC life.',
    durationMins: 90,
    price: 949,
    category: 'Service & Installation',
  },
  {
    id: 'ac-gas-charge',
    name: 'Full Gas Charging',
    nameHi: 'गैस भरना',
    description: 'R32/R410 refrigerant refill with leak check. Gas + labor inclusive.',
    durationMins: 120,
    price: 2500,
    category: 'Gas Charging',
  },
  {
    id: 'ac-compressor-1-5',
    name: 'Compressor Replacement (1.5 Ton)',
    nameHi: 'कम्प्रेसर बदलना',
    description: 'Full compressor swap. Part cost varies by brand.',
    durationMins: 180,
    price: 4500,
    category: 'Gas Charging',
  },
  {
    id: 'ac-pcb-repair',
    name: 'Non-Inverter PCB Repair',
    nameHi: 'PCB मरम्मत',
    description: 'Circuit board diagnosis and repair for non-inverter units.',
    durationMins: 90,
    price: 1500,
    category: 'Repairs',
  },
  {
    id: 'ac-pcb-inverter',
    name: 'Inverter PCB Repair',
    nameHi: 'इन्वर्टर PCB मरम्मत',
    description: 'Advanced inverter PCB diagnostics and component-level repair.',
    durationMins: 120,
    price: 4500,
    category: 'Repairs',
  },
  {
    id: 'ac-leakage',
    name: 'Water Leakage Repair',
    nameHi: 'पानी रिसाव मरम्मत',
    description: 'Fixing drainage blockages and drain pipe leakages.',
    durationMins: 45,
    price: 599,
    category: 'Repairs',
  },
  {
    id: 'ac-fan-motor',
    name: 'Fan Motor Replacement',
    nameHi: 'फैन मोटर बदलना',
    description: 'Replacing indoor or outdoor fan motor. Part cost not included.',
    durationMins: 90,
    price: 1800,
    category: 'Repairs',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// 🏗 THEKEDAR (Contractor)
// ──────────────────────────────────────────────────────────────────────────────
export const THEKEDAR_SERVICES: ServiceItem[] = [
  {
    id: 'house-renovation',
    name: 'House Renovation',
    nameHi: 'घर नवीनीकरण',
    description: 'Full home renovation consultation and project management.',
    durationMins: 60,
    price: 999,
    category: 'Renovation',
  },
  {
    id: 'wiring-setup',
    name: 'Wiring / Electrical Setup',
    nameHi: 'वायरिंग सेटअप',
    description: 'Complete electrical setup for new construction or renovation.',
    durationMins: 480,
    price: 499,
    category: 'Electrical',
  },
  {
    id: 'plumbing-multi',
    name: 'Plumbing (Multiple Points)',
    nameHi: 'प्लम्बिंग (मल्टी)',
    description: 'Multi-point plumbing for kitchen, bathroom, or washroom.',
    durationMins: 480,
    price: 499,
    category: 'Plumbing',
  },
  {
    id: 'tiles-flooring',
    name: 'Tiles / Flooring',
    nameHi: 'टाइल्स / फर्श',
    description: 'Complete tile laying for rooms, bathrooms, or kitchen. Labor only.',
    durationMins: 480,
    price: 699,
    category: 'Civil Work',
  },
  {
    id: 'false-ceiling',
    name: 'False Ceiling Work',
    nameHi: 'फाल्स सीलिंग',
    description: 'Gypsum or POP false ceiling installation with lighting provisions.',
    durationMins: 480,
    price: 799,
    category: 'Civil Work',
  },
  {
    id: 'custom-work',
    name: 'Custom Work (Discuss on Call)',
    nameHi: 'कस्टम काम',
    description: 'Any non-standard or complex work discussed directly with the contractor.',
    durationMins: 30,
    price: 299,
    category: 'Consultation',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Master map used by BookService.tsx
// ──────────────────────────────────────────────────────────────────────────────
export const SERVICE_DATA_MAP: Record<string, ServiceItem[]> = {
  plumbing: PLUMBING_SERVICES,
  electrical: ELECTRICAL_SERVICES,
  carpentry: CARPENTRY_SERVICES,
  painting: PAINTING_SERVICES,
  tiles: TILES_SERVICES,
  'tiles-installer': TILES_SERVICES,
  'appliance-repair': APPLIANCE_SERVICES,
  'ac-repair': AC_SERVICES,
  'ac-services': AC_SERVICES,
  thekedar: THEKEDAR_SERVICES,
};
