import pandas as pd
import os

base_path = r"c:\Users\HP\OneDrive\ドキュメント\mamameal\kindergarten-lunch-app"
files = [
    "メニュー表2026.2 -2.xlsx",
    "幼稚園新聞2026.2.xlsx",
    "配膳給食　2026.2-1.xlsx"
]

output_file = os.path.join(base_path, "excel_analysis_output.txt")

with open(output_file, "w", encoding="utf-8") as f_out:
    for f in files:
        path = os.path.join(base_path, f)
        f_out.write(f"\n{'='*20} {f} {'='*20}\n")
        try:
            xl = pd.ExcelFile(path)
            f_out.write(f"Sheets: {xl.sheet_names}\n")
            
            for sheet in xl.sheet_names:
                df = pd.read_excel(xl, sheet_name=sheet, nrows=10)
                f_out.write(f"\n--- Sheet: {sheet} ---\n")
                f_out.write(f"Columns: {df.columns.tolist()}\n")
                f_out.write(f"Rows:\n{df.head(5).to_string()}\n")
                
                # Check for nutrition
                if any(k in df.to_string() for k in ["kcal", "エネルギー", "たんぱく", "タンパク", "塩分", "脂質"]):
                    f_out.write(">> Nutrition Info found in this sheet.\n")

        except Exception as e:
            f_out.write(f"Error: {e}\n")

print(f"Analysis saved to {output_file}")
