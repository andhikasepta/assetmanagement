# Project Guidelines & Rules

## UI Standards
1. **Search Bar Placeholder**:
   - Every search bar input throughout the entire project must strictly use `placeholder="Search..."`.
   - Never use localized or verbose variants such as `"Cari sitecode..."`, `"Cari data..."`, `"Cari log..."`.
   - Use CSS classes `.table-search-input` and `.unified-search-input`.

2. **Dropdown Select Filters**:
   - Use class `.unified-filter-select` across all pages for a consistent, unified appearance.

3. **Scorecard Rating Labels**:
   - Always display full words: `Very Good`, `Good`, `Moderate`, `Poor`, `Very Poor` (do not abbreviate as `VG`, `G`, `M`, `P`, `VP`).

4. **Targetless Metrics (All Sites)**:
   - For overview cards that do not have targets, display percentage / quantity comparison against the previous period (`vs Prev`) with trend arrows (`▲` / `▼` with `+` / `-`). Do not evaluate target badges ("Tercapai" / "Tidak Tercapai").

5. **Achievement Cards Trend Comparison**:
   - For all achievement cards (Executive Summary, National, Depts, Subdepts, Site cards, and All Sites Overview), the trend arrow and percentage (`▲` / `▼` with `+` / `-`) must compare against the previous period (bulan lalu / periode sebelumnya).
   - Do NOT add any extra label or span (e.g. do not show `"vs Prev"`) on achievement cards; display only the trend arrow with `+`/`-` `%`.

