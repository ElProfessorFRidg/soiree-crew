"""Build a catalogue snapshot from Open Food Facts or OLCC product data."""

import argparse
import csv
import gzip
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


DATA = Path(__file__).parent / "src" / "data"
ALCOHOL = {"alcoholic-beverages"}
SOFT = {
    "soft-drinks", "juices-and-nectars", "fruit-juices", "waters", "energy-drinks",
    "sports-drinks", "iced-teas", "plant-milks", "non-alcoholic-beers",
    "non-alcoholic-wines", "non-alcoholic-cocktails", "milkshakes", "smoothies",
}
SPIRIT = {"distilled-beverages", "hard-liquors", "spirits", "liqueurs", "eaux-de-vie"}
MIX = {"alcoholic-cocktails", "cocktails", "alcopops", "ready-to-drink-cocktails"}
DEFAULT_ML = {"beer": 330, "wine": 125, "spirit": 40, "cocktail": 150, "cider": 250, "soft": 250}
MAX_ABV = {"beer": 16, "wine": 22, "spirit": 80, "cocktail": 40, "cider": 12, "soft": 0}
PACKAGE = re.compile(r"\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l|litres?|liters?|fl\s*oz)\b", re.I)
MULTIPACK_VOLUME = re.compile(r"\b\d+\s*[x×]\s*" + PACKAGE.pattern.removeprefix(r"\b"), re.I)
INVALID_SOFT = ("concentrate", "powder", "syrup", "kombucha", "fermented", "vinegar", "tea-bags",
                "pet-", "baby-", "instant-", "beverage-preparations", "condensed")


def number(value):
    try:
        return float((value or "").replace(",", "."))
    except ValueError:
        return None


def key(value):
    text = "".join(char for char in unicodedata.normalize("NFD", value.lower())
                   if not unicodedata.combining(char))
    return " ".join(re.findall(r"[^\W_]+", text))


def clean(value):
    return " ".join((value or "").split())


def package_volume(quantity):
    multipack = MULTIPACK_VOLUME.search(quantity)
    sizes = PACKAGE.findall(quantity)
    if not multipack and len(sizes) != 1:
        return None
    amount, unit = multipack.groups() if multipack else sizes[0]
    unit = unit.lower()
    factor = 1 if unit == "ml" else 10 if unit == "cl" else 29.5735 if unit.startswith("fl") else 1000
    volume = round(number(amount) * factor)
    return volume if 30 <= volume <= 2000 else None


def group_for(tags, abv):
    if abv is None or abv == 0:
        if tags & SOFT and not tags & ALCOHOL and not any(
            part in tag for tag in tags for part in INVALID_SOFT
        ):
            return "soft"
        return None
    if tags & MIX:
        return "cocktail"
    if tags & {"ciders", "perries", "hard-ciders"}:
        return "cider"
    if tags & {"beers", "beer-based-drinks", "shandies"}:
        return "beer"
    if tags & SPIRIT:
        return "spirit"
    if tags & {"wines", "sparkling-wines", "vermouths", "meads", "sakes", "fortified-wines"}:
        return "wine"
    return None


