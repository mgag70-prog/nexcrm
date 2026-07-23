// Single source of truth for HQOps plan pricing.
// Phase 2 (Stripe self-serve billing) will read these same figures when wiring
// checkout — keep prices here, not scattered through components.

export const TRIAL_DAYS = 14
export const FAIR_USE_USERS = 25

export const PLANS = [
  {
    key: 'solo',
    name: 'Solo',
    monthly: 59,
    annual: 49,
    workspaces: '1 workspace',
    tagline: 'One business, run properly.',
    features: [
      '1 workspace',
      'Unlimited users',
      'Full CRM — contacts, companies, pipeline',
      'Quotes, invoicing & e-signature',
      'Branded client portal',
      'Time tracking & scheduling',
    ],
  },
  {
    key: 'studio',
    name: 'Studio',
    monthly: 159,
    annual: 129,
    workspaces: '3 workspaces',
    popular: true,
    tagline: 'A small portfolio of businesses.',
    features: [
      '3 workspaces',
      'Unlimited users',
      'Everything in Solo',
      'Cross-workspace reporting',
      'Workflow automation',
      'Web-to-lead forms',
    ],
  },
  {
    key: 'portfolio',
    name: 'Portfolio',
    monthly: 299,
    annual: 249,
    workspaces: 'Unlimited workspaces',
    tagline: 'Every business you run.',
    features: [
      'Unlimited workspaces',
      'Unlimited users',
      'Everything in Studio',
      'Deal health & forecasting',
      'Priority support',
      'Full data export',
    ],
  },
]

// Field Service is shown as a capability but sold "Contact us" only — the
// crew-restricted Field role doesn't exist yet, so a self-serve crew add-on
// would expose every deal, invoice, and margin to the whole crew.
export const FIELD_SERVICE = {
  name: 'Field Service',
  priceNote: '+$49/mo per workspace',
  tagline: 'Crews, dispatch, and job costing.',
  features: [
    'GPS time clock',
    'Crew management & dispatch',
    'Job costing & live margins',
    'Mobile field view',
  ],
  cta: 'Contact us',
}

// HQOps monthly-equivalent cost for the comparison band, by workspace count.
// Unlimited users on every plan — the user count never changes this.
export function hqopsCost(businesses, billing = 'annual') {
  const plan = businesses <= 1 ? PLANS[0] : businesses <= 3 ? PLANS[1] : PLANS[2]
  return billing === 'annual' ? plan.annual : plan.monthly
}

export function hqopsPlanName(businesses) {
  return businesses <= 1 ? 'Solo' : businesses <= 3 ? 'Studio' : 'Portfolio'
}
