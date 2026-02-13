import os
import pandas as pd
import numpy as np
import pytest

from app.data_analysis import (
    load_data,
    clean_macros,
    add_ratios,
    calculate_insights,
    DIET,
    RECIPE,
    CUISINE,
    PROTEIN,
    CARBS,
    FAT,
)


# ---------- Test Data Fixture ----------

@pytest.fixture
def sample_df():
    data = {
        DIET: ["Keto", "Vegan", "Keto", "Vegan"],
        RECIPE: ["A", "B", "C", "D"],
        CUISINE: ["Italian", "Mexican", "Italian", "Thai"],
        PROTEIN: [30, 10, 40, 15],
        CARBS: [5, 50, 0, 45],
        FAT: [20, 5, 25, 3],
    }
    return pd.DataFrame(data)


# ---------- load_data ----------

def test_load_data(tmp_path):
    test_file = tmp_path / "test.csv"
    df_original = pd.DataFrame({" A ": [1, 2]})
    df_original.to_csv(test_file, index=False)

    df = load_data(test_file)

    assert "A" in df.columns  # whitespace stripped




# ---------- add_ratios ----------

def test_add_ratios_handles_zero_division(sample_df):
    df = add_ratios(sample_df.copy())

    assert "Protein_to_Carbs_ratio" in df.columns
    assert "Carbs_to_Fat_ratio" in df.columns

    # row with zero carbs should give ratio 0
    zero_carbs_row = df[df[CARBS] == 0].iloc[0]
    assert zero_carbs_row["Protein_to_Carbs_ratio"] == 0


# ---------- calculate_insights ----------

def test_calculate_insights_returns_expected_types(sample_df):
    avg_macros, top_protein, best_diet, best_protein, cuisine_counts = (
        calculate_insights(sample_df)
    )

    assert isinstance(avg_macros, pd.DataFrame)
    assert isinstance(top_protein, pd.DataFrame)
    assert isinstance(best_diet, str)
    assert isinstance(best_protein, float)
    assert isinstance(cuisine_counts, pd.DataFrame)


def test_best_diet_correct(sample_df):
    avg_macros, _, best_diet, _, _ = calculate_insights(sample_df)

    # Keto has higher average protein in sample data
    assert best_diet == "Keto"
