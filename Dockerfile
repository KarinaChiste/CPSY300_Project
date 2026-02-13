FROM python:3.9-slim

WORKDIR /app

COPY . .

RUN pip install pandas numpy matplotlib seaborn

CMD ["python", "data_analysis.py"]
