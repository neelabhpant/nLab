// d2-briefing.jsx — Direction B: "Briefing" (editorial newspaper).
// FT / The Information / Economist energy. Serif body (Newsreader), Plus
// Jakarta Sans for UI labels and table-of-contents. Dense, scannable, ruled.
// Cloudera orange as a single editorial spot color. No em-dashes anywhere.

function BriefingNewsletter({ t = {} }) {
  const {
    accent = '#F96302',
    typePair = 'editorial',
    density = 'regular',
    heroTreatment = 'chart',
    showCloudera = true,
  } = t;

  // Type pair: Briefing leans serif by default; tweak shifts the headline /
  // body family relationship without ever dropping Plus Jakarta Sans (used
  // for UI labels in all three pairings).
  const PAIRS = {
    editorial: { head: '"Newsreader", "Iowan Old Style", Georgia, serif', body: '"Newsreader", Georgia, serif',          ui: '"Plus Jakarta Sans", system-ui, sans-serif' },
    modern:    { head: '"Plus Jakarta Sans", system-ui, sans-serif',      body: '"Plus Jakarta Sans", system-ui, sans-serif', ui: '"Plus Jakarta Sans", system-ui, sans-serif' },
    mixed:     { head: '"Newsreader", Georgia, serif',                    body: '"Plus Jakarta Sans", system-ui, sans-serif', ui: '"JetBrains Mono", monospace' },
  };
  const F = PAIRS[typePair] || PAIRS.editorial;

  const D = {
    airy:    { pad: 56, gap: 32, lh: 1.68, fs: 16,   blockY: 32 },
    regular: { pad: 44, gap: 24, lh: 1.58, fs: 15,   blockY: 24 },
    compact: { pad: 36, gap: 18, lh: 1.5,  fs: 14,   blockY: 18 },
  }[density] || { pad: 44, gap: 24, lh: 1.58, fs: 15, blockY: 24 };

  const ink   = '#15110d';
  const mute  = '#5a4f43';
  const faint = '#c6bba8';
  const paper = '#f6f1e8';

  const Mono = ({ children, color = ink, size = 10.5, ...rest }) => (
    <span {...rest} style={{
      fontFamily: F.ui === 'monospace' ? F.ui : '"JetBrains Mono", monospace',
      fontSize: size, letterSpacing: '0.18em', textTransform: 'uppercase',
      color, fontWeight: 600, ...(rest.style || {}),
    }}>{children}</span>
  );

  const DoubleRule = ({ my = 14, thick = 3, thin = 1, gap = 3 }) => (
    <div style={{ margin: `${my}px 0` }}>
      <hr style={{ border: 0, borderTop: `${thick}px solid ${ink}`, margin: 0 }} />
      <hr style={{ border: 0, borderTop: `${thin}px solid ${ink}`, margin: `${gap}px 0 0` }} />
    </div>
  );

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden',
      background: paper, color: ink,
      fontFamily: F.body, fontSize: D.fs, lineHeight: D.lh, boxSizing: 'border-box',
    }}>

      {/* ───────── TOP STRIP ───────── */}
      <div style={{
        padding: `14px ${D.pad}px`, display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        background: ink, color: paper,
      }}>
        <Mono color={paper} size={10}>Vol. 01 &nbsp;&middot;&nbsp; No. {RR_ISSUE.number} &nbsp;&middot;&nbsp; {RR_ISSUE.date}</Mono>
        {showCloudera
          ? <ClouderaMark color={paper} accent={accent} size={11} />
          : <Mono color={paper} size={10}>The Retail Read</Mono>}
      </div>

      {/* ───────── MASTHEAD ───────── */}
      <div style={{ padding: `26px ${D.pad}px 6px`, textAlign: 'center' }}>
        <Mono color={mute} size={10.5}>A bi-weekly briefing on AI in retail</Mono>
        <div style={{
          fontFamily: F.head, fontSize: 64, lineHeight: 1, letterSpacing: -2,
          fontWeight: 700, marginTop: 6, marginBottom: 6,
        }}>
          The Retail <span style={{ fontStyle: 'italic', fontWeight: 500 }}>Read</span>
          <span style={{ display: 'inline-block', width: 8, height: 8, background: accent, marginLeft: 4, transform: 'translateY(-22px)' }} />
        </div>
        <Mono color={mute} size={10}>Edited by Neelabh Pant &nbsp;&middot;&nbsp; Director, Global AI Industry Solutions, Retail &nbsp;&middot;&nbsp; Cloudera</Mono>
      </div>

      <div style={{ padding: `0 ${D.pad}px` }}>
        <DoubleRule my={16} thick={4} thin={1} gap={4} />
      </div>

      {/* ───────── HEADLINE BLOCK + IN THIS ISSUE ───────── */}
      <div style={{ padding: `0 ${D.pad}px`, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 28, alignItems: 'start' }}>
        <div>
          <Mono color={accent}>{RR_ISSUE.kicker} &nbsp;&middot;&nbsp; Feature</Mono>
          <h1 style={{
            fontFamily: F.head, fontSize: 50, lineHeight: 1.02, letterSpacing: -1.6,
            fontWeight: 700, margin: '8px 0 8px', color: ink,
          }}>
            {RR_ISSUE.title.replace(' next.', '')}
            <span style={{ fontStyle: 'italic', fontWeight: 500 }}> next.</span>
          </h1>
          <p style={{
            fontFamily: F.head, fontSize: 19, lineHeight: 1.35, color: mute,
            margin: 0, fontStyle: 'italic',
          }}>
            {RR_ISSUE.subhead}
          </p>
          <div style={{ marginTop: 14, fontFamily: F.ui, fontSize: 12.5, color: mute }}>
            By <span style={{ color: ink, borderBottom: `1px solid ${accent}`, fontWeight: 600 }}>{RR_AUTHOR.name}</span>.
            {' '}{RR_ISSUE.read}.
          </div>
        </div>

        {/* In this issue */}
        <div style={{
          borderLeft: `1px solid ${faint}`, paddingLeft: 18,
          fontFamily: F.ui,
        }}>
          <Mono>In this issue</Mono>
          <ol style={{
            listStyle: 'none', padding: 0, margin: '10px 0 0',
            counterReset: 'toc',
          }}>
            {[
              ['Two signals from last week', 'A1'],
              ['Why retail is next',          'A2'],
              ['Portfolio engineering',       'A3'],
              ['Use case · New Item Eval',    'B1'],
              ["What I'm reading",            'C1'],
              ["Where I'll be",               'C2'],
            ].map(([t, p], i) => (
              <li key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '7px 0', borderBottom: `1px dotted ${faint}`,
              }}>
                <span style={{ fontSize: 13, color: ink, fontWeight: 500 }}>
                  <span style={{ color: accent, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, marginRight: 6 }}>0{i + 1}</span>
                  {t}
                </span>
                <Mono color={mute} size={10}>{p}</Mono>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ───────── HERO ───────── */}
      <div style={{ padding: `${D.blockY}px ${D.pad}px 0` }}>
        <HeroSlot treatment={heroTreatment} accent={accent} height={300} label="FIG · cost curve" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <Mono color={mute} size={10}>FIG · 01 &nbsp;&middot;&nbsp; Inference cost curve</Mono>
          <Mono color={mute} size={10}>Source · illustrative</Mono>
        </div>
      </div>

      {/* ───────── LEDE (2 column with drop cap) ───────── */}
      <div style={{ padding: `${D.blockY}px ${D.pad}px 0` }}>
        <p style={{
          margin: 0, columnCount: 2, columnGap: 26,
          fontSize: D.fs + 0.5, lineHeight: 1.62, textAlign: 'justify', hyphens: 'auto',
        }}>
          <span style={{
            float: 'left',
            fontFamily: F.head, fontSize: 78, lineHeight: 0.84,
            paddingRight: 8, paddingTop: 4, fontWeight: 700, color: ink,
          }}>U</span>
          ber disclosed roughly $3.4 billion of AI spend across the past four
          reporting periods, then softened its self-driving language on the
          same call. Microsoft, in a separate move that got less coverage,
          sunset Claude Code from its commercial roadmap. The product was
          not failing. The math was. Both companies were running production
          AI at the scale most retailers will reach inside eighteen months,
          and both decided the unit economics no longer made sense.
          Retail is the next industry to feel this, and the answer is not a
          bigger budget. It is portfolio engineering.
        </p>
      </div>

      {/* ───────── EDITOR'S NOTE ───────── */}
      <div style={{ padding: `${D.blockY}px ${D.pad}px 0` }}>
        <DoubleRule my={0} thick={1} thin={1} gap={2} />
        <div style={{ padding: '14px 0', display: 'grid', gridTemplateColumns: '120px 1fr', gap: 20, alignItems: 'start' }}>
          <Mono color={accent}>From the desk</Mono>
          <p style={{
            margin: 0, fontFamily: F.head, fontStyle: 'italic',
            fontSize: 17, lineHeight: 1.5, color: ink,
          }}>
            {RR_ISSUE.editorsNote}
          </p>
        </div>
        <DoubleRule my={0} thick={1} thin={1} gap={2} />
      </div>

      {/* ───────── FOUR MOVES ───────── */}
      <div style={{ padding: `${D.blockY + 6}px ${D.pad}px 0` }}>
        <Mono>Portfolio engineering &nbsp;·&nbsp; Four moves</Mono>
        <h2 style={{
          fontFamily: F.head, fontSize: 30, lineHeight: 1.15, letterSpacing: -0.6,
          fontWeight: 700, margin: '6px 0 14px', color: ink,
        }}>
          Treat models like a portfolio with a cost of capital.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderTop: `2px solid ${ink}` }}>
          {RR_FEATURE.sections[2].moves.map(([n, t, b], i) => (
            <div key={n} style={{
              padding: '16px 18px 18px 0',
              paddingLeft: i % 2 === 1 ? 18 : 0,
              borderRight: i % 2 === 0 ? `1px solid ${faint}` : 'none',
              borderBottom: i < 2 ? `1px solid ${faint}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontFamily: F.head, fontSize: 38, lineHeight: 1, letterSpacing: -1,
                  fontWeight: 600, color: accent, fontStyle: 'italic',
                }}>{n}</span>
                <span style={{ fontFamily: F.head, fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{t}</span>
              </div>
              <p style={{ margin: 0, fontSize: D.fs - 0.5, color: ink, lineHeight: 1.55 }}>{b}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ───────── PULL QUOTE ───────── */}
      <div style={{ padding: `${D.blockY + 6}px ${D.pad + 12}px 0` }}>
        <DoubleRule my={0} thick={3} thin={1} gap={3} />
        <blockquote style={{
          margin: '18px 0',
          fontFamily: F.head, fontStyle: 'italic',
          fontSize: 24, lineHeight: 1.3, letterSpacing: -0.3,
          textAlign: 'center', color: ink,
        }}>
          &ldquo;{RR_FEATURE.pullQuote}&rdquo;
        </blockquote>
        <DoubleRule my={0} thick={3} thin={1} gap={3} />
      </div>

      {/* ───────── USE CASE SPOTLIGHT ───────── */}
      <div style={{ padding: `${D.blockY + 8}px ${D.pad}px 0` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Mono color={accent}>Use Case Spotlight &nbsp;&middot;&nbsp; B-section</Mono>
          <Mono color={mute} size={10}>{RR_SPOTLIGHT.customer}</Mono>
        </div>
        <h2 style={{
          fontFamily: F.head, fontSize: 36, lineHeight: 1.05, letterSpacing: -1,
          fontWeight: 700, margin: '4px 0 14px', color: ink,
        }}>
          {RR_SPOTLIGHT.title}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          <SpotlightImage label={RR_SPOTLIGHT.imageLabel} accent={accent} height={220} />
          <p style={{
            margin: 0, fontFamily: F.body, fontSize: D.fs, lineHeight: 1.58, color: ink,
          }}>
            {RR_SPOTLIGHT.blurb}
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0,
          marginTop: 18, borderTop: `2px solid ${ink}`, borderBottom: `2px solid ${ink}`,
        }}>
          {RR_SPOTLIGHT.stats.map(([v, l], i, arr) => (
            <div key={l} style={{
              padding: '14px 10px',
              borderRight: i === arr.length - 1 ? 'none' : `1px solid ${faint}`,
            }}>
              <div style={{
                fontFamily: F.head, fontSize: 24, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.05,
              }}>{v}</div>
              <Mono color={mute} size={10} style={{ marginTop: 6, display: 'block' }}>{l}</Mono>
            </div>
          ))}
        </div>
      </div>

      {/* ───────── WHAT I'M READING ───────── */}
      <div style={{ padding: `${D.blockY + 8}px ${D.pad}px 0` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <Mono>What I&apos;m reading</Mono>
          <Mono color={mute} size={10}>Four links</Mono>
        </div>
        <DoubleRule my={6} thick={2} thin={1} gap={2} />
        <div style={{ display: 'grid', gap: 0 }}>
          {RR_READING.map(([src, title, dom, time], i) => (
            <a key={i} href="#"
              style={{
                display: 'grid', gridTemplateColumns: '28px 1fr auto',
                gap: 14, alignItems: 'baseline',
                padding: '12px 0', borderBottom: `1px solid ${faint}`,
                textDecoration: 'none', color: ink,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(249,99,2,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <span style={{
                fontFamily: F.head, fontStyle: 'italic', fontSize: 22, color: accent, fontWeight: 600, lineHeight: 1,
              }}>{i + 1}.</span>
              <div>
                <div style={{ fontFamily: F.head, fontSize: 17, fontWeight: 600, lineHeight: 1.25 }}>{title}</div>
                <Mono color={mute} size={10} style={{ display: 'inline-block', marginTop: 4 }}>
                  {src} &nbsp;&middot;&nbsp; {dom}
                </Mono>
              </div>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                color: mute, letterSpacing: '.04em',
              }}>{time}</span>
            </a>
          ))}
        </div>
      </div>

      {/* ───────── WHERE I'LL BE ───────── */}
      <div style={{ padding: `${D.blockY + 8}px ${D.pad}px 0` }}>
        <Mono>Where I&apos;ll be</Mono>
        <DoubleRule my={6} thick={2} thin={1} gap={2} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
          {RR_EVENTS.map(([d, name, what, where], i, arr) => (
            <div key={i} style={{
              padding: '4px 14px',
              borderRight: i === arr.length - 1 ? 'none' : `1px solid ${faint}`,
            }}>
              <Mono color={accent} size={10}>{d}</Mono>
              <div style={{
                fontFamily: F.head, fontSize: 18, fontWeight: 700, lineHeight: 1.2, marginTop: 4,
              }}>{name}</div>
              <div style={{ fontFamily: F.head, fontStyle: 'italic', fontSize: 13.5, color: mute, marginTop: 2 }}>{what}</div>
              <Mono color={mute} size={10} style={{ marginTop: 6, display: 'inline-block' }}>{where}</Mono>
            </div>
          ))}
        </div>
      </div>

      {/* ───────── CTA ROW (boxed but un-salesy) ───────── */}
      <div style={{ padding: `${D.blockY + 10}px ${D.pad}px 0` }}>
        <div style={{
          background: ink, color: paper, padding: '22px 24px',
          display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 20, alignItems: 'center',
        }}>
          <div>
            <Mono color={paper} size={10}>Two ways forward</Mono>
            <div style={{
              fontFamily: F.head, fontStyle: 'italic', fontSize: 22, lineHeight: 1.25, marginTop: 8,
            }}>
              Reply with the part you disagree with. Or book thirty minutes on portfolio engineering for your retailer.
            </div>
          </div>
          <a href={`mailto:${RR_AUTHOR.email}?subject=Re: The Retail Read · Issue ${RR_ISSUE.number}`} style={{
            display: 'block', color: paper, textDecoration: 'none',
            border: `1px solid ${paper}`, padding: '12px 14px',
            fontFamily: F.ui, fontWeight: 600, fontSize: 14,
          }}>
            <Mono color={accent} size={10}>Reply →</Mono>
            <div style={{ marginTop: 4 }}>Tell me where I am wrong.</div>
          </a>
          <a href={RR_AUTHOR.bookingUrl} style={{
            display: 'block', textDecoration: 'none',
            background: accent, color: ink, padding: '12px 14px',
            fontFamily: F.ui, fontWeight: 700, fontSize: 14,
          }}>
            <Mono color={ink} size={10}>Book →</Mono>
            <div style={{ marginTop: 4 }}>30 minutes, working session.</div>
          </a>
        </div>
      </div>

      {/* ───────── COLOPHON ───────── */}
      <div style={{ padding: `${D.blockY + 10}px ${D.pad}px ${D.blockY + 6}px` }}>
        <DoubleRule my={0} thick={3} thin={1} gap={3} />
        <div style={{
          paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          fontFamily: F.ui, fontSize: 11.5, color: mute, lineHeight: 1.5,
        }}>
          <div>
            <div style={{ color: ink, fontWeight: 700 }}>{RR_AUTHOR.name}</div>
            <div>{RR_AUTHOR.title}</div>
            <div>{RR_AUTHOR.org}</div>
            <a href={`mailto:${RR_AUTHOR.email}`} style={{
              color: accent, fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11, letterSpacing: '.04em', textDecoration: 'none',
              borderBottom: `1px solid ${accent}`, marginTop: 6, display: 'inline-block',
            }}>{RR_AUTHOR.email}</a>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Mono color={mute} size={10}>The Retail Read</Mono>
            <div style={{ fontFamily: F.head, fontStyle: 'italic', fontSize: 13, marginTop: 4 }}>
              No. {RR_ISSUE.number} &nbsp;&middot;&nbsp; {RR_ISSUE.date}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {showCloudera && (
              <div style={{ marginBottom: 6, display: 'inline-block' }}>
                <ClouderaMark color={ink} accent={accent} size={11} />
              </div>
            )}
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: '.06em' }}>
              Set in Newsreader &amp; Plus Jakarta Sans
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.BriefingNewsletter = BriefingNewsletter;
