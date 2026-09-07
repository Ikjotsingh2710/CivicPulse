export type TicketStatus = 'Submitted' | 'In Progress' | 'Resolved' | 'Rejected';
export type TicketUrgency = 'Low' | 'Medium' | 'High';

/** Every value the column may hold — admin filters and the status dropdown. */
export const TICKET_STATUSES: readonly TicketStatus[] = [
  'Submitted',
  'In Progress',
  'Resolved',
  'Rejected',
] as const;

/**
 * The forward path a healthy ticket walks, and the only thing the citizen's
 * progress trail should draw. Rejection is a terminal branch off this pipeline,
 * not a fourth step along it — showing it as one would imply every report is
 * heading there.
 */
export const TICKET_PIPELINE: readonly TicketStatus[] = [
  'Submitted',
  'In Progress',
  'Resolved',
] as const;

/**
 * Offered to the desk as one-click reasons, and shown verbatim to the citizen.
 * Written to be specific enough to act on: "rejected" with no cause reads as
 * the system ignoring you, which is how people stop reporting.
 */
export const REJECTION_REASONS = [
  'The photo does not show the issue that was reported',
  'The photo shows a person rather than a civic issue',
  'This is a duplicate of a report already filed',
  'This is not a civic issue the ward can act on',
  'The photo is too unclear to identify the problem',
  'The location or ward on this report is wrong',
] as const;

export const TICKET_URGENCIES: readonly TicketUrgency[] = ['Low', 'Medium', 'High'] as const;

