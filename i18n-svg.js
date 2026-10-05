'use strict';

// Scientific labels use their immutable Chinese annotations as the source. Only
// label presentation changes: the illustration, answers and experiment stay put.
window.VL2I18nSVG = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const originals = new WeakMap();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  function numberAttribute(node, name, fallback = 0) {
    const value = parseFloat(node.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function original(node) {
    let entry = originals.get(node);
    if (entry) return entry;
    let lines;
    try { lines = JSON.parse(node.getAttribute('data-i18n-lines')); }
    catch { lines = null; }
    if (!Array.isArray(lines) || !lines.every(line => typeof line === 'string')) {
      lines = [...node.querySelectorAll('tspan')].map(span => span.textContent);
      if (!lines.length) lines = [node.textContent];
    }
    const font = numberAttribute(node, 'data-i18n-font', numberAttribute(node, 'font-size', 17));
    const x = numberAttribute(node, 'data-i18n-x', numberAttribute(node, 'x'));
    // A report can clone an English diagram. Reconstructing from the annotation
    // also makes those new nodes reversible without sharing another node's cache.
    let children = [...node.childNodes].map(child => child.cloneNode(true));
    if (node.querySelector('[data-i18n-rendered]')) {
      children = lines.map((line, index) => {
        const span = document.createElementNS(SVG_NS, 'tspan');
        span.setAttribute('x', String(x));
        span.setAttribute('dy', String(index ? 22 : 0));
        span.textContent = line;
        return span;
      });
    }
    entry = {lines, children, font, x, y: numberAttribute(node, 'y'),
      fontAttribute: node.getAttribute('data-i18n-font') || node.getAttribute('font-size'), signature: null};
    originals.set(node, entry);
    return entry;
  }

  function measure(text, font, style) {
    if (!context) return [...text].length * font * .65;
    context.font = `${style.fontStyle || 'normal'} ${style.fontWeight || '400'} ${font}px ${style.fontFamily || 'sans-serif'}`;
    return context.measureText(text).width;
  }

  function wrap(text, width, font, style) {
    const lines = [];
    let current = '';
    for (const word of text.trim().split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && measure(candidate, font, style) > width) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function rectangle(group) {
    return group ? [...group.children].find(child => child.localName === 'rect') : null;
  }

  function layout(node, entry, text, style) {
    const {x, y, font} = entry;
    const svg = node.closest('svg');
    const viewWidth = svg?.viewBox?.baseVal?.width || 1080;
    let width = Math.max(20, viewWidth - x - 23), maximumLines = 1;
    let lineHeight = 17, minimumFont = 12, anchor = null, lineX = x, firstDy = 0;
    let groupedLines = null;
    const card = rectangle(node.closest('.process-card'));
    const heading = rectangle(node.closest('.process-heading'));
    if (card) {
      width = numberAttribute(card, 'x') + numberAttribute(card, 'width') - x - 9;
      maximumLines = 4;
      minimumFont = 10;
    } else if (heading) {
      width = numberAttribute(heading, 'width') - 26;
      lineX = numberAttribute(heading, 'x') + numberAttribute(heading, 'width') / 2;
      anchor = 'middle';
    } else if (x >= 830) {
      // Headings share a column with explanations. Fitting one heading line
      // keeps its leader and the following explanation at their original place.
      width = 217;
      // The spongy-mesophyll explanation sits immediately above the water-film
      // label; one fitted line avoids touching that next label's font box.
      maximumLines = font < 17 && y !== 338 ? 2 : 1;
      lineHeight = 16;
    } else if (x >= 190 && x <= 215 && y >= 350 && y <= 480) {
      width = 106;
      maximumLines = y === 446 ? 1 : 2;
      if (y === 394) {
        // The blue step-3 marker lies just below this label. Put the whole
        // scientific name above its gloss, finishing above that marker.
        const glossary = text.match(/^(.*?)\s+(\([^()]+\))$/);
        if (glossary) groupedLines = [glossary[1], glossary[2]];
        firstDy = -18;
      }
    } else if (x === 211 && y === 96) {
      width = 85;
      maximumLines = 2;
    } else if (x === 32 && y === 112) {
      width = 116;
    } else if (x <= 35 && y >= 200 && y <= 520) {
      width = 260;
      maximumLines = y === 297 ? 1 : 2;
    } else if (x === 67 && y === 594) {
      width = 207;
    } else if (x === 324 && y === 594) {
      width = 390;
    } else if (y >= 770) {
      width = 1030;
    }
    let size = font, lines = groupedLines || (maximumLines === 1 ? [text] : wrap(text, width, size, style));
    while (size > minimumFont && (lines.length > maximumLines || lines.some(line => measure(line, size, style) > width))) {
      size = Math.max(minimumFont, size - .25);
      lines = groupedLines || (maximumLines === 1 ? [text] : wrap(text, width, size, style));
    }
    // Long glossary labels need a small amount of compression at 12 px. If a
    // process sentence is unusually long, fit its complete text into four lines.
    if (lines.length > maximumLines) {
      const words = text.trim().split(/\s+/);
      lines = [];
      for (let index = 0; index < maximumLines; index++) {
        const remaining = maximumLines - index;
        const count = Math.ceil(words.length / remaining);
        lines.push(words.splice(0, count).join(' '));
      }
    }
    return {width, lines, size, lineHeight, anchor, x: lineX, firstDy};
  }

  function restore(node, entry) {
    if (entry.signature === 'zh') return;
    if (entry.fontAttribute === null) node.removeAttribute('font-size');
    else node.setAttribute('font-size', entry.fontAttribute);
    node.replaceChildren(...entry.children.map(child => child.cloneNode(true)));
    entry.signature = 'zh';
  }

  function render(node, translate) {
    const entry = original(node);
    const translated = String(translate(entry.lines.join(''), 'en'));
    const style = getComputedStyle(node);
    const design = layout(node, entry, translated, style);
    const signature = JSON.stringify(design);
    if (entry.signature === signature) return;
    node.setAttribute('font-size', String(design.size));
    const spans = design.lines.map((line, index) => {
      const renderedLine = line + (index < design.lines.length - 1 ? ' ' : '');
      const span = document.createElementNS(SVG_NS, 'tspan');
      span.setAttribute('data-i18n-rendered', '');
      span.setAttribute('x', String(design.x));
      span.setAttribute('dy', String(index ? design.lineHeight : design.firstDy));
      if (design.anchor) span.setAttribute('text-anchor', design.anchor);
      if (measure(renderedLine, design.size, style) > design.width) {
        span.setAttribute('textLength', String(design.width));
        span.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
      span.textContent = renderedLine;
      return span;
    });
    node.replaceChildren(...spans);
    entry.signature = signature;
  }

  function apply(root, language, translate) {
    if (!root || typeof translate !== 'function') return;
    const nodes = root.matches?.('text[data-i18n-svg]') ? [root] : [];
    nodes.push(...root.querySelectorAll('text[data-i18n-svg]'));
    for (const node of nodes) {
      if (language === 'en') render(node, translate);
      else restore(node, original(node));
    }
  }

  return {apply};
})();
