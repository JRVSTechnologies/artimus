# Data: <feature name>
Slug: `<slug>` · Author: data-engineer · Status: DRAFT | APPROVED

## Decision
Store needed: YES | NO
<If NO: one line why the existing schema covers this. Stop here.>

## Store type
<Postgres (default) | + Redis | + search index | + object storage | + queue | + time-series | + vector. One paragraph why, and what was rejected.>

## Schema
<Tables/columns/relations, or "no schema change.">

## Migration
<File path, rollback notes.>

## Indexes
<What's indexed, and the query pattern each one serves.>

## Data lifecycle
<Retention, deletion, PII handling.>
