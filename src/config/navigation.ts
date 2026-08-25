/**
 * One nav tree, rendered two ways. `Header` reads it for the simple desktop
 * nav today; `MegaMenu` and `MobileNav` read the same tree in Phase 4, so the
 * upgrade is additive rather than a rewrite.
 */

export interface NavLink {
  label: string;
  href: string;
  description?: string;
  /** astro-icon name, e.g. 'lucide:wrench'. */
  icon?: string;
}

export interface MegaColumn {
  heading?: string;
  links: NavLink[];
}

export interface MegaPanel {
  kind: 'mega';
  columns: MegaColumn[];
  featured?: {
    title: string;
    body: string;
    href: string;
    cta: string;
  };
}

export interface LinkListPanel {
  kind: 'links';
  links: NavLink[];
}

export interface NavItem {
  label: string;
  /** Present when the top-level item is itself a destination. */
  href?: string;
  panel?: MegaPanel | LinkListPanel;
}

export interface NavigationConfig {
  primary: NavItem[];
  /** Right-hand call to action in the header. */
  cta?: { label: string; href: string };
  footer: { heading: string; links: NavLink[] }[];
  legal: NavLink[];
}

export const navigation: NavigationConfig = {
  primary: [
    { label: 'Home', href: '/' },
    {
      label: 'Treatments',
      href: '/services/',
      panel: {
        kind: 'mega',
        columns: [
          {
            heading: 'Braces',
            links: [
              { label: 'Types of Braces', href: '/types-of-braces/' },
              { label: 'Adult Braces', href: '/braces-for-adults/' },
              { label: 'Teen Braces', href: '/braces-for-teens/' },
              { label: 'Children Braces', href: '/braces-for-children/' },
            ],
          },
          {
            heading: 'Invisalign',
            links: [
              { label: 'How Invisalign Works', href: '/types-of-invisalign/' },
              { label: 'Adult Invisalign', href: '/invisalign-for-adults/' },
              { label: 'Teen Invisalign', href: '/invisalign-for-teens/' },
              { label: 'Children Invisalign', href: '/invisalign-for-children/' },
            ],
          },
          {
            heading: 'More Options',
            links: [
              { label: 'Retainers', href: '/retainers/' },
              { label: 'Teeth Whitening', href: '/teeth-whitening/' },
              { label: 'Dental Pain Eraser', href: '/dental-pain-eraser/' },
              { label: 'Carrier Motion', href: '/carrier-motion/' },
              { label: 'Virtual Care', href: '/virtual-care/' },
            ],
          },
        ],
        // featured section removed for links panel
      },
    },
    {
      label: 'About',
      panel: {
        kind: 'links',
        links: [
          { label: 'Our Story', href: '/about/' },
          { label: 'Why Choose Us', href: '/about/what-sets-us-apart/' },
          { label: 'Our Foundation', href: '/about/foundation/' },
          { label: 'Meet the Doctors', href: '/about/our-doctors/' },
          { label: 'Meet Dr. Moray', href: '/about/dr-moray/' },
        ],
      },
    },
    {
      label: 'Resources',
      href: '/resources/',
      panel: {
        kind: 'mega',
        columns: [
          {
            heading: 'Patient Resources',
            links: [
              { label: 'Insurance & Financing Info', href: '/insurance/' },
              { label: 'Orthodontic FAQs', href: '/faqs/' },
              { label: 'Patient Portal', href: '/patient-portal/' },
              { label: 'Office Policies', href: '/office-policies/' },
              { label: 'Orthodontic Emergencies', href: '/orthodontic-emergencies/' },
            ],
          },
          {
            heading: 'New Patient Info',
            links: [
              { label: 'New Patient Info', href: '/patient/' },
              { label: 'Your First Visit', href: '/your-first-visit/' },
              { label: 'Special Offers', href: '/special-offers/' },
            ],
          },
          {
            heading: 'Contact Us',
            links: [
              { label: 'Contact', href: '/contact/' },
              { label: 'Locations', href: '/locations/' },
              { label: 'Careers', href: '/careers/' },
            ]
          }
        ],
      },
    },
  ],

  cta: { label: 'Book Appointment', href: '/book-appointment/' },

  footer: [
    {
      heading: 'Services',
      links: [
        { label: 'Repairs & Maintenance', href: '/services/repairs/' },
        { label: 'Installations', href: '/services/installations/' },
        { label: 'Service Contracts', href: '/services/contracts/' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', href: '/about/' },
        { label: 'Contact', href: '/contact/' },
      ],
    },
  ],

  legal: [
    { label: 'Privacy Policy', href: '/privacy/' },
    { label: 'Terms of Service', href: '/terms/' },
  ],
};
