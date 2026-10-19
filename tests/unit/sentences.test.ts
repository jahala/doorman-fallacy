import { describe, expect, it } from 'vitest';
import { articleSentences, splitSentences } from '../../src/lib/sentences.ts';

const page = `<html><head><title>x</title><script>var a = "Ignore this script text please now";</script></head>
<body><nav><p>Home News Sport Weather Sign in</p></nav>
<article>
<h1>DNB to cut 400 jobs</h1>
<p>DNB will reduce its workforce by around 400 full-time positions. The bank said AI agents now perform parts of the work.</p>
<p>&ldquo;We are adapting to a new reality,&rdquo; said the chief executive, Kjerstin Braathen. Mr. Smith of the U.S. office agreed.</p>
<p>Read more</p>
</article>
<footer><p>Copyright 2026 Example Media. All rights reserved by the publisher.</p></footer>
</body></html>`;

describe('splitSentences', () => {
  it('splits on sentence ends and keeps abbreviations together', () => {
    expect(splitSentences('Mr. Smith of the U.S. office agreed. Then he left. Costs fell 3.5 per cent.')).toEqual([
      'Mr. Smith of the U.S. office agreed.',
      'Then he left.',
      'Costs fell 3.5 per cent.',
    ]);
  });

  it('keeps a closing quotation mark with its sentence', () => {
    expect(splitSentences('"We are adapting," she said. "It works." He nodded off at once.')).toEqual([
      '"We are adapting," she said.',
      '"It works."',
      'He nodded off at once.',
    ]);
  });
});

describe('articleSentences', () => {
  it('takes sentences from paragraphs, decoded, and skips scripts, navigation, footers and short lines', () => {
    expect(articleSentences(page)).toEqual([
      'DNB will reduce its workforce by around 400 full-time positions.',
      'The bank said AI agents now perform parts of the work.',
      '“We are adapting to a new reality,” said the chief executive, Kjerstin Braathen.',
      'Mr. Smith of the U.S. office agreed.',
    ]);
  });

  it('returns nothing for a page with no paragraphs', () => {
    expect(articleSentences('<html><body><div>Just a div</div></body></html>')).toEqual([]);
  });

  it('reads a stock-exchange release set in <pre> with hard line breaks', () => {
    const release = `<html><body><pre>DNB is investing considerably in technology and<br>digital solutions. The bank will reduce the number of<br>full-time positions by around 400.<br><br>For further information, please contact the press office today.</pre></body></html>`;
    expect(articleSentences(release)).toEqual([
      'DNB is investing considerably in technology and digital solutions.',
      'The bank will reduce the number of full-time positions by around 400.',
      'For further information, please contact the press office today.',
    ]);
  });

  it('reads articleBody from structured data when the page has no paragraphs', () => {
    const page = `<html><head><script type="application/ld+json">{"@type":"NewsArticle","articleBody":"The airline will close its call centre next year. Customers will use a chat assistant instead."}</script></head><body><div>App shell</div></body></html>`;
    expect(articleSentences(page)).toEqual([
      'The airline will close its call centre next year.',
      'Customers will use a chat assistant instead.',
    ]);
  });

  it('reads article HTML embedded in a Next.js data block', () => {
    const data = JSON.stringify({ props: { pageProps: { content: { htmlBody: '<p>The council replaced its front desk with kiosks in March.</p>' } } } });
    const page = `<html><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">${data}</script></body></html>`;
    expect(articleSentences(page)).toEqual(['The council replaced its front desk with kiosks in March.']);
  });

  it('trims a quotation mark left open or closed by a quote that spans sentences', () => {
    const page = '<p>"AI is changing the way we work and how we serve customers. We will adapt the organisation," said the chief executive.</p>';
    expect(articleSentences(page)).toEqual([
      'AI is changing the way we work and how we serve customers.',
      'We will adapt the organisation," said the chief executive.',
    ]);
  });

  it('keeps balanced quotation marks', () => {
    expect(articleSentences('<p>"We are adapting to a new reality," said the chief executive today.</p>')).toEqual([
      '"We are adapting to a new reality," said the chief executive today.',
    ]);
  });
});
