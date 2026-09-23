import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { spawn } from 'child_process';
import * as path from 'path';

const OUTPUT_VALUE_PATTERN = /^EXEC_SHELL_OUTPUT_VALUE=(.*)$/m;

export const shellExec = () => {
    return createTemplateAction({
        id: 'shell:exec',
        description: 'Execute a shell command or script',
        supportsDryRun: false,
        schema: {
            input: z =>
                z.object({
                    command: z.string().describe('The command to execute. Without args it runs through the shell, so pipes and && work'),
                    args: z.array(z.string()).optional().describe('Arguments passed to the command as-is, without shell interpretation'),
                    cwd: z.string().optional().describe('Working directory, relative to the workspace (defaults to the workspace)'),
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
            const workingDirectory = cwd ? path.resolve(ctx.workspacePath, cwd) : ctx.workspacePath;
            // With shell: true Node joins args with spaces and hands the string to the shell,
            // so a template parameter in args would be interpreted as shell syntax.
            const useShell = args === undefined;
            const commandArgs = args ?? [];

            ctx.logger.info(`Executing shell command: ${command}`, {
                command,
                args: commandArgs,
                cwd: workingDirectory,
            });

            return new Promise<void>((resolve, reject) => {
                let stdout = '';
                let stderr = '';

                const child = spawn(command, commandArgs, {
                    cwd: workingDirectory,
                    shell: useShell,
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

                child.on('close', (exitCode, signal) => {
                    // exitCode is null when the process was killed by a signal
                    if (exitCode !== 0) {
                        const reason = exitCode === null ? `was killed by signal ${signal}` : `exited with code ${exitCode}`;
                        ctx.logger.error(`Command ${reason}: ${command}`, {
                            command,
                            args: commandArgs,
                            cwd: workingDirectory,
                            exitCode,
                            signal,
                            stderr,
                        });
                        reject(new Error(`Command ${reason}`));
                        return;
                    }

                    ctx.logger.info(`Successfully executed command: ${command}`);

                    const outputValue = stdout.match(OUTPUT_VALUE_PATTERN)?.[1].trim();
                    if (outputValue) {
                        ctx.output('value', outputValue);
                    }
                    ctx.output('stdout', stdout);
                    ctx.output('stderr', stderr);
                    ctx.output('exitCode', exitCode);

                    resolve();
                });
            });
        },
    });
};
