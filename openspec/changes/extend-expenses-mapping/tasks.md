## 1. Mapping Preparation

- [ ] 1.1 Extract all MCC and Title mappings from `tochka_mapping.txt` into constants
- [ ] 1.2 Identify and resolve any duplicates or conflicts in the provided mapping file

## 2. Implementation

- [ ] 2.1 Define `MCC_MAP` constant in `src/preview/tochka.ts`
- [ ] 2.2 Define `TITLE_MAP` constant in `src/preview/tochka.ts`
- [ ] 2.3 Refactor `mapTochkaCategory` to use `MCC_MAP` lookup first
- [ ] 2.4 Add title-based lookup using `TITLE_MAP` keywords to `mapTochkaCategory`
- [ ] 2.5 Run `npm run check` to ensure Biome and TypeScript pass

## 3. Verification

- [ ] 3.1 Verify mapping with existing tests in `src/preview.test.ts`
- [ ] 3.2 (Internal) Verify with a local preview run if possible
