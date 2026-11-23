FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    GYMPULSE_DATA=/config \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py api_tokens.py workouts_plus.py social_plus.py food_plus.py guide.py import_usda.py ./
COPY static ./static

RUN mkdir -p /config
VOLUME /config
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/healthz',timeout=4).status==200 else 1)"

# One worker with threads: the timer-alert and backup helpers live inside it.
CMD ["gunicorn", "-b", "0.0.0.0:8080", "-w", "1", "--threads", "8", "--access-logfile", "-", "app:app"]
