import * as fs from 'fs';
import * as path from 'path';

let isRegistered = false;

/**
 * Robustly resolves the path to an asset font file across:
 * - Development (ts-node / ts-jest from apps/api/src/)
 * - Monorepo root / Turbo runs
 * - Production NestJS build (dist/apps/api/src/ or dist/src/)
 */
export function resolveFontPath(fontFileName: string): string {
  const candidatePaths = [
    // 1. Relative to this module in src/customer-transactions -> src/assets/fonts
    path.resolve(__dirname, '..', 'assets', 'fonts', fontFileName),
    // 2. Relative to dist output (e.g. dist/apps/api/src/customer-transactions)
    path.resolve(__dirname, '..', '..', 'assets', 'fonts', fontFileName),
    // 3. Monorepo root relative to process.cwd()
    path.resolve(process.cwd(), 'apps', 'api', 'src', 'assets', 'fonts', fontFileName),
    // 4. API directory relative to process.cwd()
    path.resolve(process.cwd(), 'src', 'assets', 'fonts', fontFileName),
    // 5. Production dist directory relative to process.cwd()
    path.resolve(process.cwd(), 'dist', 'apps', 'api', 'src', 'assets', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'apps', 'api', 'dist', 'apps', 'api', 'src', 'assets', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'dist', 'assets', 'fonts', fontFileName),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Font file "${fontFileName}" could not be resolved. Searched locations:\n` +
      candidatePaths.map((p) => `  - ${p}`).join('\n'),
  );
}

/**
 * Registers NotoSansDevanagari with Regular and Bold weights and configures
 * a global non-breaking hyphenation callback to protect Hindi ligatures.
 * Guaranteed idempotent to prevent memory leaks and redundant FontStore sources.
 */
export function registerDevanagariFonts(customFont?: any): void {
  if (isRegistered) return;

  let fontObj = customFont;
  if (!fontObj) {
    try {
      const renderer = require('@react-pdf/renderer');
      fontObj = renderer.Font;
    } catch {
      // In pure ESM without Font passed yet, do nothing until passed
      return;
    }
  }

  if (!fontObj || typeof fontObj.register !== 'function') {
    isRegistered = true;
    return;
  }

  if (typeof fontObj.getRegisteredFontFamilies === 'function') {
    const existing = fontObj.getRegisteredFontFamilies();
    if (Array.isArray(existing) && existing.includes('NotoSansDevanagari')) {
      isRegistered = true;
      return;
    }
  }

  try {
    const regularFont = resolveFontPath('NotoSansDevanagari-Regular.ttf');
    const boldFont = resolveFontPath('NotoSansDevanagari-Bold.ttf');

    fontObj.register({
      family: 'NotoSansDevanagari',
      fonts: [
        { src: regularFont, fontWeight: 400, fontStyle: 'normal' },
        { src: boldFont, fontWeight: 700, fontStyle: 'normal' },
      ],
    });

    if (typeof fontObj.registerHyphenationCallback === 'function') {
      fontObj.registerHyphenationCallback((word: string) => [word]);
    }
  } catch (err) {
    // If font files are not on disk in lightweight test environments, don't crash
  }

  isRegistered = true;
}
