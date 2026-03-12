# Group 6, Jack Gess, app.py, Project 2 - Flask Backend API

import io
import os
import math

import pandas as pd
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from data_analysis import clean_macros, add_ratios, calculate_insights, DIET, RECIPE, CUISINE, PROTEIN, CARBS, FAT

load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Azure Blob Storage ---

def load_df_from_blob():
    connect_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    container  = os.getenv("AZURE_CONTAINER_NAME", "datasets")
    blob_name  = os.getenv("AZURE_BLOB_NAME", "All_Diets.csv")

    client      = BlobServiceClient.from_connection_string(connect_str)
    blob_client = client.get_container_client(container).get_blob_client(blob_name)
    stream      = blob_client.download_blob().readall()

    df = pd.read_csv(io.BytesIO(stream))
    df.columns = df.columns.str.strip()
    df = clean_macros(df)
    df = add_ratios(df)
    return df


# Cache the dataframe so we don't re-download on every request
_df_cache = None

def get_df():
    global _df_cache
    if _df_cache is None:
        _df_cache = load_df_from_blob()
    return _df_cache


# --- Helper ---

def filter_by_diet(df, diet_param):
    if diet_param:
        df = df[df[DIET].str.lower() == diet_param.lower()]
    return df


# --- Routes ---

@app.route("/api/nutritional-insights", methods=["GET"])
def nutritional_insights():
    """Average macronutrients per diet type."""
    df = get_df()
    diet = request.args.get("diet")
    df = filter_by_diet(df, diet)

    avg = df.groupby(DIET)[[PROTEIN, CARBS, FAT]].mean().round(2)
    result = avg.reset_index().to_dict(orient="records")
    return jsonify(result)


@app.route("/api/recipes", methods=["GET"])
def recipes():
    """Paginated recipe list, optionally filtered by diet type."""
    df = get_df()
    diet     = request.args.get("diet")
    page     = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    df = filter_by_diet(df, diet)

    total   = len(df)
    pages   = math.ceil(total / per_page)
    start   = (page - 1) * per_page
    end     = start + per_page

    subset = df[[DIET, RECIPE, CUISINE, PROTEIN, CARBS, FAT]].iloc[start:end]
    return jsonify({
        "page": page,
        "pages": pages,
        "total": total,
        "recipes": subset.to_dict(orient="records")
    })


@app.route("/api/clusters", methods=["GET"])
def clusters():
    """Top 3 cuisines per diet type."""
    df = get_df()
    _, _, _, _, cuisine_counts = calculate_insights(df)
    result = cuisine_counts.to_dict(orient="records")
    return jsonify(result)


@app.route("/api/chart/bar", methods=["GET"])
def chart_bar():
    """Bar chart data: average protein per diet type."""
    df = get_df()
    avg = df.groupby(DIET)[[PROTEIN, CARBS, FAT]].mean().round(2)
    return jsonify({
        "labels": avg.index.tolist(),
        "protein": avg[PROTEIN].tolist(),
        "carbs":   avg[CARBS].tolist(),
        "fat":     avg[FAT].tolist(),
    })


@app.route("/api/chart/scatter", methods=["GET"])
def chart_scatter():
    """Scatter plot data: top 5 protein recipes per diet type."""
    df = get_df()
    top = df.sort_values(PROTEIN, ascending=False).groupby(DIET).head(5)
    return jsonify({
        "points": top[[DIET, RECIPE, PROTEIN, CARBS]].to_dict(orient="records")
    })


@app.route("/api/chart/heatmap", methods=["GET"])
def chart_heatmap():
    """Heatmap data: avg macros matrix per diet type."""
    df = get_df()
    avg = df.groupby(DIET)[[PROTEIN, CARBS, FAT]].mean().round(2)
    return jsonify({
        "diets":   avg.index.tolist(),
        "protein": avg[PROTEIN].tolist(),
        "carbs":   avg[CARBS].tolist(),
        "fat":     avg[FAT].tolist(),
    })


@app.route("/api/chart/pie", methods=["GET"])
def chart_pie():
    """Pie chart data: recipe count per diet type."""
    df = get_df()
    counts = df.groupby(DIET).size().reset_index(name="count")
    return jsonify({
        "labels": counts[DIET].tolist(),
        "counts": counts["count"].tolist(),
    })


@app.route("/api/diet-types", methods=["GET"])
def diet_types():
    """All unique diet types (for the dropdown filter)."""
    df = get_df()
    types = sorted(df[DIET].unique().tolist())
    return jsonify(types)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
