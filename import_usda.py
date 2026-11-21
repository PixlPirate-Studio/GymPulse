#!/usr/bin/env python3
"""
Optional: load the free USDA FoodData Central database into GymPulse so food
search covers thousands of everyday foods, all offline.

1. Download "SR Legacy" (CSV) from https://fdc.nal.usda.gov/download-datasets
   and unzip it. You need food.csv, food_nutrient.csv (and optionally
   food_portion.csv).
2. Run (inside the container, or anywhere with Python):

     python import_usda.py /path/to/unzipped/folder

   By default it writes to $GYMPULSE_DATA/gympulse.db (/config/gympulse.db).
   Running it twice replaces the old USDA foods instead of duplicating them.

Values are per 100 g (the USDA's standard), which is labeled clearly in the
app as "100 g".
"""
import csv
import os
import sqlite3
import sys

ENERGY, PROTEIN, FAT, CARBS = "1008", "1003", "1004", "1005"
WANTED = {ENERGY, PROTEIN, FAT, CARBS}


def main(folder, db_path):
    food_csv = os.path.join(folder, "food.csv")
    nut_csv = os.path.join(folder, "food_nutrient.csv")
    for p in (food_csv, nut_csv):
        if not os.path.exists(p):
            sys.exit("Could not find %s" % p)

    names = {}
    with open(food_csv, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            names[row["fdc_id"]] = row["description"].strip()[:90]

    nutrients = {}
    with open(nut_csv, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            nid = row.get("nutrient_id")
            if nid in WANTED and row["fdc_id"] in names:
                try:
                    nutrients.setdefault(row["fdc_id"], {})[nid] = float(row["amount"])
                except ValueError:
                    pass

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("DELETE FROM foods WHERE source='usda'")
    count = 0
    for fid, n in nutrients.items():
        if ENERGY not in n:
            continue
        conn.execute(
            "INSERT INTO foods(owner_id,name,brand,serving,calories,protein,carbs,fat,source) "
            "VALUES(NULL,?,?,?,?,?,?,?, 'usda')",
            (names[fid], "USDA", "100 g", round(n[ENERGY], 1), round(n.get(PROTEIN, 0), 1),
             round(n.get(CARBS, 0), 1), round(n.get(FAT, 0), 1)))
        count += 1
    conn.commit()
    conn.close()
    print("Imported %d foods." % count)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    data = os.environ.get("GYMPULSE_DATA", "/config")
    main(sys.argv[1], os.path.join(data, "gympulse.db"))
