// d1-read.jsx — Direction A: "The Read" (modern tech-publication).
// Stratechery / Platformer energy. Single column, Plus Jakarta Sans body,
// Instrument Serif for accents and pull-quote. Cloudera orange as accent
// only. Distinct mono kickers above every section so 30-second scanning
// works. No em-dashes anywhere.

function ReadNewsletter({ t = {} }) {
  const {
    accent = '#F96302',
    typePair = 'modern',
    density = 'regular',
    heroTreatment = 'image',
    showCloudera = true,
  } = t;

  // Type pairings (Plus Jakarta Sans always present per brand requirement).
  const PAIRS = {
    modern:    { body: '"Plus Jakarta Sans", system-ui, sans-serif', accent: '"Instrument Serif", "Newsreader", serif' },
    editorial: { body: '"Newsreader", "Plus Jakarta Sans", serif',   accent: '"Plus Jakarta Sans", system-ui, sans-serif' },
    mixed:     { body: '"Plus Jakarta Sans", system-ui, sans-serif', accent: '"Newsreader", serif' },
  };
  const F = PAIRS[typePair] || PAIRS.modern;

  // Density knob: row paddings + base line height.
  const D = {
    airy:    { pad: 56, gap: 36, lh: 1.72, fs: 17.5, blockY: 32 },
    regular: { pad: 48, gap: 28, lh: 1.62, fs: 16.5, blockY: 26 },
    compact: { pad: 40, gap: 22, lh: 1.55, fs: 15.5, blockY: 20 },
  }[density] || { pad: 48, gap: 28, lh: 1.62, fs: 16.5, blockY: 26 };

  const ink   = '#15110d';
  const mute  = '#5a4f43';
  const faint = 'rgba(21,17,13,0.12)';
  const paper = '#fbf9f4';

  const Kicker = ({ children, color = accent }) => (
    <div style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase',
      color, fontWeight: 600, marginBottom: 10,
      display: 'inline-flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ width: 14, height: 1.5, background: color, display: 'inline-block' }} />
      {children}
    </div>
  );

  const SectionHead = ({ kicker, title }) => (
    <div style={{ marginBottom: 14 }}>
      <Kicker color={ink}>{kicker}</Kicker>
      <h2 style={{
        fontFamily: F.body, fontSize: 26, lineHeight: 1.2, letterSpacing: -0.4,
        fontWeight: 700, margin: '4px 0 0', color: ink,
      }}>{title}</h2>
    </div>
  );

  // Reply / Book CTAs share styling
  const CtaButton = ({ href, primary, children, sub }) => (
    <a href={href}
       style={{
         display: 'flex', flexDirection: 'column', gap: 4,
         background: primary ? ink : 'transparent',
         color: primary ? paper : ink,
         border: primary ? `1px solid ${ink}` : `1px solid ${ink}`,
         padding: '14px 18px',
         textDecoration: 'none',
         fontFamily: F.body, fontSize: 15, fontWeight: 600,
         letterSpacing: -0.1,
         transition: 'background .15s, color .15s',
       }}>
      <span>{children}</span>
      <span style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
        letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7, fontWeight: 500,
      }}>{sub}</span>
    </a>
  );

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden', background: paper, color: ink,
      fontFamily: F.body, fontSize: D.fs, lineHeight: D.lh, boxSizing: 'border-box',
    }}>
      {/* ───────── HEADER ───────── */}
      <div style={{
        padding: `20px ${D.pad}px`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${faint}`,
      }}>
        {showCloudera
          ? <ClouderaMark color={ink} accent={accent} size={13} />
          : <span style={{ width: 1 }} />}
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
          color: mute, letterSpacing: '0.06em',
          display: 'flex', gap: 14,
        }}>
          <span>Issue No. {RR_ISSUE.number}</span>
          <span style={{ color: faint }}>·</span>
          <span>{RR_ISSUE.date}</span>
          <span style={{ color: faint }}>·</span>
          <span>{RR_ISSUE.read}</span>
        </div>
      </div>

      {/* ───────── PUBLICATION TITLE BAR ───────── */}
      <div style={{
        padding: `28px ${D.pad}px 8px`,
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{
          fontFamily: F.body, fontSize: 22, fontWeight: 800, letterSpacing: -0.4,
        }}>
          The Retail Read
          <span style={{
            display: 'inline-block', width: 6, height: 6, background: accent,
            marginLeft: 6, transform: 'translateY(-2px)',
          }} />
        </div>
        <div style={{ fontFamily: F.accent, fontSize: 16, fontStyle: 'italic', color: mute }}>
          {RR_ISSUE.cadence} dispatch on AI in retail
        </div>
      </div>

      {/* ───────── LEDE ───────── */}
      <div style={{ padding: `${D.blockY}px ${D.pad}px ${D.blockY}px` }}>
        <Kicker>{RR_ISSUE.kicker} · Feature</Kicker>
        <h1 style={{
          fontFamily: F.body,
          fontSize: 48, lineHeight: 1.04, letterSpacing: -1.6,
          fontWeight: 800, margin: '4px 0 16px', color: ink,
        }}>
          {RR_ISSUE.title}
        </h1>
        <p style={{
          fontFamily: F.accent, fontStyle: 'italic',
          fontSize: 20, lineHeight: 1.4, color: mute, margin: '0 0 22px',
          maxWidth: 600,
        }}>
          {RR_ISSUE.subhead}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `linear-gradient(135deg, ${accent} 0%, #15110d 100%)`,
            color: paper, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: F.body, fontWeight: 700, fontSize: 13,
          }}>NP</div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{RR_AUTHOR.name}</div>
            <div style={{ fontSize: 12.5, color: mute }}>{RR_AUTHOR.title}, {RR_AUTHOR.org}</div>
          </div>
        </div>
      </div>

      {/* ───────── HERO ───────── */}
      <HeroSlot treatment={heroTreatment} accent={accent} height={320} label="DROP · hero image (1600×900)" />

      {/* ───────── EDITOR'S NOTE ───────── */}
      <div style={{ padding: `${D.blockY + 4}px ${D.pad}px 0` }}>
        <Kicker>From the desk</Kicker>
        <p style={{
          fontFamily: F.accent, fontStyle: 'italic',
          fontSize: 19, lineHeight: 1.55, color: ink, margin: '6px 0 0',
        }}>
          {RR_ISSUE.editorsNote}
        </p>
      </div>

      {/* ───────── FEATURE BODY ───────── */}
      <div style={{ padding: `${D.blockY + 8}px ${D.pad}px 0` }}>
        {RR_FEATURE.sections.map((s, i) => (
          <div key={i} style={{ marginBottom: D.gap + 4 }}>
            <SectionHead kicker={`§ 0${i + 1}`} title={s.h} />
            <p style={{ margin: '4px 0 0', color: ink }}>{s.p}</p>
            {s.moves && (
              <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
                {s.moves.map(([n, t, b]) => (
                  <div key={n} style={{
                    display: 'grid', gridTemplateColumns: '46px 1fr', gap: 14,
                    paddingTop: 14, borderTop: `1px solid ${faint}`,
                  }}>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 16, color: accent, fontWeight: 600, lineHeight: 1.1,
                    }}>{n}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3, marginBottom: 4 }}>{t}</div>
                      <div style={{ fontSize: D.fs - 1, color: mute, lineHeight: 1.55 }}>{b}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ───────── PULL QUOTE ───────── */}
      <div style={{ padding: `${D.blockY}px ${D.pad}px 0` }}>
        <div style={{ borderTop: `1px solid ${ink}`, borderBottom: `1px solid ${ink}`, padding: '22px 0' }}>
          <div style={{
            fontFamily: F.accent, fontSize: 28, lineHeight: 1.25, letterSpacing: -0.3,
            fontStyle: 'italic', color: ink,
          }}>
            &ldquo;{RR_FEATURE.pullQuote}&rdquo;
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
            letterSpacing: '.18em', textTransform: 'uppercase', color: mute,
            marginTop: 12,
          }}>
            <span style={{ color: accent }}>↳</span> Neelabh Pant
          </div>
        </div>
      </div>

      {/* ───────── USE CASE SPOTLIGHT ───────── */}
      <div style={{ padding: `${D.blockY + 6}px ${D.pad}px 0` }}>
        <Kicker color={accent}>Use case · Spotlight</Kicker>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{
            fontFamily: F.body, fontSize: 26, lineHeight: 1.2, letterSpacing: -0.4,
            fontWeight: 700, margin: 0,
          }}>
            {RR_SPOTLIGHT.title}
          </h2>
          <span style={{ fontFamily: F.accent, fontStyle: 'italic', fontSize: 16, color: mute }}>
            {RR_SPOTLIGHT.customer}
          </span>
        </div>

        <SpotlightImage label={RR_SPOTLIGHT.imageLabel} accent={accent} height={220} />

        <p style={{ margin: '18px 0 0', color: ink }}>{RR_SPOTLIGHT.blurb}</p>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0,
          marginTop: 22, borderTop: `1px solid ${ink}`, borderBottom: `1px solid ${ink}`,
        }}>
          {RR_SPOTLIGHT.stats.map(([v, l], i, arr) => (
            <div key={l} style={{
              padding: '14px 12px',
              borderRight: i === arr.length - 1 ? 'none' : `1px solid ${faint}`,
            }}>
              <div style={{ fontFamily: F.body, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.1 }}>{v}</div>
              <div style={{ fontSize: 11.5, color: mute, marginTop: 4, lineHeight: 1.35 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ───────── WHAT I'M READING ───────── */}
      <div style={{ padding: `${D.blockY + 6}px ${D.pad}px 0` }}>
        <SectionHead kicker="What I'm reading" title="Four links worth your inbox" />
        <div style={{ display: 'grid', gap: 0, marginTop: 12 }}>
          {RR_READING.map(([src, t, d, time], i) => (
            <a key={i} href="#" style={{
              display: 'grid', gridTemplateColumns: '110px 1fr 60px', gap: 16, alignItems: 'baseline',
              padding: '14px 0', borderBottom: `1px solid ${faint}`,
              textDecoration: 'none', color: ink, cursor: 'pointer',
            }}
              onMouseEnter={(e) => e.currentTarget.querySelector('[data-arrow]').style.transform = 'translateX(4px)'}
              onMouseLeave={(e) => e.currentTarget.querySelector('[data-arrow]').style.transform = 'translateX(0)'}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '.14em',
                textTransform: 'uppercase', color: accent,
              }}>{src}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{t}</div>
                <div style={{ fontSize: 12, color: mute, marginTop: 3 }}>{d}</div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: mute,
              }}>
                <span>{time}</span>
                <span data-arrow style={{ color: accent, transition: 'transform .15s' }}>→</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ───────── WHERE I'LL BE ───────── */}
      <div style={{ padding: `${D.blockY + 6}px ${D.pad}px 0` }}>
        <SectionHead kicker="Where I'll be" title="Three rooms this quarter" />
        <div style={{ display: 'grid', gap: 0, marginTop: 12 }}>
          {RR_EVENTS.map(([d, name, what, where], i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 18, alignItems: 'center',
              padding: '14px 0', borderBottom: `1px solid ${faint}`,
            }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: ink, fontWeight: 600,
              }}>{d}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: 13, color: mute, fontStyle: 'italic', fontFamily: F.accent }}>{what}</div>
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: mute, letterSpacing: '.06em',
              }}>{where}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ───────── CTAs ───────── */}
      <div style={{ padding: `${D.blockY + 10}px ${D.pad}px 0` }}>
        <Kicker>What now</Kicker>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4,
        }}>
          <CtaButton
            href={`mailto:${RR_AUTHOR.email}?subject=Re: The Retail Read · Issue ${RR_ISSUE.number}`}
            primary={false}
            sub="Reply to this issue">
            Tell me where I&apos;m wrong.
          </CtaButton>
          <CtaButton href={RR_AUTHOR.bookingUrl} primary sub="30 min · portfolio review">
            Book a working session.
          </CtaButton>
        </div>
      </div>

      {/* ───────── FOOTER ───────── */}
      <div style={{
        padding: `${D.blockY + 10}px ${D.pad}px ${D.blockY + 6}px`,
        marginTop: D.blockY,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16,
          paddingTop: 18, borderTop: `2px solid ${ink}`,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{RR_AUTHOR.name}</div>
            <div style={{ fontSize: 12.5, color: mute, marginTop: 2 }}>{RR_AUTHOR.title}</div>
            <div style={{ fontSize: 12.5, color: mute }}>{RR_AUTHOR.org}</div>
            <a href={`mailto:${RR_AUTHOR.email}`} style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, letterSpacing: '.04em',
              color: accent, textDecoration: 'none', marginTop: 8, display: 'inline-block',
              borderBottom: `1px solid ${accent}`,
            }}>{RR_AUTHOR.email}</a>
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: mute,
            letterSpacing: '.06em', textAlign: 'right', lineHeight: 1.6,
          }}>
            <div>The Retail Read · No. {RR_ISSUE.number}</div>
            {showCloudera && <div>Published by Cloudera</div>}
            <div style={{ marginTop: 6, color: faint }}>set in Plus Jakarta Sans &amp; Instrument Serif</div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ReadNewsletter = ReadNewsletter;
