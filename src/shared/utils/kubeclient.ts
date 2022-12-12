import * as k8s from '@kubernetes/client-node';

import {spawn} from 'child_process';
import log from 'loglevel';
import {v4 as uuid} from 'uuid';

import {CommandOptions, CommandResult} from '@shared/models/commands';
import {ClusterAccess, KubePermissions} from '@shared/models/config';
import {runCommandInMainThread} from '@shared/utils/commands';
import {getMainProcessEnv} from '@shared/utils/env';

import {isRendererThread} from './thread';

export const getKubeAccess = async (namespace: string, currentContext: string): Promise<ClusterAccess> => {
  let result;
  if (isRendererThread()) {
    result = await runCommandInMainThread({
      commandId: uuid(),
      cmd: 'kubectl',
      args: ['auth', 'can-i', '--list', `--namespace=${namespace}`],
    });
  } else {
    result = await runCommandPromise({
      commandId: uuid(),
      cmd: 'kubectl',
      args: ['auth', 'can-i', '--list', `--namespace=${namespace}`],
    });
  }

  const hasErrors = result.exitCode !== 0;
  if (hasErrors) {
    const errors = result.stderr;
    log.error(`get cluster access errors ${errors}`);
    throw new Error("Couldn't get cluster access for namespaces");
  }
  const stdout = result.stdout;
  if (typeof stdout !== 'string') {
    throw new Error("Couldn't get cluster access for namespaces");
  }
  return {
    ...parseCanI(result.stdout as string),
    context: currentContext,
    namespace,
  };
};

function parseCanI(stdout: string): {permissions: KubePermissions[]; hasFullAccess: boolean} {
  const lines = stdout.split('\n');

  const permissions: KubePermissions[] = [];
  let hasFullAccess = false;

  if (!stdout) {
    return {
      permissions,
      hasFullAccess,
    };
  }

  lines.forEach((line, index) => {
    if (!index) {
      return;
    }
    const columns = line.split(/\s{2,100}/);

    /**
     * an output line looks like this "selfsubjectrulesreviews.authorization.k8s.io [] [] [create]"
     * and we need only the first and last items(resource name and verbs allowed)
     */
    const [resourceName, , , rawVerbs] = columns;

    if (!resourceName) {
      return;
    }

    const cleanVerbs = (rawVerbs as string).replace('[', '').replace(']', '');

    if (resourceName === '*.*' && cleanVerbs === '*') {
      hasFullAccess = true;
    }

    const verbs = cleanVerbs ? cleanVerbs.split(' ') : [];

    permissions.push({
      resourceName,
      verbs,
    });
  });

  return {
    permissions,
    hasFullAccess,
  };
}

export const runCommandPromise = (options: CommandOptions): Promise<CommandResult> =>
  new Promise(res => {
    const result: CommandResult = {
      commandId: options.commandId,
      exitCode: null,
      signal: null,
    };

    try {
      const child = spawn(options.cmd, options.args, {
        env: {
          ...options.env,
          ...process.env,
        },
        shell: true,
        windowsHide: true,
      });

      if (options.input) {
        child.stdin.write(options.input);
        child.stdin.end();
      }

      child.on('exit', (code: any, signal: any) => {
        result.exitCode = code;
        result.signal = signal && signal.toString();
        res(result);
      });

      child.stdout.on('data', (data: any) => {
        result.stdout = result.stdout ? result.stdout + data.toString() : data.toString();
      });

      child.stderr.on('data', (data: any) => {
        result.stderr = result.stderr ? result.stderr + data.toString() : data.toString();
      });
    } catch (e: any) {
      result.error = e.message;
      res(result);
    }
  });

export function createKubeClient(path: string, context?: string) {
  const kc = new k8s.KubeConfig();

  if (!path) {
    throw new Error('Missing path to kubeconfing');
  }

  kc.loadFromFile(path);
  let currentContext = context;

  if (!currentContext) {
    currentContext = kc.currentContext;
    log.warn(`Missing currentContext, using default in kubeconfig: ${currentContext}`);
  } else {
    kc.setCurrentContext(currentContext);
  }

  // find the context
  const ctxt = kc.contexts.find((c: any) => c.name === currentContext);
  if (ctxt) {
    // find the user
    const user = kc.users.find((usr: any) => usr.name === ctxt.user);

    // does the user use the ExecAuthenticator? -> apply process env
    if (user?.exec) {
      const mainProcessEnv = getMainProcessEnv();
      if (mainProcessEnv) {
        const envValues = Object.keys(mainProcessEnv).map(k => {
          return {name: k, value: mainProcessEnv[k]};
        });
        if (user.exec.env) {
          envValues.push(...user.exec.env);
        }

        user.exec.env = envValues;
      }
    }
  } else {
    throw new Error(`Selected context ${currentContext} not found in kubeconfig at ${path}`);
  }

  return kc;
}

export function hasAccessToResource(resourceName: string, verb: string, clusterAccess?: ClusterAccess) {
  if (!clusterAccess) {
    return false;
  }

  if (clusterAccess.hasFullAccess) {
    return true;
  }

  const resourceAccess = clusterAccess.permissions.find(access => {
    return access.resourceName === resourceName.toLowerCase() && access.verbs.includes(verb);
  });

  return Boolean(resourceAccess);
}
