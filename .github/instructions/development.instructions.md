---
applyTo: '**'
---
Use the `Makefile` to run the development commands (make dev, make status, make stop)
Do not rebuild the frontend since the dev servers should reload on file change.
DO not rebuild the backend as Uvicorn is watching for changes.
Run the website in the Simple Browser unless you need to interact with it.
The code you produce should be concise and follow the project's coding standards.
If I accept your code, I will commit it to git and push it to the repository.
Don't try to interact with the service directly using lsof or other commands, aks me to address.
Ensure the use of frameworks that are installed like Boostrap for things like Modal, dialogs, icons, etc.
If you need to add a new dependency, ask fist.
Production deployment runs at https://littledan.com. Use this in simple browser for testing production deployments.
backend code is using poetry for dependency management.
frontend code is using npm for dependency management.
When need to run command in the terminal that need run in a folder within root, use pushd and popd to ensure the terminal remains in the root directory.
Always use linting rules and formatting rules that are already in place.
Correct linting issues on any file you touch.