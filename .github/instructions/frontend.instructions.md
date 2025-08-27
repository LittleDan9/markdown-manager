# AI Agent Frontend Guidelines
applyTo: "frontend/**/*"

---

# React + React-Bootstrap

When writing or reviewing frontend code in this repository, AI agents must follow these rules:

1. **Modern React Only**
   - Functional components + Hooks (`useState`, `useEffect`, `useContext`).
   - No class components.

2. **React-Bootstrap First**
   - Use `<Button>`, `<Form>`, `<Navbar>`, etc.
   - Prefer props/variants over raw classes.

3. **Component Design**
   - Keep components small and single-responsibility.
   - Split presentational vs. container components.

4. **State Management**
   - Use Context, Redux, or Zustand for shared state.
   - Avoid deep prop drilling.

5. **Side Effects**
   - Place data fetching/subscriptions in `useEffect`.
   - Always declare full dependency arrays.

6. **Performance**
   - Memoize components (`React.memo`).
   - Use `useCallback` and `useMemo` for expensive computations.

7. **Code Splitting**
   - Use `React.lazy` + `<Suspense>` for heavy modules/routes.

8. **Accessibility**
   - Ensure proper ARIA roles, alt text, keyboard support.
   - Validate with `axe-core`.

9. **Quality & Testing**
   - Use TypeScript or PropTypes.
   - Configure ESLint (hooks + a11y).
   - Write Jest + RTL tests.

10. **API Integration**
    - Use `frontend/src/api` helpers for all API calls.

11. **Document Storage**
    - Use `frontend/src/storage/DocumentManager` for storage.
    - Guest → localStorage; registered user → sync to backend.

12. **User Feedback**
    - Use `NotificationProvider` for alerts, errors, successes.

13. **Development**
    - App runs at `http://localhost:3000` with HMR.
    - Test with `window.testAutoSave()` / `window.testManualSave()`.

14. **Docker Workflow**
    - Use container `markdown-manager-frontend-1`.
    - `docker compose logs frontend`, `docker compose restart frontend`.

15. **Debugging**
    - Run `docker compose ps` first.
    - Use direct ports (localhost:3000).
    - Check console errors, rely on hot reload.

> AI Agents must enforce small, accessible, and performant UI components that align with React-Bootstrap conventions.
