---
applyTo: 'frontend/**/*'
---

# React-Bootstrap Senior Engineer Guidelines

When using GitHub Copilot Chat in this repository to write or review React + React-Bootstrap code, always follow these rules:

1. **Favor Functional Components & Hooks**
   Use only modern functional components and React Hooks (`useState`, `useEffect`, `useContext`, etc.)—no class components.

2. **Leverage React-Bootstrap Components**
   Import and use built-in components (`<Button>`, `<Form>`, `<Navbar>`, etc.) rather than manually applying CSS classes.

3. **Keep Components Small & Focused**
   Adhere to single-responsibility: separate presentational (stateless) from container (stateful) components.

4. **Use Props & Variants for Styling**
   Customize UI via component props (e.g. `<Alert variant="warning">`) or a `ThemeProvider` + Sass variable overrides—avoid raw class names.

5. **Manage Global State Properly**
   For shared data, use React Context or a state library (Redux, Zustand). Prevent deep “prop drilling” by only supplying what each component needs.

6. **Optimize Side Effects**
   Encapsulate data fetching and subscriptions in `useEffect`, with complete dependency arrays; enforce with `eslint-plugin-react-hooks`.

7. **Prevent Unnecessary Renders**
   Memoize pure components with `React.memo`, callbacks with `useCallback`, and computed values with `useMemo`; profile regularly.

8. **Code-Split & Lazy-Load**
   Use `React.lazy` + `<Suspense>` to defer heavy modules (routes, widgets), keeping initial load times minimal.

9. **Ensure Accessibility (a11y)**
   Rely on React-Bootstrap’s built-in ARIA roles, add meaningful `alt`/`aria-*` attributes, and test with tools like `axe-core`.

10. **Enforce Quality with Type-Checking & Testing**
    Adopt TypeScript or PropTypes, configure ESLint (hooks + a11y plugins), and write behavior-driven tests with Jest + React Testing Library.

11. **Understand API Integration**
    All API calls should be made using the frontend/src/api helper libraries. This ensures consistency and maintainability across the codebase.

12. **Management of Document Storage**
    Use the `frontend/src/storage/DocumentManager` module for all document storage operations. This module provides a consistent interface for managing documents, ensuring that all storage operations are handled uniformly across the application. The system is now modular with separate services for local storage, sync, and event handling.

13. **Localstorage vs Backend Storage**
    Everything a user does can be stored in localstorage, but the data should be synchronized regularly and before logout. If the user is a guest, their information should be stored in localstorage. Once they register and login, their data should be migrated to the backend. If a user logs out the UI should be reset to default state and all localstorage data should be cleared.

14. **User Feedback is Important**
    Use the `frontend/src/components/NotificationProvider` module to provide user feedback. This includes notifications, alerts, successes, and any other user-facing messages. Ensure that all feedback is clear, concise, and actionable. Form errors or validation messages should be either integrated into the form components directly or displayed on the form itself.


