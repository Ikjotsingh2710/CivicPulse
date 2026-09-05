/**
 * Institutions the homepage campus picker offers. `ward_location` on a ticket
 * is set from the chosen entry's `name`, so these strings are what the admin
 * feed filters on — keep them stable once tickets exist against them.
 *
 * Coordinates are approximate campus centroids, accurate enough to fly the map
 * to the right neighbourhood. A ticket's own geotag always comes from the
 * device at capture time, never from this table.
 */
export interface Institution {
  name: string;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
}

export const INSTITUTIONS: readonly Institution[] = [
  { name: 'Delhi Technological University', city: 'New Delhi', pincode: '110042', lat: 28.7501, lng: 77.1177 },
  { name: 'Netaji Subhas University of Technology', city: 'New Delhi', pincode: '110078', lat: 28.6103, lng: 77.0378 },
  { name: 'Indraprastha Institute of Information Technology', city: 'New Delhi', pincode: '110020', lat: 28.5455, lng: 77.2732 },
  { name: 'Jawaharlal Nehru University', city: 'New Delhi', pincode: '110067', lat: 28.5402, lng: 77.1662 },
  { name: 'University of Delhi — North Campus', city: 'New Delhi', pincode: '110007', lat: 28.6889, lng: 77.2103 },
  { name: 'University of Delhi — South Campus', city: 'New Delhi', pincode: '110021', lat: 28.5875, lng: 77.1682 },
  { name: 'Jamia Millia Islamia', city: 'New Delhi', pincode: '110025', lat: 28.5615, lng: 77.2803 },
  { name: 'IIT Delhi', city: 'New Delhi', pincode: '110016', lat: 28.5450, lng: 77.1926 },
  { name: 'IIT Bombay', city: 'Mumbai', pincode: '400076', lat: 19.1334, lng: 72.9133 },
  { name: 'IIT Madras', city: 'Chennai', pincode: '600036', lat: 12.9915, lng: 80.2337 },
  { name: 'IIT Kanpur', city: 'Kanpur', pincode: '208016', lat: 26.5123, lng: 80.2329 },
  { name: 'IIT Roorkee', city: 'Roorkee', pincode: '247667', lat: 29.8650, lng: 77.8964 },
  { name: 'BITS Pilani', city: 'Pilani', pincode: '333031', lat: 28.3639, lng: 75.5870 },
  { name: 'Manipal Institute of Technology', city: 'Manipal', pincode: '576104', lat: 13.3525, lng: 74.7924 },
  { name: 'VIT Vellore', city: 'Vellore', pincode: '632014', lat: 12.9692, lng: 79.1559 },
  { name: 'SRM Institute of Science and Technology', city: 'Chennai', pincode: '603203', lat: 12.8230, lng: 80.0444 },
  { name: 'Anna University', city: 'Chennai', pincode: '600025', lat: 13.0108, lng: 80.2350 },
  { name: 'Osmania University', city: 'Hyderabad', pincode: '500007', lat: 17.4131, lng: 78.5265 },
  { name: 'Savitribai Phule Pune University', city: 'Pune', pincode: '411007', lat: 18.5529, lng: 73.8253 },
  { name: 'Jadavpur University', city: 'Kolkata', pincode: '700032', lat: 22.4991, lng: 88.3714 },
  { name: 'Banaras Hindu University', city: 'Varanasi', pincode: '221005', lat: 25.2677, lng: 82.9913 },
  { name: 'Aligarh Muslim University', city: 'Aligarh', pincode: '202002', lat: 27.9158, lng: 78.0779 },
  { name: 'Panjab University', city: 'Chandigarh', pincode: '160014', lat: 30.7601, lng: 76.7664 },
  { name: 'Christ University', city: 'Bengaluru', pincode: '560029', lat: 12.9345, lng: 77.6065 },
  { name: 'RV College of Engineering', city: 'Bengaluru', pincode: '560059', lat: 12.9237, lng: 77.4987 },
];

/** Where the map sits before anything is chosen: central New Delhi. */
export const DEFAULT_VIEW = { lat: 28.6139, lng: 77.209 } as const;

/** Matches on institution, city or pincode so one field serves every guess. */
export function searchInstitutions(query: string): readonly Institution[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return INSTITUTIONS;

  return INSTITUTIONS.filter(
    (institution) =>
      institution.name.toLowerCase().includes(needle) ||
      institution.city.toLowerCase().includes(needle) ||
      institution.pincode.startsWith(needle),
  );
}
