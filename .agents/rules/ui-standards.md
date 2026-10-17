# UI Standards and Conventions

## Search Bar Standards
- **Placeholder**: All search bars across all pages (Summary, All Summary, Master Data, History & Log, modals, tables) MUST strictly use the placeholder text:
  ```html
  placeholder="Search..."
  ```
  Do not use localized or specific placeholder variants like `"Cari sitecode..."`, `"Cari data..."`, `"Cari log..."`, etc.
- **Styling**: Always apply classes `.table-search-input` and `.unified-search-input` for consistent border, padding, height (34px), border-radius (6px), and focus styles.

## Dropdown Filters
- **Styling**: Use `.unified-filter-select` on all select controls for unified font size (12px), height (34px), and padding across pages.

## Labeling Conventions
- **Rating Labels**: Use full formal words instead of abbreviations:
  - `Very Good` (not `VG`)
  - `Good` (not `G`)
  - `Moderate` (not `M`)
  - `Poor` (not `P`)
  - `Very Poor` (not `VP`)

## Targetless Comparison Metrics
- For summary cards that do not have fixed targets (such as **All Sites** consolidated metrics), do not render target evaluation badges ("Tercapai" / "Tidak Tercapai").
- Instead, compare against the previous period with `+` or `-` and arrow indicators (`▲` or `▼` with `vs Prev`).
