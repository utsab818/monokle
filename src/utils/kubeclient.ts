import * as k8s from '@kubernetes/client-node';
import {KubeConfig} from '@kubernetes/client-node';

import {spawn} from 'child_process';
import log from 'loglevel';
import {v4 as uuid} from 'uuid';

import {ClusterAccess, KubePermissions} from '@models/appconfig';

import {getMainProcessEnv} from '@utils/env';

import {CommandOptions, CommandResult, runCommandInMainThread} from './commands/execute';
import {isRendererThread} from './thread';

let isKubectlProxyRunning = false;

export async function createKubeClient(path: string, context?: string) {
  const kc = new k8s.KubeConfig();

  if (!path) {
    throw new Error('Missing path to kubeconfing');
  }

  kc.loadFromFile(path);
  const {proxyUrl} = await spawnKubectlProxy(8080);
  const proxyKubeConfig = new KubeConfig();
  proxyKubeConfig.loadFromOptions({
    currentContext: kc.getCurrentContext(),
    clusters: kc.getClusters().map(c => ({...c, server: proxyUrl, skipTLSVerify: true})),
    users: kc.getUsers(),
    contexts: kc.getContexts(),
  });
  console.log('proxyKubeConfig', proxyKubeConfig);

  let currentContext = context;

  if (!currentContext) {
    currentContext = proxyKubeConfig.currentContext;
    log.warn(`Missing currentContext, using default in kubeconfig: ${currentContext}`);
  } else {
    proxyKubeConfig.setCurrentContext(currentContext);
  }

  // find the context
  const ctxt = proxyKubeConfig.contexts.find(c => c.name === currentContext);
  if (ctxt) {
    // find the user
    const user = proxyKubeConfig.users.find(usr => usr.name === ctxt.user);

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

  return proxyKubeConfig;
}

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

      child.on('exit', (code, signal) => {
        result.exitCode = code;
        result.signal = signal && signal.toString();
        res(result);
      });

      child.stdout.on('data', data => {
        result.stdout = result.stdout ? result.stdout + data.toString() : data.toString();
      });

      child.stderr.on('data', data => {
        result.stderr = result.stderr ? result.stderr + data.toString() : data.toString();
      });
    } catch (e: any) {
      result.error = e.message;
      res(result);
    }
  });

function spawnKubectlProxy(port: number) {
  return new Promise<{proxyUrl: string}>((resolve, reject) => {
    if (!isKubectlProxyRunning) {
      const proxyProcess = spawn(`kubectl proxy --port=${port}`, {shell: true, env: process.env});
      console.log('proxyProcess', proxyProcess);

      // TODO: is there a better way to check if opening the proxy was successful?
      const expectedMessage = `Starting to serve on 127.0.0.1:${port}`;
      proxyProcess.stdout.on('data', data => {
        console.log('data', data);
        if (data.toString().trim() === expectedMessage) {
          const proxyUrl = `http://127.0.0.1:${port}`;
          isKubectlProxyRunning = false;
          resolve({proxyUrl});
        }
      });

      proxyProcess.on('error', err => {
        isKubectlProxyRunning = false;

        reject(err);
        console.log(err);
      });

      setTimeout(() => {
        isKubectlProxyRunning = false;
        console.log('proxyProcess', proxyProcess);
        reject(new Error('[spawnKubectlProxy]: Exceeded timeout'));
      }, 10000);
    }
  });
}
