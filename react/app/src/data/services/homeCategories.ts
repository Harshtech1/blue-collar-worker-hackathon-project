export interface HomeServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  subcategories: string[];
}

export const HOME_SERVICE_CATEGORIES: HomeServiceCategory[] = [
  {
    id: 'plumbing',
    name: 'Plumber',
    description: 'Tap, pipe, sink, toilet, motor, and tank work from verified local plumbers.',
    icon: 'droplets',
    color: '#0ea5e9',
    subcategories: [
      'Tap Repair',
      'Shower Installation',
      'Pipe Leak Repair',
      'Blockage Removal (Sink / Bathroom)',
      'Flush Tank Repair',
      'Basin Installation',
      'Toilet Seat Installation',
      'Mixer Tap Installation',
      'Bathroom Fittings Installation',
      'Kitchen Sink Installation',
      'Water Motor Connection',
      'Water Tank Inlet/Outlet Repair',
    ],
  },
  {
    id: 'electrical',
    name: 'Electrician',
    description: 'Wiring, switches, lights, fans, and power setup support for homes and shops.',
    icon: 'zap',
    color: '#f59e0b',
    subcategories: [
      'Switch Board Repair',
      'New Switch Installation',
      'Fan Installation / Repair',
      'Tube Light / LED Light Fixing',
      'MCB Repair',
      'Inverter Connection',
      'House Wiring',
      'Socket Installation',
      'Door Bell Repair',
      'Appliance Electrical Fixing',
    ],
  },
  {
    id: 'carpentry',
    name: 'Carpenter',
    description: 'Furniture, shelves, curtain rods, wooden fittings, and drill-and-hang jobs.',
    icon: 'hammer',
    color: '#8b5cf6',
    subcategories: [
      'Furniture Repair',
      'Door Lock Fix',
      'Door Hinge Fixing',
      'Bed Repair',
      'Table/Chair Repair',
      'New Shelf Installation',
      'Curtain Rod Installation',
      'Wooden Partition Work',
      'Drill & Hang (Frames / Mirrors)',
    ],
  },
  {
    id: 'painting',
    name: 'Painter',
    description: 'Fresh paint, touch-ups, ceiling work, putty, primer, and exterior coating.',
    icon: 'paintbrush',
    color: '#ec4899',
    subcategories: [
      'Full Room Painting',
      'Wall Touch-up',
      'Ceiling Painting',
      'Door/Window Painting',
      'Exterior Wall Painting',
      'Putty + Primer Work',
      'Texture Design (Basic)',
    ],
  },
  {
    id: 'appliance-repair',
    name: 'Appliance Repair',
    description: 'Repair and installation support for home appliances and seasonal machines.',
    icon: 'settings',
    color: '#6366f1',
    subcategories: [
      'Washing Machine Repair',
      'Refrigerator Repair',
      'AC Service / Repair',
      'Microwave Repair',
      'Cooler Repair',
      'Geyser Installation / Repair',
    ],
  },
  {
    id: 'ac-repair',
    name: 'AC Service',
    description: 'Fast cooling support for split and window ACs, from service to leakage repair.',
    icon: 'thermometer',
    color: '#2563eb',
    subcategories: [
      'Power Jet Service (Split AC)',
      'Power Jet Service (Window AC)',
      'Split AC Installation',
      'Split AC Uninstallation',
      'Full Gas Charging',
      'Water Leakage Repair',
    ],
  },
];
