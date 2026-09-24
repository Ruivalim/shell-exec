# Shell Exec for Backstage

A custom Backstage scaffolder action to execute shell commands and scripts during template scaffolding.

## What

This action allows you to run shell commands, bash scripts, or any executable during your Backstage software template execution. It captures stdout/stderr and provides proper error handling.

## Why

Use this action when you need to:

- Run setup scripts (e.g., configure Azure DevOps, GitHub, cloud resources)
- Execute build or deployment commands
- Run custom automation during template scaffolding
- Perform system operations that aren't covered by built-in actions

## Installation

Add the package to your Backstage backend:

```bash
yarn --cwd packages/backend add @ruivalim/shell-exec
```

Then register the module in `packages/backend/src/index.ts`:

```typescript
backend.add(import('@ruivalim/shell-exec'));
```

That's it, `shell:exec` shows up in the list of installed actions (`/create/actions`).

### Registering the action yourself

If you already have your own scaffolder module, add the action there instead:

```typescript
import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { shellExec } from '@ruivalim/shell-exec';

export default createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'custom-actions',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ scaffolder }) {
        scaffolder.addActions(shellExec());
      },
    });
  },
});
```

## How `command` and `args` are run

- **Without `args`**, `command` runs through the shell (`/bin/sh`), so pipes, `&&`, redirects and variables work:
  `command: echo hello | tr a-z A-Z`
- **With `args`**, `command` is executed directly and every item of `args` reaches it exactly as written. Nothing in `args` is interpreted by a shell, so a template parameter like `foo; rm -rf ~` stays a harmless string.

Put template parameters in `args` whenever you can.

> **Changed in 0.2.0.** Up to 0.1.x, `args` were joined with spaces and handed to the shell. That broke arguments containing spaces and let parameter values run as shell code. If you relied on shell syntax inside `args`, move the whole line into `command` and drop `args`.

## Usage

### Basic Example

Execute a simple command:

```yaml
steps:
  - id: list-files
    name: List Files
    action: shell:exec
    input:
      command: ls
      args:
        - '-la'
```

### Run a Script

Execute a bash script with arguments:

```yaml
steps:
  - id: setup-infrastructure
    name: Setup Infrastructure
    action: shell:exec
    input:
      command: bash
      args:
        - './scripts/setup.sh'
        - '${{ parameters.environment }}'
        - '${{ parameters.region }}'
```

### Custom Working Directory

Run a command in a specific directory:

```yaml
steps:
  - id: build-app
    name: Build Application
    action: shell:exec
    input:
      command: npm
      args:
        - 'run'
        - 'build'
      cwd: './app'
```

### Real-World Example: Azure DevOps Setup

```yaml
steps:
  - id: fetch-script
    name: Fetch Azure DevOps Setup Script
    action: fetch:plain
    input:
      url: https://raw.githubusercontent.com/your-org/scripts/main/setup-azure-devops.sh
      targetPath: ./scripts/

  - id: setup-azure-devops
    name: Setup Azure DevOps (Pipeline & Branch Policies)
    action: shell:exec
    input:
      command: bash
      args:
        - './scripts/setup-azure-devops.sh'
        - '${{ parameters.organization }}'
        - '${{ parameters.project }}'
        - '${{ parameters.repositoryName }}'
```

### Execute with Environment Variables

`sh -c` receives the script as a single argument, and `$1` is taken from the next one, so the parameter never becomes shell code:

```yaml
steps:
  - id: deploy
    name: Deploy to Cloud
    action: shell:exec
    input:
      command: sh
      args:
        - '-c'
        - 'API_KEY="$0" ./deploy.sh "$1"'
        - '${{ secrets.apiKey }}'
        - '${{ parameters.env }}'
```

### Using Outputs from Scripts

Execute a script and use its output in subsequent steps:

```yaml
steps:
  - id: setup-sonarcloud
    name: Setup SonarCloud
    action: shell:exec
    input:
      command: bash
      args:
        - './scripts/setup-sonarcloud.sh'
        - 'fairfax-brasil'
        - '${{ parameters.projectName }}'

  - id: create-readme
    name: Create README with SonarCloud Badge
    action: fetch:template
    input:
      url: ./templates
      values:
        projectName: '${{ parameters.projectName }}'
        sonarUrl: '${{ steps.setup-sonarcloud.output.value }}'
```

The script `setup-sonarcloud.sh` would output the SonarCloud URL:

```bash
#!/bin/bash
ORG=$1
PROJECT=$2

# Setup SonarCloud project...
SONAR_URL="https://sonarcloud.io/dashboard?id=${ORG}_${PROJECT}"

# Output the URL for use in other steps
echo "EXEC_SHELL_OUTPUT_VALUE=${SONAR_URL}"
```

## Parameters

### command (required)

The shell command or executable to run.

**Type:** `string`

