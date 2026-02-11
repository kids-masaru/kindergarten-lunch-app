import pandas as pd
import sys

try:
    file_path = "メニュー表2026.2 -2.xlsx"
    print(f"Opening {file_path}")
    df = pd.read_excel(file_path, sheet_name='原紙', header=None, nrows=20)
    
    print("--- Col 0 (Date?) values ---")
    for i, val in enumerate(df.iloc[:, 0]):
        print(f"Row {i}: {val} (Type: {type(val)})")
        
    print("\n--- Col 1 (Menu?) values ---")
    for i, val in enumerate(df.iloc[:, 1]):
        print(f"Row {i}: {val}")

except Exception as e:
    print(f"Error: {e}")
