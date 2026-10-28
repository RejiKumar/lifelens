declare const __dirname: string;

const fs = require('node:fs') as {
  existsSync: (p: string) => boolean;
  readdirSync: (p: string, opts?: { withFileTypes?: boolean }) => { name: string; isDirectory(): boolean }[];
  readFileSync: (p: string, encoding: 'utf8') => string;
};
const path = require('node:path') as {
  resolve: (...segments: string[]) => string;
  join: (...segments: string[]) => string;
  relative: (from: string, to: string) => string;
};

const projectRoot = path.resolve(__dirname, '..', '..');

const redesignedDirs = ['src/components/ui'];

const redesignedFiles = [
  'src/app/(tabs)/_layout.tsx',
  'src/app/(tabs)/index.tsx',
  'src/app/(tabs)/history.tsx',
  'src/app/(tabs)/settings.tsx',
  'src/app/camera.tsx',
  'src/app/preview.tsx',
  'src/app/analysis/[id].tsx',
  'src/app/onboarding.tsx',
  'src/app/auth/sign-in.tsx',
  'src/app/auth/sign-up.tsx',
  'src/app/auth/forgot-password.tsx',
  'src/app/auth/import-prompt.tsx',
  'src/app/auth-callback.tsx',
  'src/features/scan/presentation/ask-lifelens.tsx',
  'src/features/scan/presentation/conversation-thread.tsx',
  'src/features/scan/presentation/follow-up-composer.tsx',
  'src/features/auth/presentation/guest-banner.tsx',
  'src/features/auth/presentation/auth-prompts.tsx',
];

const rawSpacingPattern = /\b(margin|padding)(Top|Bottom|Left|Right|Vertical|Horizontal)?:\s*\d+(?:\.\d+)?/g;

function listSourceFiles(dir: string, out: string[]): void {
  const absolute = path.join(projectRoot, dir);
  if (!fs.existsSync(absolute)) return;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const full = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      listSourceFiles(path.relative(projectRoot, full), out);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(path.relative(projectRoot, full));
    }
  }
}

describe('token-only spacing', () => {
  const files: string[] = [];
  for (const dir of redesignedDirs) {
    listSourceFiles(dir, files);
  }
  files.push(...redesignedFiles);

  it('never uses raw numeric margin/padding literals in redesigned files', () => {
    const violations: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(path.join(projectRoot, file), 'utf8');
      for (const match of source.matchAll(rawSpacingPattern)) {
        if (!/^(?:margin|padding)(?:Top|Bottom|Left|Right|Vertical|Horizontal)?: 0$/.test(match[0])) {
          violations.push(`${file}: ${match[0]}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});