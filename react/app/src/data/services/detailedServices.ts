export interface ServiceItem {
  id: string;
  name: string;
  nameHi?: string;
  description?: string;
  price: number;
  category: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// 🔧 PLUMBING
// ──────────────────────────────────────────────────────────────────────────────
export const PLUMBING_SERVICES: ServiceItem[] = [
  { id: 'tap-repair',           name: 'Tap Repair',                     nameHi: 'नल की मरम्मत',           price: 99,  category: 'Tap & Mixer' },
  { id: 'mixer-tap-inst',       name: 'Mixer Tap Installation',          nameHi: 'मिक्सर नल लगाना',         price: 199, category: 'Tap & Mixer' },
  { id: 'shower-installation',  name: 'Shower Installation',             nameHi: 'शॉवर लगाना',             price: 199, category: 'Bath & Shower' },
  { id: 'pipe-leak-repair',     name: 'Pipe Leak Repair',               nameHi: 'पाइप लीकेज ठीक करना',    price: 149, category: 'Pipes' },
  { id: 'blockage-sink',        name: 'Blockage Removal (Sink/Bathroom)',nameHi: 'बंद नाली खोलना',         price: 199, category: 'Blockage' },
  { id: 'flush-tank-repair',    name: 'Flush Tank Repair',              nameHi: 'फ्लश टैंक मरम्मत',      price: 149, category: 'Toilet' },
  { id: 'basin-installation',   name: 'Basin Installation',             nameHi: 'बेसिन लगाना',            price: 469, category: 'Basin & Sink' },
  { id: 'toilet-seat-inst',     name: 'Toilet Seat Installation',       nameHi: 'टॉयलेट सीट लगाना',      price: 299, category: 'Toilet' },
  { id: 'bathroom-fittings',    name: 'Bathroom Fittings Installation', nameHi: 'बाथरूम फिटिंग्स',        price: 349, category: 'Bath & Shower' },
  { id: 'kitchen-sink-inst',    name: 'Kitchen Sink Installation',      nameHi: 'किचन सिंक लगाना',        price: 399, category: 'Basin & Sink' },
  { id: 'water-motor-conn',     name: 'Water Motor Connection',         nameHi: 'मोटर कनेक्शन',           price: 449, category: 'Water Tank & Motor' },
  { id: 'tank-inlet-outlet',    name: 'Water Tank Inlet/Outlet Repair', nameHi: 'टंकी की मरम्मत',         price: 199, category: 'Water Tank & Motor' },
  { id: 'plumbing-cons',        name: 'Plumber Consultation',           nameHi: 'प्लम्बर सलाह',           price: 49,  category: 'Consultation' },
];

// ──────────────────────────────────────────────────────────────────────────────
// ⚡ ELECTRICAL
// ──────────────────────────────────────────────────────────────────────────────
export const ELECTRICAL_SERVICES: ServiceItem[] = [
  { id: 'switchboard-repair',   name: 'Switch Board Repair',            nameHi: 'स्विच बोर्ड मरम्मत',    price: 99,  category: 'Switch & Socket' },
  { id: 'switch-install',       name: 'New Switch Installation',        nameHi: 'नया स्विच लगाना',        price: 69,  category: 'Switch & Socket' },
  { id: 'fan-install-repair',   name: 'Fan Installation / Repair',      nameHi: 'पंखा लगाना / मरम्मत',   price: 149, category: 'Fan' },
  { id: 'light-fixing',         name: 'Tube Light / LED Light Fixing',  nameHi: 'लाइट लगाना',             price: 99,  category: 'Lighting' },
  { id: 'mcb-repair',           name: 'MCB Repair',                     nameHi: 'MCB मरम्मत',             price: 149, category: 'Wiring' },
  { id: 'inverter-conn',        name: 'Inverter Connection',            nameHi: 'इन्वर्टर कनेक्शन',       price: 485, category: 'Inverter' },
  { id: 'house-wiring',         name: 'House Wiring',                   nameHi: 'घर की वायरिंग',          price: 999, category: 'Wiring' },
  { id: 'socket-install',       name: 'Socket Installation',            nameHi: 'सॉकेट लगाना',            price: 79,  category: 'Switch & Socket' },
  { id: 'doorbell-repair',      name: 'Door Bell Repair',               nameHi: 'दरवाज़ा घंटी मरम्मत',    price: 99,  category: 'Lighting' },
  { id: 'appliance-elec-fix',   name: 'Appliance Electrical Fixing',    nameHi: 'उपकरण बिजली ठीक करना',  price: 199, category: 'Appliances' },
  { id: 'elec-cons',            name: 'Electrician Consultation',       nameHi: 'इलेक्ट्रीशियन सलाह',    price: 49,  category: 'Consultation' },
];

// ──────────────────────────────────────────────────────────────────────────────
// 🪚 CARPENTRY
// ──────────────────────────────────────────────────────────────────────────────
export const CARPENTRY_SERVICES: ServiceItem[] = [
  { id: 'furniture-repair',     name: 'Furniture Repair',               nameHi: 'फर्नीचर मरम्मत',         price: 199, category: 'Furniture Repair' },
  { id: 'door-lock-fix',        name: 'Door Lock Fix',                  nameHi: 'दरवाज़ा लॉक ठीक करना',   price: 149, category: 'Wooden Door Services' },
  { id: 'door-hinge-fix',       name: 'Door Hinge Fixing',              nameHi: 'दरवाज़ा कब्ज़ा लगाना',    price: 99,  category: 'Wooden Door Services' },
  { id: 'bed-repair',           name: 'Bed Repair',                     nameHi: 'पलंग मरम्मत',            price: 199, category: 'Furniture Repair' },
  { id: 'table-chair-repair',   name: 'Table / Chair Repair',           nameHi: 'मेज़ / कुर्सी मरम्मत',   price: 149, category: 'Furniture Repair' },
  { id: 'shelf-install',        name: 'New Shelf Installation',         nameHi: 'शेल्फ लगाना',            price: 249, category: 'Cupboard & Drawer' },
  { id: 'curtain-rod-inst',     name: 'Curtain Rod Installation',       nameHi: 'पर्दा रॉड लगाना',        price: 149, category: 'Fixture Installation' },
  { id: 'wooden-partition',     name: 'Wooden Partition Work',          nameHi: 'लकड़ी का विभाजन',        price: 499, category: 'Carpentry Work' },
  { id: 'drill-hang',           name: 'Drill & Hang (Frames / Mirrors)',nameHi: 'ड्रिल और टांगना',        price: 99,  category: 'Fixture Installation' },
  { id: 'carp-cons',            name: 'Carpenter Consultation',         nameHi: 'कारपेंटर सलाह',          price: 49,  category: 'Consultation' },
];

// ──────────────────────────────────────────────────────────────────────────────
// 🎨 PAINTING
// ──────────────────────────────────────────────────────────────────────────────
export const PAINTING_SERVICES: ServiceItem[] = [
  { id: 'full-room-painting',   name: 'Full Room Painting',             nameHi: 'पूरे कमरे की पेंटिंग',  price: 2499, category: 'Room Painting' },
  { id: 'wall-touchup',         name: 'Wall Touch-up',                  nameHi: 'दीवार टच-अप',            price: 799,  category: 'Few Walls' },
  { id: 'ceiling-painting',     name: 'Ceiling Painting',               nameHi: 'छत की पेंटिंग',          price: 1499, category: 'Room Painting' },
  { id: 'door-window-painting', name: 'Door / Window Painting',         nameHi: 'दरवाज़ा / खिड़की पेंट',  price: 499,  category: 'Surface Painting' },
  { id: 'exterior-painting',    name: 'Exterior Wall Painting',         nameHi: 'बाहरी दीवार पेंटिंग',   price: 3999, category: 'Exterior' },
  { id: 'putty-primer',         name: 'Putty + Primer Work',            nameHi: 'पुट्टी + प्राइमर',       price: 1299, category: 'Surface Prep' },
  { id: 'texture-design',       name: 'Texture Design (Basic)',         nameHi: 'टेक्सचर डिज़ाइन',       price: 1999, category: 'Texture & Design' },
  { id: 'paint-cons',           name: 'Painter Consultation',           nameHi: 'पेंटर सलाह',             price: 49,   category: 'Consultation' },
];

// ──────────────────────────────────────────────────────────────────────────────
// 🧱 TILES INSTALLER
// ──────────────────────────────────────────────────────────────────────────────
export const TILES_SERVICES: ServiceItem[] = [
  { id: 'floor-tiles-inst',     name: 'Floor Tiles Installation',       nameHi: 'फर्श टाइल्स लगाना',      price: 1499, category: 'Installation' },
  { id: 'wall-tiles-inst',      name: 'Wall Tiles Installation',        nameHi: 'दीवार टाइल्स लगाना',     price: 1299, category: 'Installation' },
  { id: 'tile-replacement',     name: 'Tile Replacement',               nameHi: 'टाइल बदलना',              price: 399,  category: 'Repair' },
  { id: 'tile-gap-filling',     name: 'Tile Gap Filling',               nameHi: 'टाइल जोड़ भरना',          price: 299,  category: 'Repair' },
  { id: 'tile-cleaning',        name: 'Tile Cleaning / Polishing',      nameHi: 'टाइल साफ़ / पॉलिश',       price: 499,  category: 'Cleaning' },
  { id: 'tiles-cons',           name: 'Tiles Installer Consultation',   nameHi: 'टाइल्स सलाह',             price: 49,   category: 'Consultation' },
];

// ──────────────────────────────────────────────────────────────────────────────
// 🛠 APPLIANCE REPAIR
// ──────────────────────────────────────────────────────────────────────────────
export const APPLIANCE_SERVICES: ServiceItem[] = [
  { id: 'washing-machine-repair',name: 'Washing Machine Repair',        nameHi: 'वॉशिंग मशीन मरम्मत',    price: 399,  category: 'Home Appliances' },
  { id: 'refrigerator-repair',   name: 'Refrigerator Repair',           nameHi: 'फ्रिज मरम्मत',           price: 499,  category: 'Home Appliances' },
  { id: 'ac-service-repair',     name: 'AC Service / Repair',           nameHi: 'AC सर्विस / मरम्मत',    price: 499,  category: 'AC' },
  { id: 'microwave-repair',      name: 'Microwave Repair',              nameHi: 'माइक्रोवेव मरम्मत',      price: 299,  category: 'Kitchen Appliances' },
  { id: 'cooler-repair',         name: 'Cooler Repair',                 nameHi: 'कूलर मरम्मत',            price: 299,  category: 'Home Appliances' },
  { id: 'geyser-repair-inst',    name: 'Geyser Installation / Repair',  nameHi: 'गीजर लगाना / मरम्मत',   price: 399,  category: 'Home Appliances' },
  { id: 'appliance-cons',        name: 'Appliance Repair Consultation', nameHi: 'उपकरण सलाह',             price: 49,   category: 'Consultation' },
];

// ──────────────────────────────────────────────────────────────────────────────
// ❄️ AC REPAIR (Dedicated — more detailed)
// ──────────────────────────────────────────────────────────────────────────────
export const AC_SERVICES: ServiceItem[] = [
  { id: 'ac-install',           name: 'Split AC Installation',          nameHi: 'AC इन्स्टालेशन',         price: 1499, category: 'Service & Installation' },
  { id: 'ac-uninstall',         name: 'Split AC Uninstallation',        nameHi: 'AC हटाना',               price: 899,  category: 'Service & Installation' },
  { id: 'ac-service-power',     name: 'Power Jet AC Service (Split)',   nameHi: 'स्प्लिट AC सर्विस',      price: 499,  category: 'Service & Installation' },
  { id: 'ac-service-window',    name: 'Power Jet AC Service (Window)',  nameHi: 'विंडो AC सर्विस',        price: 449,  category: 'Service & Installation' },
  { id: 'ac-antirust',          name: 'Anti-rust Deep Clean AC Service',nameHi: 'डीप क्लीन सर्विस',      price: 949,  category: 'Service & Installation' },
  { id: 'ac-gas-charge',        name: 'Full Gas Charging',              nameHi: 'गैस भरना',               price: 2800, category: 'Gas Charging' },
  { id: 'ac-compressor-1-5',    name: 'Compressor Replacement (1.5T)', nameHi: 'कम्प्रेसर बदलना',        price: 4500, category: 'Gas Charging' },
  { id: 'ac-pcb-repair',        name: 'Non-Inverter PCB Repair',        nameHi: 'PCB मरम्मत',             price: 1500, category: 'Repairs' },
  { id: 'ac-pcb-inverter',      name: 'Inverter PCB Repair',            nameHi: 'इन्वर्टर PCB मरम्मत',   price: 4500, category: 'Repairs' },
  { id: 'ac-leakage',           name: 'Water Leakage Repair',           nameHi: 'पानी रिसाव मरम्मत',      price: 599,  category: 'Repairs' },
  { id: 'ac-fan-motor',         name: 'Fan Motor Replacement',          nameHi: 'फैन मोटर बदलना',         price: 1800, category: 'Repairs' },
];

// ──────────────────────────────────────────────────────────────────────────────
// 🏗 THEKEDAR (Contractor)
// ──────────────────────────────────────────────────────────────────────────────
export const THEKEDAR_SERVICES: ServiceItem[] = [
  { id: 'house-renovation',    name: 'House Renovation',                nameHi: 'घर नवीनीकरण',            price: 999, category: 'Renovation' },
  { id: 'wiring-setup',        name: 'Wiring / Electrical Setup',       nameHi: 'वायरिंग सेटअप',          price: 499, category: 'Electrical' },
  { id: 'plumbing-multi',      name: 'Plumbing (Multiple Points)',      nameHi: 'प्लम्बिंग (मल्टी)',      price: 499, category: 'Plumbing' },
  { id: 'tiles-flooring',      name: 'Tiles / Flooring',               nameHi: 'टाइल्स / फर्श',          price: 699, category: 'Civil Work' },
  { id: 'false-ceiling',       name: 'False Ceiling Work',             nameHi: 'फाल्स सीलिंग',           price: 799, category: 'Civil Work' },
  { id: 'custom-work',         name: 'Custom Work (Discuss on Call)',   nameHi: 'कस्टम काम',              price: 299, category: 'Consultation' },
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
