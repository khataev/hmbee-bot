## 1. Mapping Preparation

- [x] 1.1 Extract all MCC and Title mappings from `tochka_mapping.txt` into constants
- [x] 1.2 Identify and resolve any duplicates or conflicts in the provided mapping file

## 2. Implementation

- [x] 2.1 Define `MCC_MAP` constant in `src/preview/tochka.ts`
- [x] 2.2 Define `TITLE_MAP` constant in `src/preview/tochka.ts`
- [x] 2.3 Refactor `mapTochkaCategory` to use `MCC_MAP` lookup first
- [x] 2.4 Add title-based lookup using `TITLE_MAP` keywords to `mapTochkaCategory`
- [x] 2.5 Run `npm run check` to ensure Biome and TypeScript pass

## 3. Verification

- [x] 3.1 Verify mapping with existing tests in `src/preview.test.ts`
- [x] 3.2 (Internal) Verify with a local preview run if possible
