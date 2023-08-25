import {useCallback, useState} from 'react';
import {useStore} from 'react-redux';
import {useAsync, useInterval, useMount} from 'react-use';

import {isEqual} from 'lodash';

import {getCloudPolicy, getCloudUser, logoutFromCloud, startCloudLogin} from '@redux/cloud/ipc';
import {useAppSelector} from '@redux/hooks';

import {ROOT_FILE_ENTRY} from '@shared/constants/fileEntry';
import {AppDispatch} from '@shared/models/appDispatch';
import {CloudUser} from '@shared/models/cloud';
import {RootState} from '@shared/models/rootState';

import {setCloudPolicy} from './validation.slice';

export const pollCloudPolicy = async (state: RootState, dispatch: AppDispatch) => {
  const rootFileEntry = state.main.fileMap[ROOT_FILE_ENTRY];
  const rootFolderPath = rootFileEntry?.filePath;
  const cloudPolicy = rootFolderPath ? await getCloudPolicy(rootFolderPath) : undefined;
  const previousCloudPolicy = state.validation.cloudPolicy;

  if (!cloudPolicy) {
    return;
  }

  if (previousCloudPolicy && isEqual(previousCloudPolicy, cloudPolicy)) {
    return;
  }

  dispatch(setCloudPolicy(cloudPolicy));
};

export const useCloudPolicy = () => {
  const store = useStore<RootState>();
  const foundPolicy = useAppSelector(state => state.validation.cloudPolicy !== undefined);

  useMount(() => {
    pollCloudPolicy(store.getState(), store.dispatch);
  });
  useInterval(() => {
    pollCloudPolicy(store.getState(), store.dispatch);
  }, 30 * 1000);
  return {foundPolicy};
};

export const useCloudUser = () => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [cloudUser, setCloudUser] = useState<CloudUser>();

  useAsync(async () => {
    setIsInitializing(true);
    const user = await getCloudUser(undefined);
    setCloudUser(user);
    setIsInitializing(false);
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    const {user} = await startCloudLogin(undefined);
    setCloudUser(user);
    setIsConnecting(false);
  }, []);

  const disconnect = useCallback(async () => {
    setIsDisconnecting(true);
    await logoutFromCloud(undefined);
    setCloudUser(undefined);
    setIsDisconnecting(false);
  }, []);

  return {
    connect,
    disconnect,
    cloudUser,
    isInitializing,
    isConnecting,
    isDisconnecting,
  };
};
