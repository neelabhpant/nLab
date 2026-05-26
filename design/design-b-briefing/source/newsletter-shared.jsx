// newsletter-shared.jsx
// Issue 01 content + Cloudera wordmark + hero placeholder. Both directions
// pull from here so copy stays in lockstep across the two designs.

// ───────────────────────────── ISSUE 01 ─────────────────────────────
const RR_AUTHOR = {
  name: 'Neelabh Pant',
  title: 'Director, Global AI Industry Solutions, Retail',
  org:   'Cloudera',
  email: 'neelabh.pant@cloudera.com',
  bookingUrl: '#book-30-min',
  linkedinUrl: '#linkedin',
};

const RR_ISSUE = {
  number: '01',
  date:   'June 16, 2026',
  cadence:'Bi-weekly',
  read:   '6 min read',
  title:  'The AI cost crisis hits retail next.',
  kicker: 'The cost wall',
  subhead:'Uber burned $3.4 billion. Microsoft killed Claude Code. The retail wall is closer than it looks, and the fix is portfolio engineering, not bigger budgets.',
  editorsNote:
    "Two stories from last week keep nagging at me. Uber disclosed $3.4 billion of AI spend in its filings and quietly walked back its self-driving ambitions. Microsoft cancelled Claude Code, citing margin pressure on a product that was, by every external measure, working. Two very different companies, one identical lesson. The cost of running AI at scale has finally caught up to the enthusiasm of building it. Retail is the next industry to feel it, and most of us are not ready. This issue is about why portfolio engineering, not bigger budgets, is the answer.",
};

const RR_FEATURE = {
  sections: [
    {
      h: 'Two signals from last week',
      p: "Uber disclosed roughly $3.4 billion of AI spend across the past four reporting periods, then softened its self-driving language on the same call. Microsoft, in a separate move that got less coverage, sunset Claude Code from its commercial roadmap. The product was not failing. The math was. Both companies were running production AI at the scale most retailers will reach inside eighteen months, and both decided the unit economics no longer made sense.",
    },
    {
      h: 'Why retail is next',
      p: "Retail margins are thinner than tech margins by an order of magnitude. A 2 percent operating margin does not absorb an unbudgeted assistant the way a 25 percent margin does. Retail demand is spiky. The cost model that works for a Tuesday in March will quietly bleed cash through Black Friday. And retail data lives across dozens of systems, which means the cross system orchestration is itself an inference tax that almost nobody is metering today.",
    },
    {
      h: 'Portfolio engineering, defined',
      p: "Stop treating models as a feature backlog. Treat them as a portfolio with a cost of capital. Four moves separate the retailers shipping AI into operations from the ones still buying GPUs for a Q4 demo.",
      moves: [
        ['01', 'Anchor every model to a P&L line.', 'If the CFO cannot read the goal in fifteen seconds, the pilot will not survive Q3 review. "Cut markdown by 80 basis points on soft lines" outlives ten "explore generative AI" memos.'],
        ['02', 'Tier models like you tier inventory.',     'A, B, C tiering by unit economics. A tier earns its inference. B tier is on a watchlist. C tier gets sunset or routed to a cheaper model. The merchandising team already thinks this way. Borrow the framework.'],
        ['03', 'Cap inference by category, force the trade.', 'Set a monthly inference budget per category and make teams compete inside it. Scarcity drives better architecture choices than abundance ever has.'],
        ['04', 'Treat agents like capex, not opex.',        'Agents need a multi year ROI case. Programs that staff agents the way you staff a new store opening clear approvals in weeks. Programs that treat them as endpoints stall on liability review.'],
      ],
    },
    {
      h: 'What to do Monday',
      p: "Three concrete steps for the rest of this quarter. First, ask every model owner for a one page unit economics sheet. Most cannot produce one, and that is the finding. Second, instrument inference cost at the request level, not the monthly invoice level. Third, pick one agentic workflow and run it through your existing capex review process, end to end. The friction you discover is the work.",
    },
  ],
  pullQuote: "The retailers winning at AI are not the ones with the best models. They are the ones who decided, very early, which decisions a machine is allowed to make alone, and what each of those decisions is allowed to cost.",
};

const RR_SPOTLIGHT = {
  label: 'Use Case Spotlight',
  title: 'New Item Evaluation Platform',
  customer: 'A top five North American grocer',
  blurb:
    "One of the cleanest cost stories I have seen this quarter. The merchant team gets a 14 day demand and margin forecast for any proposed new SKU in under three minutes, including a confidence interval and a recommended cannibalization adjustment. The platform runs on Cloudera, uses three lightweight models in a router pattern, and pays for its monthly run cost in two avoided product launches. The lesson is not the model. The lesson is the routing.",
  stats: [
    ['14 days',  'forecast horizon'],
    ['< 3 min', 'response time per SKU'],
    ['3 models', 'in a router pattern'],
    ['2 launches','to monthly payback'],
  ],
  imageLabel: 'New Item Evaluation Platform · system view',
};

const RR_READING = [
  ['Anthropic',      "Pricing notes from the Claude Code retirement",         'engineering.anthropic.com',  '8 min'],
  ['Uber 10-Q',      'AI capex disclosure, Q3 2026',                          'investor.uber.com',          '12 min'],
  ['arXiv',          'Inference cost as a unit economic',                     'arxiv.org/abs/2606.04421',   '24 min'],
  ['Walmart',        "Earnings call language on agentic associates",          'corporate.walmart.com',      '5 min'],
];

const RR_EVENTS = [
  ['Jan 13', 'NRF Big Show',           'Panel: AI cost models for retail', 'New York'],
  ['Feb 18', 'Cloudera SE Community',  'Portfolio engineering workshop',   'Internal · virtual'],
  ['May 05', 'Cloudera Evolve',        'Fireside on agentic retail',       'Las Vegas'],
];

