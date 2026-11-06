# Dockerfile
FROM python:3.13.3-slim

RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    libssl-dev \
    build-essential \
    pkg-config \
    && apt-get clean

WORKDIR /app

COPY . /app

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

EXPOSE 5000

# O servidor do Flask é só para desenvolvimento; publicado, quem atende é o gunicorn.
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 app:app"]
