# CLAUDE.md

## Project Overview
PizzaDoughWeb is a Flask web app for pizza dough calculation, batch tracking, bake history, and reminder notifications. It serves server-rendered HTML pages, exposes JSON API routes, stores data in SQLite, and runs scheduled reminder checks with APScheduler.

This project is often developed while SSH-ed into a small Linux laptop. Because of that, local browser testing on the SSH host is usually inconvenient. For manual webapp validation, prefer deploying a Docker container to the Unraid server and opening it from another machine on the network.

## Stack
- Python 3.12
- Flask
- Flask-SQLAlchemy
- Flask-APScheduler
- SQLite database in `instance/pizzadough.db`
- Server-rendered templates plus static assets
- Docker for packaging and Unraid deployment

## Architecture
- Entry point: `app.py`
- Data models: `models.py`
- Dough calculator logic: `dough.py`
- Notification delivery: `notifications.py`
- Templates: `templates/`
- Static assets: `static/`
- Runtime data: `instance/`

## Key Commands
```bash
# Local run if needed
python -m flask --app app run --host=0.0.0.0 --port=5099

# Install dependencies
pip install -r requirements.txt

# Build container
docker build -t pizzadoughweb:dev .

# Deploy test container to Unraid for browser validation
docker save pizzadoughweb:dev | ssh root@192.168.68.120 docker load
ssh root@192.168.68.120 docker stop pizzadoughweb || true
ssh root@192.168.68.120 docker rm pizzadoughweb || true
ssh root@192.168.68.120 docker run -d \
  --name pizzadoughweb \
  -p 5099:5099 \
  -v /mnt/user/appdata/PizzaDoughWeb:/app/instance \
  pizzadoughweb:dev
```

## Deployment Notes
- Unraid host: `root@192.168.68.120`
- Manual browser testing should usually happen against the Unraid-hosted container
- Keep persistent app data under `/mnt/user/appdata/PizzaDoughWeb`
- Prefer plain `docker run` commands for Unraid-oriented instructions
- Do not assume services bound only to the SSH host are easy for the user to inspect

## Crew
- `planner`: spec first
- `fixer`: implementation
- `cleaner`: review
- `ghost`: tests
- `librarian`: release work

## Constraints
- Keep changes aligned with the existing Flask app structure unless a refactor is requested
- Preserve SQLite compatibility and data in `instance/`
- Do not hardcode notification secrets or webhook tokens
- For UI and integration changes, include Unraid deployment verification steps