def products(stream):
    # Unneeded columns stay in the temporary input. Only catalogue fields are emitted.
    csv.field_size_limit(8 * 1024 * 1024)
    reader = csv.reader(stream, delimiter="\t")
    header = next(reader)
    code, name, brand, quantity, tags, alcohol, errors = (
        header.index(field) for field in (
            "code", "product_name", "brands", "quantity", "categories_tags", "alcohol_100g",
            "data_quality_errors_tags",
        )
    )
    for row in reader:
        if len(row) != len(header) or "beverage" not in row[tags]:
            continue
        category = {tag.removeprefix("en:") for tag in row[tags].split(",") if tag.startswith("en:")}
        abv = number(row[alcohol])
        group = group_for(category, abv)
        if group is None or not 0 <= (abv or 0) <= MAX_ABV[group]:
            continue
        if "alcohol" in row[errors] or not re.fullmatch(r"\d{8,14}", row[code]):
            continue
        label = clean(PACKAGE.sub("", MULTIPACK_VOLUME.sub("", row[name]))).strip(" ,.-–")
        maker = clean(row[brand].split(",")[0])
        if not 2 <= len(label) <= 72 or not any(char.isalpha() for char in label) or "�" in label:
            continue
        brand_key, label_key = key(maker), key(label)
        if group == "soft" and (not maker or re.search(
            r"\b(?:wine|vin|cider|cidre|vodka|whisky|rum|rhum|sangria|kombucha)\b", label_key
        )) and not category & {"non-alcoholic-beers", "non-alcoholic-wines", "non-alcoholic-cocktails"}:
            continue
        if maker and len(maker) <= 36 and f" {brand_key} " not in f" {label_key} ":
            label = f"{maker} {label}"
        if len(label) > 85 or len(key(label)) < 3:
            continue
        package = package_volume(row[quantity])
        volume = DEFAULT_ML[group]
        if group in {"beer", "cider", "cocktail", "soft"} and package and 100 <= package <= 750:
            volume = package
        if group == "soft" and package is None:
            continue
        if group == "soft":
            volume = package
        yield [row[code], label, volume, round(abv or 0, 2), group], bool(maker), package is not None


def olcc_products(stream, month):
    pack_suffix = re.compile(
        r"\s*\(?\d+\s*[- ]?\s*(?:pack|pk|cans?|btls?|bottles?)"
        r"(?:\s+(?:cans?|btls?|bottles?))?\)?$"
        r"|\s+\d+[-x×]\d+(?:ml|cl)$", re.I
    )
    for row in csv.DictReader(stream):
        if row["asofdate"][:7] != month:
            continue
        name = clean(pack_suffix.sub("", row["description"])).strip(" ,-")
        if not name or re.search(r"\b(?:variety|assorted|sampler|gift|vap)\b", name, re.I):
            continue
        proof = number(row["proof"])
        mixed = row["category"] == "COCKTAILS" or "Can" in row["containertype"]
        group = "cocktail" if mixed else "spirit"
        if proof is None or not 0 < proof / 2 <= MAX_ABV[group]:
            continue
        label = name.title().replace("'S", "'s")
        package = package_volume(row["size"])
        volume = package if group == "cocktail" and package and 100 <= package <= 750 else DEFAULT_ML[group]
        code = row["extendeditemcode"]
        if not re.fullmatch(r"\d+", code):
            continue
        yield [code, label, volume, round(proof / 2, 2), group], True, package is not None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--olcc-month", metavar="YYYY-MM", help="Read OLCC CSV for this month")
    args = parser.parse_args()
    target = "olcc-drinks" if args.olcc_month else "openfoodfacts-products"
    existing_keys = {key(name) for path in DATA.glob("*-index.json")
                     if path.name not in {"openfoodfacts-products-index.json", "olcc-index.json"}
                     for name, _ in json.loads(path.read_text())}
    existing_codes = set()
    if not args.olcc_month:
        existing_codes.update(code for code, *_ in json.loads((DATA / "openfoodfacts-drinks.json").read_text()))
    if args.olcc_month:
        # This snapshot can be built before refreshing the generated name indexes.
        existing_keys.update(key(row[1]) for row in json.loads((DATA / "openfoodfacts-products.json").read_text()))
        with args.source.open(encoding="utf-8-sig", newline="") as source:
            candidates = list(olcc_products(source, args.olcc_month))
    else:
        with gzip.open(args.source, "rt", encoding="utf-8", newline="") as source:
            candidates = list(products(source))
    candidates.sort(key=lambda item: (not item[1], not item[2], item[0][0]))

    rows = []
    for row, _, _ in candidates:
        code, label, *_ = row
        name_key = key(label)
        if code in existing_codes or name_key in existing_keys:
            continue
        existing_codes.add(code)
        existing_keys.add(name_key)
        rows.append(row)

    rows.sort(key=lambda row: row[0])
    content = ",\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in rows)
    (DATA / f"{target}.json").write_text(f"[\n{content}\n]\n", encoding="utf-8")
    print(len(rows), dict(Counter(row[4] for row in rows)))


if __name__ == "__main__":
    main()
