# JuJian — Northern Taiwan Housing Project Explorer

JuJian is a map-based housing research platform for new residential projects in Northern Taiwan. The current catalogue focuses on Linkou and the Airport MRT A7 area, combining official project records, registered transaction prices, regional housing supply, nearby amenities, quality evidence, and estimated owner-occupier holding costs.

**Live site:** [jujian-north-taiwan.baka0406.chatgpt.site](https://jujian-north-taiwan.baka0406.chatgpt.site)

## What the Project Does

- Browses housing projects on an interactive map with progressive zoom levels.
- Separates presale projects and completed homes with distinct map markers.
- Shows official registered transaction prices and regional price comparisons.
- Presents Ministry of the Interior unsold-new-home statistics as regional supply context.
- Reviews traceable quality evidence without treating missing records as proof that no problem exists.
- Scores nearby amenities using route time and the number of nearby choices.
- Estimates recurring owner-occupier costs, including management fees, house tax, and land value tax.
- Supports side-by-side project comparison.

## Product Principles

- Every negative claim should be traceable to a source.
- Missing data means **insufficient information**, not **no problem**.
- Contract inspections are not presented as evidence of construction quality.
- Regional unsold-home figures are not interpreted as the sales rate of an individual project.
- Estimated project locations are clearly distinguished from verified locations.
- Price, quality, convenience, recurring cost, and data confidence remain separate instead of being collapsed into one misleading score.

## Data Sources

The project currently uses or references data from:

- Ministry of the Interior real-estate transaction and presale-project datasets
- Ministry of the Interior regional unsold-new-home statistics
- New Taipei City open data
- National Land Surveying and Mapping Center services
- OpenStreetMap contributors
- Official administrative inspection records and source links

Source coverage and publication schedules vary. The interface displays the relevant scope, date, confidence, and limitations wherever possible.

## Updating the Data

On Windows, double-click `更新建案資料.cmd` in the project root. The update pipeline will:

1. Download the latest official presale-project records and detect new or changed projects.
2. Refresh official transaction prices for Linkou and A7.
3. Update project locations, nearby amenities, and route-time enrichment.
4. Rebuild quality evidence while preserving manually reviewed records.
5. Rebuild regional housing-supply data.
6. Validate that project, price, location, amenity, quality, and supply datasets remain synchronized.

After an update, review `data/processed/update-report.json` before publishing. Running the local update does not automatically deploy the production site.

### Safe Update Rules

- A new project is added automatically only when its official identity can be matched unambiguously.
- Existing projects are not deleted just because they are temporarily absent from a new source release.
- Renames, multiple matches, and identity conflicts are reported for manual review instead of being overwritten.
- Manual location overrides in `data/manual/location-overrides.json` take priority over automated geocoding.
- Reviewed quality events, source progress, and review dates are preserved.
- Older candidates outside the initial catalogue are kept in `historicalBacklog` instead of being inserted all at once.

### Updating Regional Housing Supply

Regional supply has a single maintainable source file:

```text
data/manual/regional-supply-source.json
```

After updating the official quarterly values and source metadata, run:

```bash
npm run data:supply
```

The generator chooses current district-level data when available and falls back to county or city data with an explicit scope label when the official release does not publish an exact district value.

## Development

### Requirements

- Node.js 22.13 or later
- npm

### Setup

```bash
npm install
npm run dev
```

### Validation

```bash
npm run data:check
npm run lint
npm test
```

`npm test` builds the production application and runs the rendered-output and data-integrity tests.

### Main Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run data:update` | Run the complete safe data-update pipeline |
| `npm run data:supply` | Rebuild regional housing-supply data |
| `npm run data:check` | Validate processed datasets and cross-file consistency |
| `npm run lint` | Run ESLint |
| `npm test` | Build and run the automated test suite |

## Project Structure

```text
app/                 Application UI and interactive map
data/manual/         Human-reviewed inputs and overrides
data/processed/      Generated datasets consumed by the site
scripts/             Data ingestion, enrichment, generation, and validation
tests/               Rendered-output and data-integrity tests
.openai/hosting.json Site hosting metadata
```

## Current Scope and Limitations

- The current catalogue covers Linkou and A7; it is not yet a complete Northern Taiwan database.
- Some locations are approximate when an exact parcel or official address cannot be safely matched.
- Amenity scores depend on available OpenStreetMap data and stored route results.
- Quality evidence is limited to records that can be traced and responsibly attributed.
- The holding-cost calculator is an estimate for owner-occupiers, not a tax assessment.
- Transaction prices are historical registered transactions, not current asking prices or appraisals.

JuJian is a research and comparison tool. It does not replace a professional building inspection, legal review, tax assessment, appraisal, or on-site investigation.