export const TICKET_CATEGORIES = [
  'Potholes',
  'Broken Streetlight',
  'Waste',
  'Water Leakage',
  'Other',
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/**
 * Short labels for the homepage picker, mapped to the canonical values stored
 * in `grievance_tickets.category`. The admin feed filters on the stored value,
 * so the two must never drift apart.
 */
export const CATEGORY_OPTIONS: readonly { label: string; value: TicketCategory }[] = [
  { label: 'Pothole', value: 'Potholes' },
  { label: 'Streetlight', value: 'Broken Streetlight' },
  { label: 'Garbage', value: 'Waste' },
  { label: 'Water Leak', value: 'Water Leakage' },
  { label: 'Others', value: 'Other' },
];

/** Descriptions are capped so ward desks get a scannable line, not an essay. */
export const DESCRIPTION_LIMIT = 200;

/**
 * Pre-written openers offered once a photo exists. Most people are standing in
 * the street when they file, so tapping an accurate sentence beats typing one;
 * every template stays inside DESCRIPTION_LIMIT and can be edited after it is
 * inserted.
 */
export const DESCRIPTION_TEMPLATES: Record<TicketCategory, readonly string[]> = {
  Potholes: [
    'Deep pothole in the middle of the road — vehicles are swerving around it.',
    'Cluster of potholes near the junction; they fill with water after rain.',
    'Pothole has widened over the past week and is now dangerous for two-wheelers.',
  ],
  'Broken Streetlight': [
    'Streetlight has been out for several nights, leaving this stretch completely dark.',
    'Light flickers through the night and keeps cutting out.',
    'Pole is damaged and the fixture is hanging loose overhead.',
  ],
  Waste: [
    'Garbage has not been collected for days and the bin is overflowing.',
    'Waste dumped outside the designated bin — strong smell and flies.',
    'Construction debris left on the footpath, blocking the walkway.',
  ],
  'Water Leakage': [
    'Pipeline has been leaking continuously and water is being wasted.',
    'Burst line has left water logged across the road.',
    'Leak near the valve has made the surrounding area slippery.',
  ],
  Other: [
    'Damaged footpath slab that pedestrians are tripping over.',
    'Broken public fixture that needs repair or removal.',
    'Obstruction on a public path that is blocking access.',
  ],
};

/**
 * The same openers in Hindi.
 *
 * These are not UI labels — tapping one writes it into `description`, which is
 * what the ward desk reads and what gets pasted into a government portal. So a
 * citizen filing in Hindi files a complaint that is genuinely in their words,
 * rather than a Hindi interface that submits English on their behalf.
 */
export const DESCRIPTION_TEMPLATES_HI: Record<TicketCategory, readonly string[]> = {
  Potholes: [
    'सड़क के बीच गहरा गड्ढा — गाड़ियाँ बचकर निकल रही हैं।',
    'चौराहे के पास कई गड्ढे हैं; बारिश के बाद उनमें पानी भर जाता है।',
    'पिछले हफ़्ते से गड्ढा और चौड़ा हो गया है, दोपहिया वालों के लिए ख़तरनाक है।',
  ],
  'Broken Streetlight': [
    'कई रातों से स्ट्रीटलाइट बंद है, पूरा हिस्सा अंधेरे में रहता है।',
    'लाइट रात भर टिमटिमाती है और बार-बार बंद हो जाती है।',
    'खंभा टूटा हुआ है और ऊपर फ़िटिंग लटक रही है।',
  ],
  Waste: [
    'कई दिनों से कूड़ा नहीं उठा, कूड़ेदान भर कर बह रहा है।',
    'कूड़ेदान के बाहर कचरा फेंका गया है — तेज़ बदबू और मक्खियाँ हैं।',
    'फुटपाथ पर निर्माण का मलबा पड़ा है, रास्ता बंद है।',
  ],
  'Water Leakage': [
    'पाइपलाइन लगातार लीक कर रही है और पानी बर्बाद हो रहा है।',
    'लाइन फटने से सड़क पर पानी भर गया है।',
    'वॉल्व के पास रिसाव से आसपास फिसलन हो गई है।',
  ],
  Other: [
    'फुटपाथ की टूटी स्लैब, जिससे लोग ठोकर खा रहे हैं।',
    'सार्वजनिक जगह की टूटी चीज़, जिसकी मरम्मत या हटाया जाना ज़रूरी है।',
    'सार्वजनिक रास्ते पर रुकावट, जिससे आना-जाना बंद है।',
  ],
};

export interface GrievanceTicket {
  id: string;
  ticket_number: string;
  created_at: string;
  updated_at: string;
  user_phone: string;
  user_name: string | null;
  category: string;
  description: string | null;
  urgency: TicketUrgency;
  latitude: number | null;
  longitude: number | null;
  /** Radius of the fix in metres. Small means a crew can walk straight to it. */
  location_accuracy_m: number | null;
  ward_location: string;
  image_url: string;
  status: TicketStatus;
  /** How many other people said they have this problem too. */
  upvote_count: number;
  /** Set only while `status` is 'Rejected'; a trigger clears it otherwise. */
  rejection_reason: string | null;
  resolution_image_url: string | null;
  department_email: string | null;
  last_escalated_at: string | null;

  // ---------------------------------------------------- government handoff
  /** Which body this was handed to, matching `portal_directory.jurisdiction`. */
  portal_jurisdiction: string | null;
  portal_status: PortalStatus;
  /** Stamped by the database, never by the device, so reminders fire on time. */
  portal_handed_off_at: string | null;
  /** The complaint number the portal issued, typed in by the citizen. */
  portal_reference_id: string | null;
}

/**
 * How far a report has got with the government body, as distinct from how far
 * it has got with CivicPulse's own ward desk. The two run in parallel.
 *
 * `awaiting_user_submission` is where an assisted handoff honestly leaves
 * things: the citizen was taken to the portal with everything ready, and only
 * they can say whether they finished.
 */
export type PortalStatus = 'not_sent' | 'awaiting_user_submission' | 'submitted';

/** Columns the citizen portal supplies; the rest are defaulted by Postgres. */
export type NewGrievanceTicket = Pick<
  GrievanceTicket,
  'user_phone' | 'category' | 'ward_location' | 'image_url'
> &
  Partial<
    Pick<
      GrievanceTicket,
      | 'user_name'
      | 'description'
      | 'urgency'
      | 'latitude'
      | 'longitude'
      | 'location_accuracy_m'
      | 'department_email'
    >
  >;

export interface AdminUser {
  id: string;
  phone: string;
  full_name: string | null;
  ward_location: string;
  created_at: string;
}

/**
 * A row of `public.profiles` — the mirror of `auth.users` identity that the
 * browser is allowed to see. Admins read every row; a citizen reads only their
 * own. There is deliberately no password or session data here.
 */
export interface Profile {
  id: string;
  phone: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

/** A row of `public.platform_feedback`. Insertable by anyone, readable only by admins. */
export interface PlatformFeedback {
  id: string;
  created_at: string;
  user_phone: string | null;
  user_name: string | null;
  sentiment: 'Good' | 'Okay' | 'Bad' | null;
  message: string;
  page: string | null;
}

/** What the citizen typed on the sign-in / registration form. */
export interface Credentials {
  phone: string;
  password: string;
}

export interface Registration extends Credentials {
  fullName: string;
}

// ------------------------------------------------------ Public feed & upvotes

/**
 * A report as everyone else sees it — the column list of `public.public_tickets`.
 *
 * `user_name` is here and `user_phone` is deliberately not. Anyone, signed in
 * or not, can read this; only the ward desk ever sees who to contact.
 */
export interface PublicTicket {
  id: string;
  ticket_number: string;
  created_at: string;
  category: string;
  description: string | null;
  urgency: TicketUrgency;
  latitude: number | null;
  longitude: number | null;
  ward_location: string;
  /** Null until the desk has reviewed it — unreviewed photos are not published. */
  image_url: string | null;
  /** True while the photo is withheld pending review. */
  photo_pending: boolean;
  status: TicketStatus;
  upvote_count: number;
  user_name: string | null;
}

/** A possible duplicate, returned by `find_duplicate_ticket()`. */
export interface DuplicateMatch {
  id: string;
  ticket_number: string;
  category: string;
  description: string | null;
  ward_location: string;
  image_url: string;
  status: TicketStatus;
  created_at: string;
  upvote_count: number;
  user_name: string | null;
  /** Metres from where the new photo was taken. */
  distance_m: number;
}

// --------------------------------------------------------------- Pulse Points

/** What one approved campus report is worth. Mirrors the trigger in 0008. */
export const POINTS_PER_REPORT = 5;

/** One row of the append-only points ledger. Positive earns, negative spends. */
export interface PulsePointEvent {
  id: string;
  created_at: string;
  user_phone: string;
  ticket_id: string | null;
  delta: number;
  reason: string;
}

export interface Reward {
  key: string;
  title: string;
  description: string | null;
  cost: number;
  active: boolean;
  sort: number;
}

export interface Redemption {
  id: string;
  created_at: string;
  user_phone: string;
  reward_key: string;
  cost: number;
  /** Null while the code pool for that reward is empty. */
  code: string | null;
  status: 'Pending' | 'Issued';
}

/** What `redeem_reward()` hands back. */
export interface RedemptionResult {
  status: 'Pending' | 'Issued';
  code: string | null;
  title: string;
  spent: number;
  balance: number;
}

/** Identity carried on the JWT's `user_metadata`, written at sign-up. */
export interface CitizenProfile {
  full_name: string;
  phone: string;
}
