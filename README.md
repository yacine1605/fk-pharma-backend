# FK Pharma Backend

A TypeScript/Express backend for automating pharmaceutical supplier-offer processing, document extraction, validation, and reporting.

## What it does

- ingests supplier messages and attachments through IMAP
- queues asynchronous analysis jobs with BullMQ and Redis
- extracts structured data from PDF, Word, image, and spreadsheet documents
- supports OCR workflows with Tesseract.js
- stores users, suppliers, offers, and responses in PostgreSQL
- validates data before persistence
- generates Excel/PDF outputs and business summaries
- exposes authenticated REST endpoints

## Architecture

```text
Email / Upload
      |
      v
Express API --> BullMQ / Redis --> Document & OCR processing
      |                                |
      +------------> PostgreSQL <------+
                       |
                       v
                 Reports / Exports
```

## Technology

Node.js, Express, TypeScript, PostgreSQL, Drizzle ORM, BullMQ, Redis, IMAP, Tesseract.js, Sharp, ExcelJS, JWT, Zod, and Winston.

## Local development

Prerequisites: Node.js 20+, PostgreSQL, and Redis.

```bash
npm install
npm run db:migrate
npm run dev
```

Create a local `.env` file with the credentials required by your environment. Never commit secrets.

## Production

```bash
npm run build
npm start
```

## Project highlight

This is a complete business workflow rather than a standalone model demo: ingestion, background processing, validation, persistence, status tracking, and export are connected in one pipeline.
