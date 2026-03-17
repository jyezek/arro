// Arro design tokens — matches DESIGN.md exactly

export const Colors = {
  // Brand
  orange:      '#E8650A',
  orangeLight: '#FDF1E8',
  orangeDim:   '#7A3005',

  // Neutrals
  dark:   '#0F0D0B',   // app background — matches site --dk
  dark2:  '#1A1410',   // elevated surface / interview bg
  dark3:  '#1E1A16',   // card surface on interview bg
  warm:   '#F5F0EA',
  warm2:  '#EDE8E0',
  white:  '#FFFFFF',

  // Semantic
  green:     '#5DCAA5',
  greenBg:   'rgba(93,202,165,0.1)',
  greenText: '#085041',
  blue:      '#378ADD',
  blueBg:    'rgba(55,138,221,0.1)',
  blueText:  '#0C447C',
  amber:     '#EF9F27',
  amberBg:   'rgba(239,158,39,0.1)',
  amberText: '#633806',
  red:       '#E24B4A',
  redBg:     'rgba(226,75,74,0.05)',
  redText:   '#791F1F',

  // Interview dark mode
  interview: {
    bg:            '#1A1410',
    surface:       '#1E1A16',
    textPrimary:   'rgba(245,240,234,0.85)',
    textSecondary: 'rgba(245,240,234,0.45)',
    textTertiary:  'rgba(245,240,234,0.25)',
    border:        'rgba(245,240,234,0.07)',
  },
} as const

// Typography scale (px equivalent)
export const FontSize = {
  xs:    10,
  sm:    11,
  base:  12,
  md:    13,
  lg:    14,
  xl:    15,
  '2xl': 17,
  '3xl': 20,
  hero:  22,
} as const

// Spacing
export const Spacing = {
  1: 4,
  2: 6,
  3: 8,
  4: 10,
  5: 12,
  6: 14,
  7: 16,
  8: 20,
  9: 24,
} as const

// Border radius
export const Radius = {
  pill:     6,
  chip:     7,
  input:    8,
  icon:     9,
  inputLg:  11,
  template: 12,
  cue:      13,
  stat:     14,
  card:     16,
  section:  18,
  artifact: 20,
  sheet:    24,
  logo:     28,
  tabBar:   48,
} as const

// Credit cost constants — mirrors PAYMENTS.md
export const CreditCosts = {
  practice_interview: 20,
  deep_dive_per_role: 10,
  full_prep_kit:      15,
  tailored_resume:     5,
  company_overview:    3,
  copilot_message:     1,
  ai_bullet_batch:     3,
} as const

// Flat-rate features (free for Pro users)
export const FLAT_RATE_FEATURES = [
  'tailored_resume',
  'full_prep_kit',
  'company_overview',
] as const

// Alpha helpers
export const darkAlpha   = (o: number) => `rgba(26,20,16,${o})`
export const whiteAlpha  = (o: number) => `rgba(255,255,255,${o})`
export const orangeAlpha = (o: number) => `rgba(232,101,10,${o})`
// Warm-white alpha — matches --wm rgba in the brand HTML (rgba 245,240,234)
// Use these for text, borders, and surfaces on dark backgrounds
export const wm = (o: number) => `rgba(245,240,234,${o})`
