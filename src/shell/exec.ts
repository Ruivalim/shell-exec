import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { spawn } from 'child_process';

export const shellExec = () => {
    return createTemplateAction({
        id: 'shell:exec',
        description: 'Execute a shell command or script',
        supportsDryRun: false,
        schema: {
            input: z =>
                z.object({
                    command: z.string().describe('The shell command or script to execute'),
                    args: z.array(z.string()).optional().describe('Optional array of arguments to pass to the command'),
                    cwd: z.string().optional().describe('Optional working directory for the command (defaults to workspacePath)'),
                }),
            output: z =>
                z.object({
                    value: z.string().optional().describe('The value captured from EXEC_SHELL_OUTPUT_VALUE in the command output'),
                    stdout: z.string().describe('The standard output from the executed command'),
                    stderr: z.string().describe('The standard error output from the executed command'),
                    exitCode: z.number().describe('The exit code of the executed command'),
                }),
        },
        async handler(ctx) {
            const { command, args, cwd } = ctx.input;
            const workingDirectory = cwd || ctx.workspacePath;
            const commandArgs = args || [];

            ctx.logger.info(`Executing shell command: ${command}`, {
                command,
                args: commandArgs,
                cwd: workingDirectory,
            });

            return new Promise((resolve, reject) => {
                let stdout = '';
                let stderr = '';

                const child = spawn(command, commandArgs, {
                    cwd: workingDirectory,
                    shell: true,
                });

                child.stdout?.on('data', (data) => {
                    const output = data.toString();
                    stdout += output;
                    ctx.logger.info(output);
                });

                child.stderr?.on('data', (data) => {
                    const output = data.toString();
                    stderr += output;
                    ctx.logger.error(output);
                });

                child.on('error', (error) => {
                    ctx.logger.error(`Failed to execute command: ${command}`, {
                        command,
                        args: commandArgs,
                        cwd: workingDirectory,
                        error: error.message,
                    });
                    reject(error);
                });

                child.on('close', (exitCode) => {
                    const code = exitCode || 0;

                    // Extract value from EXEC_SHELL_OUTPUT_VALUE in stdout
                    let outputValue: string | undefined;
                    const lines = stdout.split('\n');
                    for (const line of lines) {
                        const match = line.match(/^EXEC_SHELL_OUTPUT_VALUE=(.*)$/);
                        if (match) {
                            outputValue = match[1].trim();
                            break;
                        }
                    }

                    if (code !== 0) {
                        ctx.logger.error(`Command exited with code ${code}: ${command}`, {
                            command,
                            args: commandArgs,
                            cwd: workingDirectory,
                            exitCode: code,
                            stderr,
                        });
                        reject(new Error(`Command failed with exit code ${code}`));
                    } else {
                        ctx.logger.info(`Successfully executed command: ${command}`);

                        if (outputValue) {
                            ctx.output('value', outputValue);
                        }
                        ctx.output('stdout', stdout);
                        ctx.output('stderr', stderr);
                        ctx.output('exitCode', code);

                        resolve();
                    }
                });
            });
        },
    });
};
