import { createTemplateAction, executeShellCommand } from '@backstage/plugin-scaffolder-node';

export const shellExec = () => {
    return createTemplateAction<{
        command: string;
        args?: string[];
        cwd?: string;
    }>({
        id: 'shell:exec',
        schema: {
            input: {
                type: 'object',
                required: ['command'],
                properties: {
                    command: {
                        type: 'string',
                        title: 'Command',
                        description: 'The shell command or script to execute',
                    },
                    args: {
                        type: 'array',
                        title: 'Arguments',
                        description: 'Optional array of arguments to pass to the command',
                        items: {
                            type: 'string',
                        },
                    },
                    cwd: {
                        type: 'string',
                        title: 'Working Directory',
                        description: 'Optional working directory for the command (defaults to workspacePath)',
                    },
                },
            },
        },
        async handler(ctx) {
            const workingDirectory = ctx.input.cwd || ctx.workspacePath;
            const args = ctx.input.args || [];

            ctx.logger.info(
                `Executing shell command: ${ctx.input.command}`,
                {
                    command: ctx.input.command,
                    args,
                    cwd: workingDirectory,
                }
            );

            try {
                await executeShellCommand({
                    command: ctx.input.command,
                    args,
                    options: {
                        cwd: workingDirectory,
                    },
                    logStream: ctx.logStream,
                });

                ctx.logger.info(`Successfully executed command: ${ctx.input.command}`);
            } catch (error) {
                ctx.logger.error(
                    `Failed to execute command: ${ctx.input.command}`,
                    {
                        command: ctx.input.command,
                        args,
                        cwd: workingDirectory,
                        error: error instanceof Error ? error.message : String(error),
                    }
                );
                throw error;
            }
        },
    });
};