// ───────────────────────────── BRAND BITS ─────────────────────────────
// Cloudera wordmark approximation. Plain type, not a logo recreation.
// Honors the "logo on/off" tweak via the caller (just don't render it).
function ClouderaMark({ color = '#15110d', accent = '#F96302', size = 13, weight = 700 }) {
  return (
    <span
      style={{
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        fontWeight: weight,
        fontSize: size,
        letterSpacing: '0.04em',
        color,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="3.6" fill={accent} />
        <circle cx="8" cy="8" r="6.6" fill="none" stroke={accent} strokeWidth="1.3" opacity="0.45" />
      </svg>
      CLOUDERA
    </span>
  );
}

// Generic hero slot. heroTreatment === 'image' → striped placeholder photo,
// 'type' → typographic hero, 'chart' → inline cost-curve chart.
function HeroSlot({ treatment = 'image', accent = '#F96302', height = 320, label = 'DROP · hero image (1600×900)' }) {
  if (treatment === 'type') {
    return (
      <div
        style={{
          height, background: '#15110d', color: '#f6f1e8',
          display: 'flex', alignItems: 'flex-end', padding: 28, position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 80% 30%, ${accent}33, transparent 60%)` }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontWeight: 800, fontSize: 90, lineHeight: 0.9, letterSpacing: -3,
          }}>
            $3.4<span style={{ color: accent }}>B</span>
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7, marginTop: 8,
          }}>
            Uber AI spend, four quarters, disclosed
          </div>
        </div>
      </div>
    );
  }
  if (treatment === 'chart') {
    return <HeroChart accent={accent} height={height} />;
  }
  // image (striped placeholder)
  const stripe = `repeating-linear-gradient(135deg, #d9d2c4 0 12px, #cfc7b5 12px 24px)`;
  return (
    <div
      style={{
        height, background: stripe, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ position: 'absolute', inset: 12, border: '1px dashed rgba(0,0,0,.25)' }} />
      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
        color: 'rgba(0,0,0,.55)', background: 'rgba(246,241,232,.85)', padding: '6px 12px', borderRadius: 2,
      }}>{label}</div>
    </div>
  );
}

// Mini cost-curve chart used in 'chart' hero treatment.
function HeroChart({ accent = '#F96302', height = 320 }) {
  const pts = [10, 18, 24, 31, 42, 56, 73, 90, 110, 134, 162, 196]; // exponential-ish
  const w = 680, h = height - 80, padL = 56, padR = 24, padT = 24, padB = 36;
  const max = Math.max(...pts);
  const stepX = (w - padL - padR) / (pts.length - 1);
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${padL + i * stepX} ${padT + (h - padT - padB) * (1 - v / max)}`).join(' ');
  return (
    <div style={{ height, background: '#f6f1e8', padding: '24px 28px', boxSizing: 'border-box' }}>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, letterSpacing: '.18em',
        textTransform: 'uppercase', color: 'rgba(0,0,0,.55)', marginBottom: 4,
      }}>Inference cost · indexed, Jan 2025 = 10</div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={padL} x2={w - padR} y1={padT + (h - padT - padB) * g} y2={padT + (h - padT - padB) * g}
            stroke="rgba(0,0,0,.08)" strokeWidth="1" />
        ))}
        <path d={path} fill="none" stroke={accent} strokeWidth="2.5" />
        {pts.map((v, i) => (
          <circle key={i} cx={padL + i * stepX} cy={padT + (h - padT - padB) * (1 - v / max)} r="3" fill={accent} />
        ))}
        {['Jan ‘25', 'Apr', 'Jul', 'Oct', 'Jan ‘26', 'Apr', 'Jun'].map((lbl, i, arr) => (
          <text key={lbl} x={padL + (i * (w - padL - padR)) / (arr.length - 1)} y={h - 10}
            fontSize="10" fontFamily="JetBrains Mono, monospace" fill="rgba(0,0,0,.5)" textAnchor="middle">{lbl}</text>
        ))}
        <text x={padL - 8} y={padT + 4} fontSize="10" fontFamily="JetBrains Mono, monospace" fill="rgba(0,0,0,.5)" textAnchor="end">{max}</text>
        <text x={padL - 8} y={h - padB} fontSize="10" fontFamily="JetBrains Mono, monospace" fill="rgba(0,0,0,.5)" textAnchor="end">0</text>
      </svg>
    </div>
  );
}

// Inline striped image slot for the spotlight section.
function SpotlightImage({ label, accent = '#F96302', height = 220 }) {
  return (
    <div style={{
      height, background: '#ece6d8', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `repeating-linear-gradient(45deg, #e3dcc9 0 10px, #d8d1bf 10px 20px)`,
      }} />
      <div style={{
        position: 'absolute', left: 12, right: 12, bottom: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: '.16em',
        textTransform: 'uppercase', color: 'rgba(0,0,0,.6)',
      }}>
        <span style={{ background: 'rgba(246,241,232,.9)', padding: '4px 8px' }}>FIG · 01</span>
        <span style={{ background: 'rgba(246,241,232,.9)', padding: '4px 8px' }}>{label}</span>
      </div>
      <div style={{
        position: 'absolute', left: 16, top: 16,
        width: 10, height: 10, background: accent,
      }} />
    </div>
  );
}

Object.assign(window, {
  RR_AUTHOR, RR_ISSUE, RR_FEATURE, RR_SPOTLIGHT, RR_READING, RR_EVENTS,
  ClouderaMark, HeroSlot, HeroChart, SpotlightImage,
});
