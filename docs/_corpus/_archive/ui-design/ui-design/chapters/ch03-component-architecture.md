# Chapter 3 — Component Architecture: From Atoms to Organisms

## Abstract

A single button is easy to design. A thousand buttons used consistently across a product is an engineering problem. This chapter traces component architecture from Brad Frost's Atomic Design through Dan Abramov's presentational/container split, Nathan Curtis's design token systems, and the modern reality of headless components and compound patterns. The principle: **components are contracts, not templates.**

---

## Brad Frost and Atomic Design (2013)

**Brad Frost** published *Atomic Design* in 2013, introducing a taxonomy that gave the industry vocabulary for component hierarchy:

- **Atoms**: the smallest indivisible UI elements — buttons, labels, inputs, icons
- **Molecules**: simple groups of atoms functioning as a unit — a search form (input + button), a label-value pair
- **Organisms**: complex UI sections composed of molecules and atoms — a navigation header, a card grid, a product listing
- **Templates**: page-level wireframes showing how organisms are arranged
- **Pages**: templates populated with real content

The taxonomy's power is not in the metaphor (chemistry) but in the *dependency direction*: atoms depend on nothing. Molecules depend on atoms. Organisms depend on molecules and atoms. Templates depend on organisms. Pages depend on templates. The dependency graph flows in one direction, and breaking that direction creates coupling problems.

### The Pattern Lab Model

Frost also created **Pattern Lab** — a tool for building and documenting component libraries. The critical insight of Pattern Lab was that a design system is not a static style guide (a PDF or a Figma file) but a *living codebase* that renders actual components in isolation. If a component works in isolation, it works anywhere. If it only works in its intended context, it is not a component — it is a fragment.

**What frustrated him:** Design teams that created beautiful mockups and engineering teams that implemented them inconsistently. He saw the problem as structural: without a shared component vocabulary, designers and engineers were describing different systems using the same words.

---

## Dan Abramov and the Presentational/Container Split (2015)

**Dan Abramov** (creator of Redux, now at Meta) wrote an influential blog post in 2015 distinguishing between two types of React components:

- **Presentational components**: concerned with *how things look*. They receive data through props, render UI, and contain no business logic or state management.
- **Container components**: concerned with *how things work*. They manage state, call APIs, and pass data down to presentational components.

This separation maps directly to the Model-View split that has governed software architecture since the 1970s. The crucial benefit: presentational components are reusable because they have no dependencies on specific data sources. A `<UserCard>` that receives `name`, `avatar`, and `role` as props can render any user from any data source.

The pattern has evolved. Abramov himself later noted that hooks reduced the need for explicit container components. But the *principle* remains: **separate what the user sees from where the data comes from.**

```tsx
// Presentational: renders UI from props, no data fetching
function UserCard({ name, avatarUrl, role }) {
  return (
    <article className="card">
      <img src={avatarUrl} alt={`${name}'s avatar`} className="card__avatar" />
      <h3 className="card__name">{name}</h3>
      <span className="card__role">{role}</span>
    </article>
  );
}
```

**What frustrated him:** Components that mixed rendering logic with data fetching, making them impossible to reuse or test in isolation.

---

## Nathan Curtis and Design Token Systems (2016)

**Nathan Curtis** of EightShapes formalized the concept of **design tokens** — named values that store the smallest design decisions (color, spacing, typography, shadow, border radius) in a platform-agnostic format.

Before tokens, design decisions were scattered: colors in Figma files, spacing in CSS, typography in component code. When a brand color changed, every file, every component, and every platform had to be updated independently.

Tokens centralize those decisions:

```css
:root {
  /* Color tokens */
  --color-primary-600: oklch(0.55 0.25 264);
  --color-surface-primary: oklch(0.98 0.005 264);

  /* Spacing tokens */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-4: 1rem;     /* 16px */
  --space-8: 2rem;     /* 32px */

  /* Typography tokens */
  --font-size-base: 1rem;
  --font-weight-semibold: 600;
  --line-height-normal: 1.6;

  /* Shadow tokens */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
```

When the brand color changes, one token changes. Every component that references `--color-primary-600` updates automatically.

Curtis also established the concept of **token tiers**:

- **Global tokens**: raw values (`--blue-600: oklch(...)`)
- **Alias tokens**: semantic names that reference global tokens (`--color-primary: var(--blue-600)`)
- **Component tokens**: component-specific references (`--btn-bg: var(--color-primary)`)

This tiering ensures that changing the brand color (alias tier) does not require changing any component code.

---

## Headless Components and the Modern Split (2020s)

The modern evolution of component architecture separates **behavior** from **styling** entirely. Libraries like **Headless UI** (Tailwind Labs), **Radix UI**, and **React Aria** (Adobe) provide components that manage interaction logic — keyboard navigation, focus management, ARIA attributes, opening/closing — without providing any visual styling.

This is the ultimate expression of the Abramov split: the component handles *how things work* (accessibility, keyboard, state), and the consuming application provides *how things look* (CSS, tokens, brand identity).

```tsx
// Headless: behavior only, no styling
import * as Dialog from '@radix-ui/react-dialog';

function ConfirmDialog({ title, description, onConfirm }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="btn btn--primary">Delete</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          <button onClick={onConfirm} className="btn btn--danger">Confirm</button>
          <Dialog.Close className="btn btn--secondary">Cancel</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

The headless library manages focus trapping, escape-to-close, screen reader announcements, and portal rendering. The application controls every pixel of visual output.

---

## What This Means for Us

Component architecture is the discipline of managing reuse at scale:

- **Frost** gave us the taxonomy (atoms → pages) and the dependency direction
- **Abramov** gave us the presentation/logic split
- **Curtis** gave us design tokens (centralized decisions)
- **Headless libraries** give us the behavior/styling split

A modern component library applies all four: tokens define the design decisions, headless components handle the interaction logic, presentational components apply the visual rendering, and the atomic taxonomy manages the complexity of composition.

## Chapter Checklist

- Are your components reusable in isolation, or do they depend on specific page context?
- Do your design tokens centralize all visual decisions (color, spacing, typography, shadow)?
- Are your components separated into behavior (logic/a11y) and presentation (visual)?
- Can you change your brand color by editing one token and have the change propagate everywhere?
- Does your component inventory follow a clear hierarchy (atoms → molecules → organisms)?
