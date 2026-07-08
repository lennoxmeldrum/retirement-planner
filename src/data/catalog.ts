import { CostCategory } from '../types';

// The shared catalog of cost-of-living inputs. Every region provides local
// prices for these item/option ids (null = not applicable there). Regions can
// also override the flavour text per option (brand names etc.) via itemNotes.
export const CATALOG: CostCategory[] = [
  {
    id: 'housing',
    label: 'Housing & utilities',
    icon: '🏠',
    description:
      'Rent comes from the map panel. Everything else it takes to run the home lives here.',
    items: [
      {
        id: 'utilities-energy',
        label: 'Electricity & gas',
        description: 'Includes heating in Canada and near-constant air-con in Thailand/QLD at the higher levels.',
        mode: 'choice',
        options: [
          { id: 'low', label: 'Frugal', note: 'Small home, careful usage, minimal heating/cooling' },
          { id: 'typical', label: 'Typical couple', note: 'Average consumption for a 2-3br home' },
          { id: 'high', label: 'Large home / heavy climate control', note: 'Big house, pool pump, constant A/C or winter heating' },
        ],
      },
      {
        id: 'utilities-water',
        label: 'Water & sewerage',
        mode: 'choice',
        options: [
          { id: 'low', label: 'Apartment / included', note: 'Often partly covered by body corporate or landlord' },
          { id: 'typical', label: 'Typical house' },
          { id: 'high', label: 'Garden & pool' },
        ],
      },
      {
        id: 'contents-insurance',
        label: 'Contents / renter insurance',
        mode: 'choice',
        options: [
          { id: 'none', label: 'None' },
          { id: 'basic', label: 'Basic contents' },
          { id: 'full', label: 'Comprehensive + valuables' },
        ],
      },
      {
        id: 'household-help',
        label: 'Cleaner / household help',
        description: 'Dramatically cheaper in Thailand — many retirees have weekly or live-out daily help.',
        mode: 'choice',
        options: [
          { id: 'none', label: 'None' },
          { id: 'fortnightly', label: 'Fortnightly cleaner' },
          { id: 'weekly', label: 'Weekly cleaner' },
          { id: 'full', label: 'Housekeeper + gardener', note: 'Several days per week' },
        ],
      },
    ],
  },
  {
    id: 'connectivity',
    label: 'Internet, mobile & media',
    icon: '📡',
    description: 'Home internet at different speed tiers, mobile plans and streaming stacks.',
    items: [
      {
        id: 'internet',
        label: 'Home internet',
        mode: 'choice',
        options: [
          { id: 'basic', label: 'Basic (~50 Mbps)', note: 'Fine for browsing and video calls' },
          { id: 'fast', label: 'Fast (100–300 Mbps)', note: 'The mainstream plan most households pick' },
          { id: 'gigabit', label: 'Gigabit fibre', note: 'Top consumer tier' },
        ],
      },
      {
        id: 'mobile',
        label: 'Mobile plan',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'prepaid', label: 'Light prepaid', note: 'Small data bundle' },
          { id: 'mid', label: 'Mid postpaid', note: '20–50GB with calls' },
          { id: 'unlimited', label: 'Unlimited premium', note: 'Max data, roaming extras' },
        ],
      },
      {
        id: 'streaming',
        label: 'Streaming & subscriptions',
        mode: 'choice',
        options: [
          { id: 'none', label: 'None / free TV' },
          { id: 'couple', label: '2–3 services', note: 'e.g. Netflix + one local platform + music' },
          { id: 'full', label: 'Full stack + sport', note: 'All majors plus a sports package' },
        ],
      },
    ],
  },
  {
    id: 'food',
    label: 'Food & groceries',
    icon: '🛒',
    description: 'Broad bands that cut across brands — each region lists its own chains per tier.',
    items: [
      {
        id: 'groceries',
        label: 'Grocery shop',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'budget', label: 'Budget chains & markets' },
          { id: 'mainstream', label: 'Mainstream supermarkets' },
          { id: 'premium', label: 'Premium / organic / imported' },
        ],
      },
      {
        id: 'dining-casual',
        label: 'Casual eating out',
        description: 'Cafés, food courts, street food, pub meals.',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'rare', label: 'Rarely (1–2× month)' },
          { id: 'weekly', label: 'Weekly' },
          { id: 'often', label: '3–4× per week' },
          { id: 'daily', label: 'Most days', note: 'Very common for Thailand retirees — street food is cheaper than cooking' },
        ],
      },
      {
        id: 'dining-fine',
        label: 'Fine dining',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'never', label: 'Never' },
          { id: 'monthly', label: 'Monthly treat' },
          { id: 'weekly', label: 'Weekly' },
        ],
      },
      {
        id: 'coffee',
        label: 'Takeaway coffee habit',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'none', label: 'Home brew only' },
          { id: 'few', label: 'A few per week' },
          { id: 'daily', label: 'Daily café coffee' },
        ],
      },
      {
        id: 'alcohol',
        label: 'Alcohol',
        description: 'Note: alcohol is heavily taxed in Thailand — wine especially costs 2–3× Australian prices.',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'none', label: 'None' },
          { id: 'moderate', label: 'Moderate', note: 'A few drinks a week, mostly at home' },
          { id: 'social', label: 'Social', note: 'Regular bars/restaurants plus home' },
        ],
      },
    ],
  },
  {
    id: 'transport',
    label: 'Transport',
    icon: '🚗',
    description:
      'Vehicle options are all-in monthly costs: depreciation (5yr ownership), insurance, registration, fuel and servicing.',
    items: [
      {
        id: 'vehicle',
        label: 'Primary vehicle',
        mode: 'choice',
        options: [
          { id: 'none', label: 'No vehicle' },
          { id: 'bicycle', label: 'Bicycle / e-bike', note: 'Purchase amortised + maintenance' },
          { id: 'scooter', label: 'Scooter / motorbike', note: 'The default in Thailand' },
          { id: 'used-economy', label: 'Used economy car', note: '~5-year-old hatch/sedan' },
          { id: 'new-economy', label: 'New economy car', note: 'e.g. Corolla / Civic / Yaris Cross class' },
          { id: 'new-mid', label: 'New mid-size SUV', note: 'e.g. RAV4 / CR-V class' },
          { id: 'new-luxury', label: 'New luxury vehicle', note: 'European badge or large premium SUV' },
        ],
      },
      {
        id: 'vehicle-second',
        label: 'Second vehicle',
        mode: 'choice',
        options: [
          { id: 'none', label: 'None' },
          { id: 'bicycle', label: 'Bicycle / e-bike' },
          { id: 'scooter', label: 'Scooter / motorbike' },
          { id: 'used-economy', label: 'Used economy car' },
        ],
      },
      {
        id: 'public-transport',
        label: 'Public transport',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'none', label: 'Never' },
          { id: 'occasional', label: 'Occasional', note: 'A few trips a week' },
          { id: 'regular', label: 'Regular', note: 'Primary way of getting around' },
        ],
      },
      {
        id: 'rideshare',
        label: 'Taxis & rideshare',
        mode: 'choice',
        options: [
          { id: 'none', label: 'Never' },
          { id: 'occasional', label: 'Occasional', note: 'Airport runs, nights out' },
          { id: 'frequent', label: 'Frequent', note: 'Grab/Uber as the main transport mode' },
        ],
      },
    ],
  },
  {
    id: 'health',
    label: 'Health & insurance',
    icon: '🏥',
    description: 'The biggest structural difference between the three regions. Priced for a ~65-year-old.',
    items: [
      {
        id: 'health-insurance',
        label: 'Health insurance',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'public', label: 'Public system only', note: 'Where you are eligible (Medicare / OHIP)' },
          { id: 'basic', label: 'Basic private / local insurer' },
          { id: 'mid', label: 'Mid-tier hospital + extras' },
          { id: 'top', label: 'Top international cover' },
        ],
      },
      {
        id: 'medical-oop',
        label: 'Out-of-pocket medical',
        description: 'GP visits, specialists, prescriptions beyond what insurance covers.',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'low', label: 'Low', note: 'Healthy, few prescriptions' },
          { id: 'typical', label: 'Typical for 60s' },
          { id: 'high', label: 'High', note: 'Chronic conditions, regular specialists' },
        ],
      },
      {
        id: 'dental-optical',
        label: 'Dental & optical',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'minimal', label: 'Check-ups only' },
          { id: 'typical', label: 'Typical', note: 'Cleans, glasses, occasional filling/crown' },
          { id: 'extensive', label: 'Extensive', note: 'Major dental work, premium frames' },
        ],
      },
    ],
  },
  {
    id: 'taxes-visas',
    label: 'Taxes, visas & fees',
    icon: '🛂',
    description:
      'Effective annual costs converted to monthly. Tax figures are indicative for retirees drawing pension/investment income — see the region notes.',
    items: [
      {
        id: 'visa',
        label: 'Visa / residency status',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'citizen', label: 'Citizen / permanent resident', note: 'No visa costs' },
          { id: 'retirement', label: 'Retirement visa (standard)', note: 'e.g. Thai Non-O/O-A route: extensions, re-entry permits, agent fees, 90-day reporting' },
          { id: 'premium', label: 'Long-term premium visa', note: 'e.g. Thai LTR (10yr) or O-X — higher upfront, amortised here' },
        ],
      },
      {
        id: 'income-tax',
        label: 'Income tax on retirement income',
        description: 'Effective tax at three income levels for a retired couple. Assumptions in the region tax note.',
        mode: 'choice',
        options: [
          { id: 'modest', label: 'Modest income (~US$40k/yr)' },
          { id: 'comfortable', label: 'Comfortable (~US$70k/yr)' },
          { id: 'affluent', label: 'Affluent (~US$120k/yr)' },
        ],
      },
      {
        id: 'banking-fx',
        label: 'Banking, FX & admin fees',
        mode: 'choice',
        options: [
          { id: 'low', label: 'Local income, simple affairs' },
          { id: 'typical', label: 'Regular international transfers' },
          { id: 'high', label: 'Complex: accountant + cross-border advice' },
        ],
      },
    ],
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle & recreation',
    icon: '🎾',
    description: 'Day-to-day recreation. The big-ticket "luxury" items live in the next category.',
    items: [
      {
        id: 'gym',
        label: 'Gym / fitness',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'none', label: 'None / free outdoors' },
          { id: 'standard', label: 'Standard gym' },
          { id: 'premium', label: 'Premium club + classes', note: 'Pool, classes, tennis etc.' },
        ],
      },
      {
        id: 'hobbies',
        label: 'Hobbies & clubs',
        mode: 'choice',
        options: [
          { id: 'low', label: 'Low-cost', note: 'Walking groups, libraries, community clubs' },
          { id: 'moderate', label: 'Moderate', note: 'A paid hobby or two, club memberships' },
          { id: 'enthusiast', label: 'Enthusiast', note: 'Golf membership, boating, serious kit' },
        ],
      },
      {
        id: 'entertainment',
        label: 'Local entertainment',
        description: 'Cinema, casual shows, museums, day trips.',
        mode: 'choice',
        options: [
          { id: 'low', label: 'Occasional' },
          { id: 'mid', label: 'Regular' },
          { id: 'high', label: 'Frequent' },
        ],
      },
      {
        id: 'pets',
        label: 'Pets',
        mode: 'choice',
        options: [
          { id: 'none', label: 'None' },
          { id: 'cat', label: 'Cat', note: 'Food, vet, insurance' },
          { id: 'small-dog', label: 'Small dog' },
          { id: 'large-dog', label: 'Large dog' },
        ],
      },
      {
        id: 'clothing',
        label: 'Clothing & personal care',
        mode: 'choice',
        perPerson: true,
        options: [
          { id: 'modest', label: 'Modest' },
          { id: 'typical', label: 'Typical' },
          { id: 'premium', label: 'Premium', note: 'Brands, salon, skincare' },
        ],
      },
      {
        id: 'gifts',
        label: 'Gifts, family & misc',
        mode: 'choice',
        options: [
          { id: 'low', label: 'Low' },
          { id: 'typical', label: 'Typical', note: 'Grandkids, birthdays, charity' },
          { id: 'generous', label: 'Generous' },
        ],
      },
    ],
  },
  {
    id: 'luxury',
    label: 'Travel & luxury',
    icon: '✈️',
    description:
      'Per-event / per-trip items. Pick the tier, then how many per year — costs are annualised into the monthly total.',
    items: [
      {
        id: 'concerts',
        label: 'Concerts & major events',
        mode: 'quantity',
        qtyLabel: 'events per year',
        maxQty: 24,
        perPerson: true,
        options: [
          { id: 'local', label: 'Local gigs / theatre', note: 'Per ticket' },
          { id: 'arena', label: 'Arena / stadium act', note: 'Per ticket, mid seating' },
          { id: 'vip', label: 'Premium / VIP package', note: 'Per ticket' },
        ],
      },
      {
        id: 'domestic-travel',
        label: 'Domestic / regional trips',
        mode: 'quantity',
        qtyLabel: 'trips per year',
        maxQty: 12,
        options: [
          { id: 'roadtrip', label: 'Weekend road trip', note: 'Per trip for two: 2–3 nights, modest motel' },
          { id: 'resort', label: 'Week at a resort', note: 'Per trip for two, domestic flights/drive' },
          { id: 'luxury', label: 'Luxury week away', note: 'Per trip for two: 5-star, premium touring' },
        ],
      },
      {
        id: 'intl-flights',
        label: 'International trips',
        mode: 'quantity',
        qtyLabel: 'trips per year',
        maxQty: 8,
        perPerson: true,
        options: [
          { id: 'economy', label: 'Long-haul economy', note: 'Per person per trip incl. 2 weeks mid-range costs' },
          { id: 'premium', label: 'Premium economy', note: 'Per person per trip incl. 2 weeks good hotels' },
          { id: 'business', label: 'Business class', note: 'Per person per trip incl. 2 weeks premium hotels' },
        ],
      },
      {
        id: 'cruise',
        label: 'Cruises',
        mode: 'quantity',
        qtyLabel: 'cruises per year',
        maxQty: 4,
        options: [
          { id: 'short', label: 'Short cruise (3–5 nights)', note: 'Per cruise for two, inside/oceanview' },
          { id: 'standard', label: '10–14 night cruise', note: 'Per cruise for two, balcony' },
          { id: 'luxury', label: 'Luxury line', note: 'Per cruise for two, suites / premium line' },
        ],
      },
    ],
  },
];

export const ALL_ITEMS = CATALOG.flatMap((c) => c.items);
export const ITEM_BY_ID = new Map(ALL_ITEMS.map((i) => [i.id, i]));
export function categoryOfItem(itemId: string): CostCategory | undefined {
  return CATALOG.find((c) => c.items.some((i) => i.id === itemId));
}
