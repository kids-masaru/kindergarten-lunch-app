import pandas as pd
import os

base_path = r"c:\Users\HP\OneDrive\ドキュメント\mamameal\kindergarten-lunch-app"
files = [
    "メニュー表2026.2 -2.xlsx",
    "幼稚園新聞2026.2.xlsx",
    "配膳給食　2026.2-1.xlsx"
]

def detailed_inspect(filename):
    path = os.path.join(base_path, filename)
    print(f"\n===== {filename} =====")
    try:
        xl = pd.ExcelFile(path)
        print(f"Sheets: {xl.sheet_names}")
        for sheet in xl.sheet_names[:5]: # Check first 5 sheets max
            print(f"\n--- Sheet: {sheet} ---")
            df = pd.read_excel(xl, sheet_name=sheet, nrows=20) # Read 20 rows to handle headers not being on row 0
            print("Headers (Row 0):", df.columns.tolist())
            print("Data Head (First 5 rows):")
            print(df.head(5).to_string())
            
            # Check for nutrition keywords
            nutrition_cols = [c for c in df.columns if any(k in str(c) for k in ["kcal", "エネルギー", "たんぱく", "タンパク", "塩分", "脂質"])]
            if nutrition_cols:
                print("Found Nutrition related columns:", nutrition_cols)
            
            # Simple check in content too
            content_str = df.to_string().lower()
            if "kcal" in content_str or "エネルギー" in content_str:
                 print("Found 'kcal' or 'エネルギー' in content string.")

    except Exception as e:
        print(f"Error inspecting {filename}: {e}")

for f in files:
    detailed_inspect(f)
