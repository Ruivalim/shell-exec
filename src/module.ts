import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { shellExec } from './shell';

export const scaffolderModuleShellExec = createBackendModule({
    pluginId: 'scaffolder',
    moduleId: 'shell-exec',
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
