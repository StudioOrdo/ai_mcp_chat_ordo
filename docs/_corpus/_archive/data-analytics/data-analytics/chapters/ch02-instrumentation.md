# Chapter 2 — Instrumentation: Event Taxonomies and Data Quality

## Abstract

Everything downstream of instrumentation depends on the quality of the data collected. This chapter covers event-based analytics, taxonomy design, and the engineering discipline of clean, consistent, and complete data collection.

## Event Taxonomy Design

A well-designed event taxonomy uses consistent naming conventions:

- `page_viewed` → what the user saw
- `button_clicked` → what the user did
- `form_submitted` → what the user completed
- `error_encountered` → what went wrong

Properties should be consistent: every event includes `timestamp`, `user_id` (hashed), `session_id`, and `page_url`.

## Chapter Checklist

- Do you have a documented event taxonomy?
- Are event names consistent (same verb tense, same naming convention)?
- Is data quality monitored (missing events, malformed properties)?

---
