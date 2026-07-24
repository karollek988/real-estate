# BRF Scraper

Production-ready BRF (Bostadsrättsförening) annual report scraper for Swedish real estate analysis.

## Features

- Async-first architecture with Python 3.13
- Modular pipeline: Discovery → Crawl → Download → Extract → Export
- Structured logging with structlog
- Redis caching and deduplication
- Docker support for production deployment
- Comprehensive test suite

## Quick Start

### Prerequisites

- Python 3.13+
- uv (package manager)
- Redis (optional, for caching)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/brf-scraper.git
cd brf-scraper

# Install dependencies
make install

# Or with dev dependencies
make dev
```

### Configuration

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your settings
```

### Running

```bash
# Run the CLI
make run

# Or with Docker
make docker-up
```

## Development

### Setup

```bash
# Install with all extras
make dev

# Install pre-commit hooks
make pre-commit-install
```

### Code Quality

```bash
# Run all checks
make check

# Format code
make format

# Run linter
make lint

# Run type checker
make typecheck
```

### Testing

```bash
# Run all tests
make test

# Run with coverage
make test-cov

# Run specific test types
make test-unit
make test-integration
```

## Architecture

```
brf-scraper/
├── src/brf_scraper/      # Main package
│   ├── discovery/        # BRF website discovery
│   ├── crawler/          # Website crawling
│   ├── downloader/       # PDF downloading
│   ├── extractor/        # PDF data extraction
│   ├── storage/          # Data persistence
│   ├── models/           # Pydantic models
│   ├── pipeline/         # Orchestration
│   ├── exporters/        # JSON export
│   └── utils/            # Shared utilities
├── tests/                # Test suite
├── configs/              # Configuration files
├── data/                 # Runtime data
└── docker/               # Docker configuration
```

## CLI Commands

```bash
brf-scraper --help           # Show help
brf-scraper serve            # Start API server
brf-scraper crawl <url>      # Crawl a BRF website
brf-scraper db init          # Initialize database
brf-scraper db migrate       # Run migrations
```

## License

MIT
