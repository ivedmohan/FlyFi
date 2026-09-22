FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# flybrain downloads its ~260MB prebuilt brain files to $FLY_DATA on first use if not
# already present. Baking the download into the image build (not first request) means
# cold starts don't pay for it, and it survives container restarts without needing a
# persistent volume.
ENV FLY_DATA=/app/fly-data
RUN python -m flybrain download

# Hugging Face Spaces (Docker SDK) expects the app on port 7860.
EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
