# Chapter 7 — Navigation and Wayfinding: Helping Users Know Where They Are

## Abstract

Navigation is the skeletal system of an interface — invisible when it works, debilitating when it fails. This chapter traces navigation design from information architecture theory through Steve Krug's *Don't Make Me Think*, breadcrumb patterns, and modern challenges like mobile hamburger menus, mega-menus, and command palettes. The principle: **the user should always know where they are, where they can go, and how to get back.**

---

## Steve Krug and Don't Make Me Think (2000)

**Steve Krug** published *Don't Make Me Think* in 2000 — the most accessible usability book ever written. His core argument is in the title: if a user has to think about how to use your interface, the design has failed.

For navigation, Krug's three key principles:

### 1. The Trunk Test

On any page, the user should be able to answer: *What site is this? What page am I on? What are the major sections? What are my options at this level? Where am I in the hierarchy? How can I search?* If any answer is unclear, the navigation has failed.

### 2. Click Conventions

Users don't read pages — they scan. Navigation must use the conventions users expect: horizontal top bar for primary navigation, vertical sidebar for secondary, breadcrumbs for hierarchy, clear active-state indicators for current position.

### 3. The Back Button

Users rely on the browser's back button as their primary undo mechanism. Navigation that breaks back-button behavior (hash routes that don't register as history entries, modals that don't create history states) violates users' most fundamental navigation expectation.

---

## Information Architecture and the Navigation Spectrum

Navigation exists on a spectrum from **structural** (the site's skeleton) to **contextual** (links and actions relevant to the current content):

| Type | Purpose | Example |
| ------ | --------- | --------- |
| Global | Available on every page | Main nav bar, footer |
| Local | Specific to a section | Sidebar within a docs section |
| Contextual | Actions related to current content | "Edit this page", "Related articles" |
| Utility | System-level actions | Search, settings, logout |
| Breadcrumb | Hierarchical position indicator | Home > Products > Category > Item |

A common failure: putting everything in global navigation. If global navigation has more than 7±2 items, it exceeds the scannability threshold and forces the user to read instead of scan.

---

## The Command Palette Pattern (2020s)

**Command palettes** (Cmd+K / Ctrl+K) combine search and navigation into a single keyboard-driven interface. Popularized by tools like VS Code, Figma, and Linear, they allow power users to navigate or act without touching the mouse.

The pattern works because it leverages **recognition** (the palette shows options as the user types) over **recall** (the user must remember where something is in the menu hierarchy). It is the ultimate expression of Krug's principle: instead of making the user think about where something is, let them type what they want and show them where it is.

---

## What This Means for Us

Navigation is the interface's structural skeleton. Users tolerate imperfect visual design far more readily than they tolerate getting lost. The hierarchy of navigation needs is: *know where I am* → *know where I can go* → *get there efficiently* → *get back easily*.

## Chapter Checklist

- Does your global navigation have 7 or fewer primary items?
- Can the user determine their current position on any page (active states, breadcrumbs)?
- Does every navigation change register as a browser history entry?
- Is there a search or command palette for keyboard-driven navigation?
- Can the user reach any page within 3 clicks from the home page?
