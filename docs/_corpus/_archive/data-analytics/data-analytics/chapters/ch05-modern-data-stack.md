# Chapter 5 — The Modern Data Stack: Pipelines and Warehousing

## Abstract

Data is only useful if it's accessible. This chapter covers the modern data stack: event collection, ETL pipelines, cloud data warehouses, and the transformation layer that makes raw data queryable.

## The Stack

| Layer | Purpose | Tools |
| ------- | --------- | ------- |
| Collection | Capture events | Segment, Rudderstack |
| Ingestion | Move data to warehouse | Fivetran, Airbyte |
| Warehouse | Store and query | BigQuery, Snowflake, Redshift |
| Transformation | Model and clean | dbt (data build tool) |
| Visualization | Present insights | Looker, Metabase, Superset |

## Chapter Checklist

- Is your analytics data centralized in a warehouse?
- Can non-engineers query your data?
- Is your transformation layer version-controlled?

---
