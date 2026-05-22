## Context

The Tochka transaction mapping in `src/preview/tochka.ts` uses hardcoded MCC and description checks to categorize transactions for Honey Money. With the introduction of `tochka_mapping.txt`, we have a structured set of mappings that includes both MCCs and merchant titles.

## Goals / Non-Goals

**Goals:**
- Port the mappings from `tochka_mapping.txt` into `src/preview/tochka.ts`.
- Expand the mapping logic to support title-based keyword matching alongside MCC matching.
- Maintain existing logic and ensure non-matching transactions still return `null` category.

**Non-Goals:**
- Converting `tochka_mapping.txt` into a runtime JSON configuration file (keeping it in code for simplicity as per user preference).
- Changing the synchronization or preview CLI flow.

## Decisions

### Decision 1: Mapping Logic Expansion
We will refactor `mapTochkaCategory` to use two lookup objects: `MCC_MAP` and `TITLE_KEYWORDS`.
- **MCC_MAP**: Direct lookup for MCC strings.
- **TITLE_KEYWORDS**: A list or record of keywords to search for in the transaction title.

**Rationale**: This separation allows for clear prioritization (MCC first) and explicit handling of title matches.

### Decision 2: Hardcoding vs. External Config
The mappings will be updated directly in the TypeScript source for now.
- **Rationale**: Keeps operational overhead low and avoids file I/O in the hot path of record normalization.

## Risks / Trade-offs

- **[Risk] Title Overlap**: Broad title keywords might match incorrectly. -> **Mitigation**: Use specific keywords from the mapping file and prioritize MCC.
- **[Risk] Code Bloat**: Adding many mappings directly in the function makes it long. -> **Mitigation**: Define the mapping constants outside the function.

## Engineering Constraints

- **Type Safety**: New constants should be strictly typed (e.g., `Record<string, string>`).
- **Performance**: Use direct lookups (`O(1)`) for MCCs and simple `includes()` for titles.
