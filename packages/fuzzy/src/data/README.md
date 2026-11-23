# OpenBeerDB snapshot

`openbeerdb.json` contains selected records from the December 2011 [Open Beer Database CSV export](https://openbeerdb.com/files/openbeerdb_csv.zip). Attribution: Open Beer Database contributors. The upstream database and this extracted database are offered under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Rights in the individual contents are licensed under the [Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/). The unmodified source is available at [OpenBeerDB](https://openbeerdb.com/).

Each row contains the original ID, a display name qualified by the brewery when needed, an optional unambiguous shorter name, ABV percent, and an ISO country code if mapped. The extract joins beer and brewery names, drops entries without a usable strength, excludes duplicates, and omits descriptions and brewery contact information. ABV is the source's historical value. The app uses an editable 330 ml serving for these beers because the dataset does not specify packaging. A listing is not evidence that a beer is still being made.

## Index maintenance

Run `pnpm catalogue:index` after editing catalogue names or replacing the data snapshot. The app bundles the sorted name indexes for exact and prefix lookups and works offline. `pnpm check` checks that both artefacts are current. `openbeerdb-index.json` is an index of the extracted OpenBeerDB data and is distributed on the same terms. Imported entries match by exact name in the order parser and by prefix in catalogue search. Fuzzy matching remains enabled for the curated catalogue and locally learned names.

## IBA cocktails

The IBA-derived drink entries in `mixes.ts` use ingredient measures from
[rasmusab/iba-cocktails](https://github.com/rasmusab/iba-cocktails/tree/main/iba-web)
as reference data. See [MIT notice](./iba-cocktails-LICENSE.txt). Strengths and
volumes are estimates based on example ingredient strengths and dilution.
