import {
  candidatesFor,
  cityFromCoordinates,
  handlesCategory,
  routeComplaint,
  type RoutingInput,
} from './jurisdiction';

/**
 * Routing decides which government body a citizen's complaint reaches. Getting
 * it wrong does not throw or fail a build — it quietly sends someone to a
 * portal that cannot help them, and they find out by being ignored.
 *
 * These cases pin the rules that are genuinely decisions rather than lookups:
 * subject beating territory, the Delhi zone boxes, and what happens in a city
 * we have no local body for.
 */

function input(overrides: Partial<RoutingInput> = {}): RoutingInput {
  return {
    category: 'Potholes',
    city: 'New Delhi',
    // Rajouri Garden: ordinary MCD territory, outside both zone boxes.
    latitude: 28.647,
    longitude: 77.1195,
    description: null,
    wardLocation: 'New Delhi',
    ...overrides,
  };
}

describe('routeComplaint — Delhi', () => {
  it('sends ordinary Delhi complaints to MCD', () => {
    expect(routeComplaint(input()).jurisdiction).toBe('MCD');
    expect(routeComplaint(input({ category: 'Waste' })).jurisdiction).toBe('MCD');
  });

  it('sends water anywhere in Delhi to the Jal Board, zone regardless', () => {
    // The point of this rule: subject beats territory. A leak in Lutyens'
    // Delhi is still DJB's, even though a pothole at the same spot is NDMC's.
    const lutyens = { latitude: 28.6129, longitude: 77.2295 };

    expect(routeComplaint(input({ category: 'Water Leakage' })).jurisdiction).toBe('DJB');
    expect(
      routeComplaint(input({ category: 'Water Leakage', ...lutyens })).jurisdiction,
    ).toBe('DJB');
  });

  it('routes the NDMC zone away from MCD', () => {
    // India Gate — inside the NDMC box.
    const decision = routeComplaint(input({ latitude: 28.6129, longitude: 77.2295 }));

    expect(decision.jurisdiction).toBe('NDMC');
    // A rectangle standing in for a real boundary should not claim certainty.
    expect(decision.confident).toBe(false);
  });

  it('routes Delhi Cantonment to its own board', () => {
    expect(routeComplaint(input({ latitude: 28.5905, longitude: 77.14 })).jurisdiction).toBe(
      'CANTT',
    );
  });

  it('sends arterial-road potholes to PWD but leaves local streets with MCD', () => {
    const arterial = input({ description: 'Deep pothole on the Outer Ring Road near the flyover.' });
    const local = input({ description: 'Deep pothole outside the market gate.' });

    expect(routeComplaint(arterial).jurisdiction).toBe('PWD');
    expect(routeComplaint(local).jurisdiction).toBe('MCD');
  });

  it('does not divert non-pothole categories on an arterial road', () => {
    // PWD maintains the road surface, not the bins beside it.
    const decision = routeComplaint(
      input({ category: 'Waste', description: 'Garbage dumped beside the Ring Road.' }),
    );

    expect(decision.jurisdiction).toBe('MCD');
  });
});

/** Real city-centre fixes, so the coordinate rule resolves the right city. */
const CENTRES = {
  Mumbai: { latitude: 19.076, longitude: 72.8777 },
  Bengaluru: { latitude: 12.9716, longitude: 77.5946 },
  Chennai: { latitude: 13.0827, longitude: 80.2707 },
  Pune: { latitude: 18.5204, longitude: 73.8567 },
  // Well east of the Delhi extent, and no local body listed for it.
  Meerut: { latitude: 28.9845, longitude: 77.7064 },
};

describe('routeComplaint — outside Delhi', () => {
  it('uses the local body where one is listed', () => {
    const cases: [keyof typeof CENTRES, string][] = [
      ['Mumbai', 'BMC'],
      ['Bengaluru', 'BBMP'],
      ['Chennai', 'GCC'],
      ['Pune', 'PMC'],
    ];

    for (const [city, jurisdiction] of cases) {
      const decision = routeComplaint(input({ city, wardLocation: city, ...CENTRES[city] }));
      expect(decision.jurisdiction).toBe(jurisdiction);
    }
  });

  it('falls back to CPGRAMS for a city with no local body', () => {
    const decision = routeComplaint(
      input({ city: 'Meerut', wardLocation: 'Meerut', ...CENTRES.Meerut }),
    );

    expect(decision.jurisdiction).toBe('CPGRAMS');
    expect(decision.confident).toBe(false);
    expect(decision.reason).toContain('Meerut');
  });

  it('still routes somewhere when the city is unknown', () => {
    // A report must never reach a dead end: CPGRAMS covers every department.
    const decision = routeComplaint(
      input({ city: null, wardLocation: '', latitude: null, longitude: null }),
    );

    expect(decision.jurisdiction).toBe('CPGRAMS');
  });

  it('does not apply Delhi subject rules elsewhere', () => {
    // Water is DJB's in Delhi only. In Mumbai it is the corporation's, and
    // routing it to a Delhi board would be worse than useless.
    const decision = routeComplaint(
      input({
        city: 'Mumbai',
        wardLocation: 'Mumbai',
        category: 'Water Leakage',
        ...CENTRES.Mumbai,
      }),
    );

    expect(decision.jurisdiction).toBe('BMC');
  });
});

