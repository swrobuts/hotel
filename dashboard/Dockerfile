# Hotel Booking Demand – Dashboard: ein Container für Backend und Frontend
#
# Bauen (aus dem Ordner dashboard/):  docker build -t hotel-dashboard .
# Starten:                            docker run -p 8765:8000 hotel-dashboard
# Prüfen:                             http://localhost:8765/health

# 1. Basis-Image: schlankes Linux mit Python 3.12
FROM python:3.12-slim

# 2. Arbeitsverzeichnis im Container
WORKDIR /app

# 3. Erst die Abhängigkeiten installieren. Diese Schicht wird nur neu gebaut,
#    wenn sich requirements.txt ändert.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Dann den Code kopieren (was nicht mitkommen soll, steht in .dockerignore)
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# 5. Port dokumentieren und Server starten.
#    ${PORT:-8000}: Render setzt die Umgebungsvariable PORT, lokal gilt 8000.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
