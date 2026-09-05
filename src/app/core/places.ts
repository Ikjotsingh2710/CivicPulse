import { INSTITUTIONS } from './institutions';

export type PlaceKind = 'campus' | 'city';

/**
 * Where a report is filed against. Whatever is chosen here becomes the
 * ticket's `ward_location`, which is what the admin feed filters on and what
 * `admin_users.ward_location` must match for a desk to see it.
 */
export interface Place {
  kind: PlaceKind;
  name: string;
  /** Secondary line in the picker: the city for a campus, the state for a city. */
  sub: string;
}

export interface City {
  name: string;
  state: string;
}

/**
 * Major Indian cities, by state and union territory.
 *
 * Not literally every city in the country — that is tens of thousands of
 * settlements — but broad enough that a citizen in any sizeable urban area
 * finds theirs. Adding to this list is safe; renaming an entry is not, because
 * existing tickets store the name as text.
 */
export const INDIAN_CITIES: readonly City[] = [
  { name: 'Agartala', state: 'Tripura' },
  { name: 'Agra', state: 'Uttar Pradesh' },
  { name: 'Ahmedabad', state: 'Gujarat' },
  { name: 'Aizawl', state: 'Mizoram' },
  { name: 'Ajmer', state: 'Rajasthan' },
  { name: 'Aligarh', state: 'Uttar Pradesh' },
  { name: 'Allahabad (Prayagraj)', state: 'Uttar Pradesh' },
  { name: 'Alwar', state: 'Rajasthan' },
  { name: 'Ambala', state: 'Haryana' },
  { name: 'Amravati', state: 'Maharashtra' },
  { name: 'Amritsar', state: 'Punjab' },
  { name: 'Anantapur', state: 'Andhra Pradesh' },
  { name: 'Asansol', state: 'West Bengal' },
  { name: 'Aurangabad', state: 'Maharashtra' },
  { name: 'Bareilly', state: 'Uttar Pradesh' },
  { name: 'Belagavi (Belgaum)', state: 'Karnataka' },
  { name: 'Bengaluru', state: 'Karnataka' },
  { name: 'Bhagalpur', state: 'Bihar' },
  { name: 'Bharuch', state: 'Gujarat' },
  { name: 'Bhavnagar', state: 'Gujarat' },
  { name: 'Bhilai', state: 'Chhattisgarh' },
  { name: 'Bhiwandi', state: 'Maharashtra' },
  { name: 'Bhopal', state: 'Madhya Pradesh' },
  { name: 'Bhubaneswar', state: 'Odisha' },
  { name: 'Bikaner', state: 'Rajasthan' },
  { name: 'Bilaspur', state: 'Chhattisgarh' },
  { name: 'Chandigarh', state: 'Chandigarh' },
  { name: 'Chennai', state: 'Tamil Nadu' },
  { name: 'Coimbatore', state: 'Tamil Nadu' },
  { name: 'Cuttack', state: 'Odisha' },
  { name: 'Darbhanga', state: 'Bihar' },
  { name: 'Davanagere', state: 'Karnataka' },
  { name: 'Dehradun', state: 'Uttarakhand' },
  { name: 'Delhi', state: 'Delhi' },
  { name: 'Dhanbad', state: 'Jharkhand' },
  { name: 'Dibrugarh', state: 'Assam' },
  { name: 'Durgapur', state: 'West Bengal' },
  { name: 'Erode', state: 'Tamil Nadu' },
  { name: 'Faridabad', state: 'Haryana' },
  { name: 'Firozabad', state: 'Uttar Pradesh' },
  { name: 'Gandhinagar', state: 'Gujarat' },
  { name: 'Gangtok', state: 'Sikkim' },
  { name: 'Gaya', state: 'Bihar' },
  { name: 'Ghaziabad', state: 'Uttar Pradesh' },
  { name: 'Gorakhpur', state: 'Uttar Pradesh' },
  { name: 'Guntur', state: 'Andhra Pradesh' },
  { name: 'Gurugram', state: 'Haryana' },
  { name: 'Guwahati', state: 'Assam' },
  { name: 'Gwalior', state: 'Madhya Pradesh' },
  { name: 'Haldwani', state: 'Uttarakhand' },
  { name: 'Haridwar', state: 'Uttarakhand' },
  { name: 'Hisar', state: 'Haryana' },
  { name: 'Hubballi (Hubli)', state: 'Karnataka' },
  { name: 'Hyderabad', state: 'Telangana' },
  { name: 'Imphal', state: 'Manipur' },
  { name: 'Indore', state: 'Madhya Pradesh' },
  { name: 'Itanagar', state: 'Arunachal Pradesh' },
  { name: 'Jabalpur', state: 'Madhya Pradesh' },
  { name: 'Jaipur', state: 'Rajasthan' },
  { name: 'Jalandhar', state: 'Punjab' },
  { name: 'Jalgaon', state: 'Maharashtra' },
  { name: 'Jammu', state: 'Jammu and Kashmir' },
  { name: 'Jamnagar', state: 'Gujarat' },
  { name: 'Jamshedpur', state: 'Jharkhand' },
  { name: 'Jhansi', state: 'Uttar Pradesh' },
  { name: 'Jodhpur', state: 'Rajasthan' },
  { name: 'Kakinada', state: 'Andhra Pradesh' },
  { name: 'Kalyan-Dombivli', state: 'Maharashtra' },
  { name: 'Kanpur', state: 'Uttar Pradesh' },
  { name: 'Karnal', state: 'Haryana' },
  { name: 'Kochi', state: 'Kerala' },
  { name: 'Kohima', state: 'Nagaland' },
  { name: 'Kolhapur', state: 'Maharashtra' },
  { name: 'Kolkata', state: 'West Bengal' },
  { name: 'Kollam', state: 'Kerala' },
  { name: 'Korba', state: 'Chhattisgarh' },
  { name: 'Kota', state: 'Rajasthan' },
  { name: 'Kozhikode', state: 'Kerala' },
  { name: 'Kurnool', state: 'Andhra Pradesh' },
  { name: 'Lucknow', state: 'Uttar Pradesh' },
  { name: 'Ludhiana', state: 'Punjab' },
  { name: 'Madurai', state: 'Tamil Nadu' },
  { name: 'Mangaluru (Mangalore)', state: 'Karnataka' },
  { name: 'Mathura', state: 'Uttar Pradesh' },
  { name: 'Meerut', state: 'Uttar Pradesh' },
  { name: 'Moradabad', state: 'Uttar Pradesh' },
  { name: 'Mumbai', state: 'Maharashtra' },
  { name: 'Muzaffarpur', state: 'Bihar' },
  { name: 'Mysuru (Mysore)', state: 'Karnataka' },
  { name: 'Nagpur', state: 'Maharashtra' },
  { name: 'Nanded', state: 'Maharashtra' },
  { name: 'Nashik', state: 'Maharashtra' },
  { name: 'Navi Mumbai', state: 'Maharashtra' },
  { name: 'Nellore', state: 'Andhra Pradesh' },
  { name: 'New Delhi', state: 'Delhi' },
  { name: 'Noida', state: 'Uttar Pradesh' },
  { name: 'Panaji', state: 'Goa' },
  { name: 'Panipat', state: 'Haryana' },
  { name: 'Patiala', state: 'Punjab' },
  { name: 'Patna', state: 'Bihar' },
  { name: 'Puducherry', state: 'Puducherry' },
  { name: 'Pune', state: 'Maharashtra' },
  { name: 'Raipur', state: 'Chhattisgarh' },
  { name: 'Rajahmundry', state: 'Andhra Pradesh' },
  { name: 'Rajkot', state: 'Gujarat' },
  { name: 'Ranchi', state: 'Jharkhand' },
  { name: 'Ratlam', state: 'Madhya Pradesh' },
  { name: 'Rohtak', state: 'Haryana' },
  { name: 'Roorkee', state: 'Uttarakhand' },
  { name: 'Rourkela', state: 'Odisha' },
  { name: 'Saharanpur', state: 'Uttar Pradesh' },
  { name: 'Salem', state: 'Tamil Nadu' },
  { name: 'Sangli', state: 'Maharashtra' },
  { name: 'Shillong', state: 'Meghalaya' },
  { name: 'Shimla', state: 'Himachal Pradesh' },
  { name: 'Siliguri', state: 'West Bengal' },
  { name: 'Solapur', state: 'Maharashtra' },
  { name: 'Srinagar', state: 'Jammu and Kashmir' },
  { name: 'Surat', state: 'Gujarat' },
  { name: 'Thane', state: 'Maharashtra' },
  { name: 'Thiruvananthapuram', state: 'Kerala' },
  { name: 'Thrissur', state: 'Kerala' },
  { name: 'Tiruchirappalli', state: 'Tamil Nadu' },
  { name: 'Tirunelveli', state: 'Tamil Nadu' },
  { name: 'Tirupati', state: 'Andhra Pradesh' },
  { name: 'Udaipur', state: 'Rajasthan' },
  { name: 'Ujjain', state: 'Madhya Pradesh' },
  { name: 'Vadodara', state: 'Gujarat' },
  { name: 'Varanasi', state: 'Uttar Pradesh' },
  { name: 'Vasai-Virar', state: 'Maharashtra' },
  { name: 'Vellore', state: 'Tamil Nadu' },
  { name: 'Vijayawada', state: 'Andhra Pradesh' },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh' },
  { name: 'Warangal', state: 'Telangana' },
];

const CAMPUS_PLACES: readonly Place[] = INSTITUTIONS.map((institution) => ({
  kind: 'campus' as const,
  name: institution.name,
  sub: `${institution.city} · ${institution.pincode}`,
}));

const CITY_PLACES: readonly Place[] = INDIAN_CITIES.map((city) => ({
  kind: 'city' as const,
  name: city.name,
  sub: city.state,
}));

/**
 * Filters one list or the other. Campuses also match on their city and
 * pincode, cities on their state, so a half-remembered guess still lands.
 */
export function searchPlaces(kind: PlaceKind, query: string): readonly Place[] {
  const source = kind === 'campus' ? CAMPUS_PLACES : CITY_PLACES;
  const needle = query.trim().toLowerCase();
  if (!needle) return source;

  return source.filter(
    (place) =>
      place.name.toLowerCase().includes(needle) || place.sub.toLowerCase().includes(needle),
  );
}
