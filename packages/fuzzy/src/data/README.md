# OpenBeerDB snapshot

`openbeerdb.json` contains selected records from the December 2011 [Open Beer Database CSV export](https://openbeerdb.com/files/openbeerdb_csv.zip). Attribution: Open Beer Database contributors. The upstream database and this extracted database are offered under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Rights in the individual contents are licensed under the [Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/). The unmodified source is available at [OpenBeerDB](https://openbeerdb.com/).

Each row contains the original ID, a display name qualified by the brewery when needed, an optional unambiguous shorter name, ABV percent, and an ISO country code if mapped. The extract joins beer and brewery names, drops entries without a usable strength, excludes duplicates, and omits descriptions and brewery contact information. ABV is the source's historical value. The app uses an editable 330 ml serving for these beers because the dataset does not specify packaging. A listing is not evidence that a beer is still being made.

## Index maintenance

Run `pnpm catalogue:index` after editing catalogue names or replacing the data snapshot. The app bundles the sorted name indexes for exact and prefix lookups and works offline. `pnpm check` checks that the generated artefacts are current. `openbeerdb-index.json` is an index of the extracted OpenBeerDB data and is distributed on the same terms. Imported entries match by exact name in the order parser and by prefix in catalogue search. Fuzzy matching remains enabled for the curated catalogue and locally learned names.

## IBA cocktails

The IBA-derived drink entries in `mixes.ts` use ingredient measures from
[rasmusab/iba-cocktails](https://github.com/rasmusab/iba-cocktails/tree/main/iba-web)
as reference data. See [MIT notice](./iba-cocktails-LICENSE.txt). Strengths and
volumes are estimates based on example ingredient strengths and dilution.

## Bar Assistant and Open Food Facts

- `bar-assistant.json` contains derived catalogue entries from [Bar Assistant Public Data](https://github.com/bar-assistant/data/tree/24a153e54078502706f7761d9cbf480f11f15a2c), under the [MIT license](./bar-assistant-LICENSE.txt). Only identifiers, drink names, estimated serving volumes, and source ABV are included. Volumes use the measured liquids, plus an estimated 20% dilution when the method is explicitly shake or stir. Entries with unquantified required liquid amounts or missing strengths were excluded.
- `openfoodfacts-drinks.json` contains names, product codes, and labelled package volumes extracted from [Open Food Facts](https://world.openfoodfacts.org/), under the [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) and [Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/). Product codes link back to `https://world.openfoodfacts.org/product/<code>`. This extraction covers selected soft drinks, juices, and waters. Products with declared alcohol, ambiguous alcohol categories, and multipacks were excluded. The listed package volume is editable.
- Each source has its own generated index, distributed under that source’s terms.

`trackcaffeine-drinks.json` contains drink names and serving volumes from
[TrackCaffeine’s dataset](https://trackcaffeine.com/dataset/), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The export is a
filtered and deduplicated subset, with brand prefixes added where needed.
The catalogue does not import caffeine amounts.

## Packaged drinks and spirits

`openfoodfacts-products.json` comes from the [Open Food Facts bulk TSV export](https://world.openfoodfacts.org/data), downloaded on 25 November 2026. The extracted database and its generated index use the same ODbL 1.0 and Database Contents License terms as the earlier Open Food Facts snapshot. A product ID is its barcode and links back to the product page. The catalogue uses the source's alcohol by volume field and explicit beverage categories. Bottled wines and spirits default to a 125 ml glass and a 40 ml pour respectively. Other products use a labelled individual size where suitable, with editable default servings when necessary. Concentrates and other preparations are excluded from the soft-drink import.

`olcc-drinks.json` contains product names, item codes, drink categories and alcohol strengths from the November 2026 [Oregon Liquor and Cannabis Commission (OLCC) Monthly Pricing dataset](https://data.oregon.gov/stories/s/OLCC-Monthly-Pricing/k34n-79ti). It excludes assorted and gift packs and omits all prices. The source's US proof divided by two is the ABV percentage. The app uses a 40 ml spirit pour and the individual container volume for ready-to-drink cocktails when supplied.

Rebuild the snapshots with Python 3.9 or later and refresh the indexes from the repository root.

```sh
python3 packages/fuzzy/import-drink-catalogue.py en.openfoodfacts.org.products.csv.gz
python3 packages/fuzzy/import-drink-catalogue.py olcc.csv --olcc-month 2026-11
pnpm catalogue:index
```

## Quality and discovery

The curated catalogue is the default popularity tier (not measured sales). For one or two characters, only curated prefixes and exact imported names are expanded. Longer searches use bounded source indexes, and the optional group filter is applied before the prefix cap. Four reviewed non-beverage Open Food Facts codes are excluded by the importer and source snapshots. Source alcohol strengths and serving sizes are estimates: verify the label when logging. Large imports remain in compact source rows; individual products are materialized on demand using binary lookup by stable source code. Full catalogue materialization is reserved for audits and build tooling.
