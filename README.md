# keyed

VLOOKUP without the formula. Drop in two spreadsheets, match them on a shared key column, and pull
a column from one into the other.

Every file is parsed in the browser. There is no backend, no accounts, no analytics, and the app
makes no network calls of any kind — once the page has loaded, nothing about your data leaves the
tab. Fonts are bundled with the app rather than fetched from a CDN so that stays true.

## What it does

1. **Sources** — drag in a base file (the one that gets the new column) and a lookup file (the one
   the values come from). CSV, TSV, XLSX and XLS. Multi-sheet workbooks get a sheet picker, and
   default to the sheet with the most rows.
2. **Keys** — pick the match column on each side and the column to pull across. Every option shows
   sample values so you can tell one `ID` from another. If both files share a column name, the pair
   is chosen for you.
3. **Preview** — the first ten rows of the result, with the new column appended and highlighted.
   Problems appear above it as dismissible notices, never as blockers.
4. **Result** — match rate, matched and unmatched counts, and downloads for the merged file and for
   the unmatched base rows on their own. The download format follows the base file: CSV in, CSV out,
   with the original delimiter and BOM preserved.

### Matching rules

Three switches, all on by default:

| Switch | Effect |
| --- | --- |
| Trim whitespace | `" 123 "` matches `"123"` |
| Ignore case | `"AB-1"` matches `"ab-1"` |
| Coerce numbers | `"00123"` matches `123` |

Numeric coercion is done on the digits rather than through `Number()`, so a 20-digit account number
is not rounded into a different key.

When a key appears more than once in the lookup file, **the first match wins** — in file order — and
a notice says how many rows were ignored. There is no fuzzy matching.

### Notices

| Code | Means |
| --- | --- |
| `DUP-KEYS` | The lookup file has repeated keys. First match wins; the notice counts the ignored rows. |
| `EMPTY-KEY` | Rows with a blank key, listed by their row number in the original file. |
| `NUM-AS-TEXT` | The two key columns disagree about whether the key is a number or text, or the keys carry leading zeros. Says whether coercion is currently rescuing it. |
| `NAME-CLASH` | The base file already has a column by that name, so the pulled column was renamed instead of overwriting it. |

### Awkward files it handles

- UTF-8 BOM, preserved on export
- Semicolon-, tab- and pipe-delimited CSVs, detected and preserved on export
- Blank or title rows before the header row
- Files that mix `\n` and `\r\n` line endings
- Blank header cells, which become `Column D` and so on
- Duplicate header names, which are suffixed rather than merged
- ~50k rows: parsing and file building run in a web worker, so the page stays responsive

## Local development

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # merge, normalisation and parser tests
npm run lint
npm run build      # type-check, then build to dist/
npm run preview    # serve the production build locally
```

## Deploying to Vercel

The app is a static build with no server side, so the defaults work.

**From the dashboard:** import the repository. Vercel detects Vite and fills in Build Command
`npm run build` and Output Directory `dist`. No environment variables are needed.

**From the CLI:**

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production
```

`vercel.json` pins the framework and adds cache headers for the hashed asset bundle. The app is a
single page with no client-side routing, so no rewrites are required.

## How it is put together

```
src/
  lib/
    normalize.ts   key normalisation (trim / case / precision-safe numeric coercion)
    merge.ts       the join, first-match-wins, and the diagnostics behind each notice
    parse.ts       CSV and workbook parsing: BOM, delimiters, header detection, column profiling
    export.ts      CSV and XLSX output, matching the base file's format
    workerClient.ts  promise wrapper around the worker
  workers/
    sheet.worker.ts  parsing and file building, off the main thread
  components/    one component per part of the panel; MatchComb.tsx is the match-rate view
```

Logic in `src/lib` is pure and covered by `src/lib/merge.test.ts`; the components hold no
matching rules of their own.

### A note on the SheetJS dependency

`xlsx` on the npm registry is pinned at `0.18.5`, which carries two published advisories. SheetJS
publishes patched builds from its own CDN rather than npm, and that host is unreachable from this
project's build environment, so the registry version is what is installed here.

Both advisories are mitigated in how the library is called: workbooks are read as arrays of arrays
(`sheet_to_json` with `header: 1`), never as objects keyed by cell content, which is the path the
prototype-pollution advisory concerns. If your environment can reach `cdn.sheetjs.com`, prefer:

```bash
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

No other code changes are needed.
