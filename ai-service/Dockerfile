FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY detection.py .

ENV VIDEO_SOURCE=0
ENV API_URL=http://backend:5000/api/events
ENV CAMERA_ID=CAM_01
ENV CROWD_THRESHOLD=20

CMD ["python", "detection.py"]