**Examples:**
- `bash`
- `sh`
- `python`
- `npm`
- `./custom-script.sh`

### args (optional)

Array of arguments to pass to the command.

**Type:** `string[]`

**Default:** `[]`

**Example:**
```yaml
args:
  - '--verbose'
  - '--output=json'
  - '${{ parameters.name }}'
```

### cwd (optional)

Working directory where the command should be executed.

**Type:** `string`

**Default:** Template workspace path. A relative path is resolved against the workspace.

**Example:**
```yaml
cwd: './subfolder'
```

## Outputs

The action provides the following outputs that can be used in subsequent steps:

### value (optional)

Captured value from the `EXEC_SHELL_OUTPUT_VALUE` variable in the command output. Your script can echo this value to pass data to other steps.

**Type:** `string`

**Example:**

```yaml
steps:
  - id: get-repo-url
    name: Get Repository URL
    action: shell:exec
    input:
      command: bash
      args:
        - './scripts/create-repo.sh'
        - '${{ parameters.projectName }}'

  - id: show-repo
    name: Show Repository Info
    action: debug:log
    input:
      message: 'Repository URL: ${{ steps.get-repo-url.output.value }}'
```

Your script should output the value like this:

```bash
#!/bin/bash
# scripts/create-repo.sh

PROJECT_NAME=$1
REPO_URL="https://github.com/myorg/${PROJECT_NAME}"

# ... do some work ...

# Output the value for Backstage
echo "EXEC_SHELL_OUTPUT_VALUE=${REPO_URL}"
```

### stdout

The complete standard output from the executed command.

**Type:** `string`

**Example:**
```yaml
message: 'Command output: ${{ steps.my-step.output.stdout }}'
```

### stderr

The complete standard error output from the executed command.

**Type:** `string`

### exitCode

The exit code returned by the command. It is always 0, since any other exit code fails the step.

**Type:** `number`

## Output and Logging

The action automatically captures and logs:
- Command execution details (command, args, working directory)
- Real-time stdout/stderr output
- Exit codes and error messages

All output appears in the Backstage scaffolder task logs.

## Error Handling

The action will:
- Fail the step if the command exits with a non-zero exit code
- Fail the step if the command is killed by a signal (for example by the OOM killer)
- Log detailed error information including command, args, and error message
- Halt template execution on failure

## Security Considerations

⚠️ **Important Security Notes:**

1. **Command Injection Risk:** Never put user input inside `command`, since it goes through the shell. Pass it in `args`, which are not interpreted.

2. **File Permissions:** Ensure scripts have execute permissions (`chmod +x script.sh`) before running them.

3. **Secrets:** Use Backstage's secret management for sensitive data. Don't hardcode credentials.

4. **Sandboxing:** The command runs in the context of the Backstage backend. Consider containerization for additional isolation.

5. **Audit:** All command executions are logged for audit purposes.

### Best Practices

✅ **Do:**
- Use explicit paths for scripts (e.g., `./scripts/setup.sh`)
- Validate user input before passing to commands
- Pass template parameters in `args`, never inside `command`
- Check script exit codes
- Log important information

❌ **Don't:**
- Use user input directly in shell commands without validation
- Execute commands from untrusted sources
- Store secrets in template parameters
- Use `eval` or dynamic command construction

## Requirements

- Backstage with the new backend system (tested on Backstage 1.55)
- Node.js 22 or 24

## Troubleshooting

### Script not found

Ensure the script path is relative to the workspace:
```yaml
command: bash
args:
  - './scripts/setup.sh'  # ✅ Correct
  # Not: '/tmp/scripts/setup.sh'  # ❌ Wrong
```

### Permission denied

Make scripts executable before running:
```yaml
- id: make-executable
  action: shell:exec
  input:
    command: chmod
    args: ['+x', './scripts/setup.sh']

- id: run-script
  action: shell:exec
  input:
    command: './scripts/setup.sh'
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Apache-2.0

## Author

Rui Valim

## Links

- [GitHub Repository](https://github.com/Ruivalim/shell-exec)
- [NPM Package](https://www.npmjs.com/package/@ruivalim/shell-exec)
- [Issue Tracker](https://github.com/Ruivalim/shell-exec/issues)
- [Backstage Documentation](https://backstage.io/docs/features/software-templates/writing-custom-actions)

## Releasing

Releases are automated. Commits follow [Conventional Commits](https://www.conventionalcommits.org): `fix:` and `feat:` go into the next release, `feat!:` or a `BREAKING CHANGE:` footer marks a breaking one.

[release-please](https://github.com/googleapis/release-please) keeps a release PR open with the next version and changelog. Merging it tags the release and publishes it to npm with provenance, through npm trusted publishing.

Dependencies are kept up to date by [Renovate](https://docs.renovatebot.com): stable patch and minor updates merge on their own once CI passes, Backstage packages come grouped in one PR for review.