describe('routeComplaint — coordinates outrank the ward text', () => {
  it('routes a free-text Delhi ward to MCD rather than the national portal', () => {
    // The case this rule exists for: the full report form takes any text, so
    // "Ward 12, Rajouri Garden" names no city the directory knows. Before the
    // coordinate test this fell through to CPGRAMS.
    const decision = routeComplaint(
      input({ city: 'Ward 12, Rajouri Garden', wardLocation: 'Ward 12, Rajouri Garden' }),
    );

    expect(decision.jurisdiction).toBe('MCD');
  });

  it('believes the fix over a mistyped city', () => {
    const decision = routeComplaint(
      input({ city: 'Mumbai', wardLocation: 'Mumbai', latitude: 28.647, longitude: 77.1195 }),
    );

    expect(decision.jurisdiction).toBe('MCD');
  });
});

describe('cityFromCoordinates', () => {
  it('recognises each city it has a body for', () => {
    expect(cityFromCoordinates(28.647, 77.1195)).toBe('New Delhi');
    expect(cityFromCoordinates(CENTRES.Mumbai.latitude, CENTRES.Mumbai.longitude)).toBe('Mumbai');
    expect(cityFromCoordinates(CENTRES.Pune.latitude, CENTRES.Pune.longitude)).toBe('Pune');
  });

  it('returns null outside them rather than snapping to the nearest', () => {
    expect(cityFromCoordinates(CENTRES.Meerut.latitude, CENTRES.Meerut.longitude)).toBeNull();
    expect(cityFromCoordinates(null, null)).toBeNull();
  });
});

describe('routeComplaint — without coordinates', () => {
  it('falls back to the named city rather than guessing a zone', () => {
    const decision = routeComplaint(input({ latitude: null, longitude: null }));

    expect(decision.jurisdiction).toBe('MCD');
  });
});

describe('candidatesFor — the "wrong department?" list', () => {
  it('offers the other Delhi bodies for a Delhi pothole', () => {
    const codes = candidatesFor(input());

    expect(codes[0]).toBe('MCD');
    expect(codes).toContain('NDMC');
    expect(codes).toContain('PWD');
    expect(codes).toContain('CANTT');
  });

  it('leaves out bodies that cannot act on the category', () => {
    // The Jal Board does not fill potholes. Listing it would invite a citizen
    // to send a complaint somewhere guaranteed to ignore it.
    expect(candidatesFor(input())).not.toContain('DJB');

    // And the reverse: PWD maintains roads, not pipes.
    const water = candidatesFor(input({ category: 'Water Leakage' }));
    expect(water[0]).toBe('DJB');
    expect(water).not.toContain('PWD');
  });

  it('never offers a Delhi body outside Delhi', () => {
    const codes = candidatesFor(
      input({ city: 'Pune', wardLocation: 'Pune', latitude: 18.5204, longitude: 73.8567 }),
    );

    expect(codes).toEqual(['PMC', 'CPGRAMS']);
  });

  it('always ends somewhere real', () => {
    // Whatever the citizen disagrees with, CPGRAMS is still on the list.
    const cases = [
      input(),
      input({ category: 'Water Leakage' }),
      input({ city: 'Meerut', wardLocation: 'Meerut', latitude: 28.9845, longitude: 77.7064 }),
      input({ city: null, wardLocation: '', latitude: null, longitude: null }),
    ];

    for (const one of cases) {
      expect(candidatesFor(one)).toContain('CPGRAMS');
    }
  });

  it('lists no duplicates', () => {
    for (const category of ['Potholes', 'Waste', 'Water Leakage', 'Other']) {
      const codes = candidatesFor(input({ category }));
      expect(codes.length).toBe(new Set(codes).size);
    }
  });
});

describe('handlesCategory', () => {
  it('keeps the two narrow bodies narrow', () => {
    expect(handlesCategory('DJB', 'Water Leakage')).toBe(true);
    expect(handlesCategory('DJB', 'Potholes')).toBe(false);

    expect(handlesCategory('PWD', 'Potholes')).toBe(true);
    expect(handlesCategory('PWD', 'Waste')).toBe(false);
  });

  it('lets the general-purpose corporations take anything', () => {
    for (const category of ['Potholes', 'Waste', 'Water Leakage', 'Broken Streetlight', 'Other']) {
      expect(handlesCategory('MCD', category)).toBe(true);
      expect(handlesCategory('CPGRAMS', category)).toBe(true);
    }
  });
});
