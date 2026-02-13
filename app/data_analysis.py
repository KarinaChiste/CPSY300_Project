#Group 6, Jack Gess, data_analysis.py, 2024-06-15, Task 1

import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns


# file paths
DATA_PATH = "data/All_Diets.csv"
CHART_DIR = "charts"

# column names
DIET = "Diet_type"
RECIPE = "Recipe_name"
CUISINE = "Cuisine_type"
PROTEIN = "Protein(g)"
CARBS = "Carbs(g)"
FAT = "Fat(g)"

# makes directory for output
os.makedirs(CHART_DIR, exist_ok=True)


# load data and strip whitespace from column names
def load_data(filepath):
    df = pd.read_csv(filepath)
    df.columns = df.columns.str.strip()
    return df


# clean macros and text columns, fill missing with means
def clean_macros(df):
    # convert to numeric
    for col in [PROTEIN, CARBS, FAT]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # fills missing values with mean 
    df.fillna(df.mean(numeric_only=True), inplace=True)

    df[DIET] = df[DIET].astype(str).str.strip() # strip whitespace from diet type
    df[CUISINE] = df[CUISINE].astype(str).str.strip() # strip whitespace from cuisine type

    return df


# add ratios
def add_ratios(df):
    # stops dividing by 0
    safe_carbs = df[CARBS].replace(0, np.nan)
    safe_fat = df[FAT].replace(0, np.nan)

    df["Protein_to_Carbs_ratio"] = (df[PROTEIN] / safe_carbs).fillna(0)
    df["Carbs_to_Fat_ratio"] = (df[CARBS] / safe_fat).fillna(0)

    return df


# calculate insights
def calculate_insights(df):

    avg_macros = df.groupby(DIET)[[PROTEIN, CARBS, FAT]].mean()

    top_protein = df.sort_values(PROTEIN, ascending=False).groupby(DIET).head(5)

    #find diet with highest average protein
    best_diet = avg_macros[PROTEIN].idxmax()
    best_protein = float(avg_macros.loc[best_diet, PROTEIN])

    # most common cuisines per diet
    cuisine_counts = (
        df.groupby([DIET, CUISINE])
          .size()
          .reset_index(name="count")
          .sort_values("count", ascending=False)
          .groupby(DIET)
          .head(3)
    )

    return avg_macros, top_protein, best_diet, best_protein, cuisine_counts


# bar chart for average macros
def plot_bar(avg_macros):

    plt.figure(figsize=(12, 6))
    sns.barplot(x=avg_macros.index, y=avg_macros[PROTEIN])

    plt.title("Average Protein by Diet Type")
    plt.ylabel("Average Protein (g)")
    plt.xticks(rotation=30, ha="right") #angles text - horizontal anchor right - stop overlap
    plt.tight_layout()

    output = os.path.join(CHART_DIR, "avg_protein_bar.png")
    plt.savefig(output, dpi=200)
    plt.close()


# heatmap
def plot_heatmap(avg_macros):

    matrix = avg_macros[[PROTEIN, CARBS, FAT]].values

    plt.figure(figsize=(10, 6))
    plt.imshow(matrix, aspect="auto")
    plt.colorbar(label="Average grams")
    plt.title("Avg Macros Heatmap")
    plt.xticks([0, 1, 2], [PROTEIN, CARBS, FAT], rotation=15)
    plt.yticks(range(len(avg_macros.index)), avg_macros.index)
    plt.tight_layout()

    output = os.path.join(CHART_DIR, "avg_macros_heatmap.png")
    plt.savefig(output, dpi=200)
    plt.close()


# scatter plot - protein 
def plot_scatter(top_protein):

    plt.figure(figsize=(10, 6))
    plt.scatter(top_protein[CARBS], top_protein[PROTEIN])
    plt.title("Top Protein Recipes")
    plt.xlabel("Carbs (g)")
    plt.ylabel("Protein (g)")
    plt.tight_layout()

    output = os.path.join(CHART_DIR, "top_protein_scatter.png")
    plt.savefig(output, dpi=200)
    plt.close()


def main():
    df = load_data(DATA_PATH)
    df = clean_macros(df)
    df = add_ratios(df)

    avg_macros, top_protein, best_diet, best_protein, cuisine_counts = (
        calculate_insights(df)
    )

    print("\nFinal Results:")
    print("\naverage macros:")
    print(avg_macros.head(10).to_string())

    print(f"\nhighest protein diet: {best_diet} ({best_protein:.2f}g)")

    print("\ntop protein recipes:")
    print(top_protein.head(20)[[DIET, RECIPE, CUISINE, PROTEIN, CARBS, FAT]].to_string(index=False))

    print("\nmost common cuisines:")
    print(cuisine_counts.to_string(index=False))

    # charts
    plot_bar(avg_macros)
    plot_heatmap(avg_macros)
    plot_scatter(top_protein)

    print("\nDone. Charts saved in charts folder")


if __name__ == "__main__":
    main()
