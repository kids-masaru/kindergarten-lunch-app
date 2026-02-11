import pandas as pd
import os

files = [
    "メニュー表2026.2 -2.xlsx",
    "幼稚園新聞2026.2.xlsx",
    "配膳給食　2026.2-1.xlsx"
]

base_path = r"c:\Users\HP\OneDrive\ドキュメント\mamameal\kindergarten-lunch-app"

def inspect_excel(filename):
    path = os.path.join(base_path, filename)
    print(f"\n--- Inspecting: {filename} ---")
    try:
        # Load workbook just to get sheet names without loading all 21MB data
        xl = pd.ExcelFile(path)
        print(f"Sheet Names: {xl.sheet_names}")
        
        for sheet_name in xl.sheet_names[:3]: # Look at first 3 sheets
            print(f"\n[Sheet: {sheet_name}]")
            # Read first few rows to see headers/content
            df = pd.read_excel(xl, sheet_name=sheet_name, nrows=10)
            print(df.head())
            print("\nColumns:", df.columns.tolist())
            
    except Exception as e:
        print(f"Error inspecting {filename}: {e}")

for f in files:
    inspect_excel(f)
