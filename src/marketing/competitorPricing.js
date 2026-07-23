// Competitor list pricing for the comparison band. These go stale fast —
// re-verify against each vendor's public pricing page and bump `lastVerified`.
//
// Model (see footnote shown in the UI): a multi-business operator needs one
// separate account per business on tools that have no multi-business option,
// so cost = (flat-per-account + per-seat × users) × businesses.
//
// Cross-check at the default (4 businesses × 10 users):
//   Jobber    (299 + 0)     × 4 = $1,196
//   Pipedrive (0 + 39×10)   × 4 = $1,560
//   Bonsai    (0 + 39×10)   × 4 = $1,560
//   HubSpot   (0 + 90×10)   × 4 = $3,600

export const COMPETITOR_PRICING = {
  lastVerified: 'July 2026',
  footnote:
    'Competitor figures are published list pricing multiplied by the number of separate accounts required, since most have no multi-business option. Verified July 2026.',
  competitors: [
    {
      key: 'jobber',
      name: 'Jobber',
      flatPerBusiness: 299,
      perUserPerBusiness: 0,
      note: 'Grow tier list price, billed per separate account.',
    },
    {
      key: 'pipedrive',
      name: 'Pipedrive',
      flatPerBusiness: 0,
      perUserPerBusiness: 39,
      note: 'Professional per-seat, per separate account.',
    },
    {
      key: 'bonsai',
      name: 'Bonsai',
      flatPerBusiness: 0,
      perUserPerBusiness: 39,
      note: 'Business per-seat, per separate account.',
    },
    {
      key: 'hubspot',
      name: 'HubSpot',
      flatPerBusiness: 0,
      perUserPerBusiness: 90,
      note: 'Sales Hub Professional per-seat, per separate account.',
    },
  ],
}

export function competitorCost(c, businesses, users) {
  return (c.flatPerBusiness + c.perUserPerBusiness * users) * businesses
}
