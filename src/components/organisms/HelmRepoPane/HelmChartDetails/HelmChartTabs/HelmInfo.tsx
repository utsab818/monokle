import {useCallback, useMemo, useState} from 'react';
import ReactMarkdown from 'react-markdown';

import {Dropdown, Skeleton, Typography} from 'antd';

import {CloudDownloadOutlined, DownOutlined} from '@ant-design/icons';

import {kubeConfigContextSelector} from '@redux/appConfig';
import {useAppDispatch, useAppSelector} from '@redux/hooks';
import {installHelmRepoChart} from '@redux/thunks/InstallHelmRepoChart';

import {HelmChartModalConfirmWithNamespaceSelect} from '@components/molecules';

import {useGetHelmChartInfo} from '@hooks/useGetHelmChartInfo';

import helmPlaceholder from '@assets/helm-default-ico.svg';

import {Icon} from '@monokle/components';
import {Colors} from '@shared/styles';
import {openUrlInExternalBrowser, trackEvent} from '@shared/utils';

import PullHelmChartModal from '../PullHelmChartModal';
import * as S from './HelmInfo.styled';

interface IProps {
  chartName: string;
}

const HelmInfo = ({chartName}: IProps) => {
  const dispatch = useAppDispatch();
  const kubeConfigContext = useAppSelector(kubeConfigContextSelector);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [chartVersion, setChartVersion] = useState('');

  const {value: helmChartInfo, loading: loadingHelmInfo} = useGetHelmChartInfo(chartName);

  const onClickApplyHelmChart = useCallback(
    async (namespace?: string) => {
      const repoName = chartName.split('/')[0];
      await dispatch(
        installHelmRepoChart({name: repoName, chart: chartName, namespace, version: chartVersion})
      ).unwrap();
      setInstallModalOpen(false);
      trackEvent('helm_repo/install', {chart: chartName, version: chartVersion});
    },
    [chartName, chartVersion, dispatch]
  );
  const latestVersion = helmChartInfo?.version || '';

  const items = useMemo(
    () =>
      helmChartInfo?.available_versions
        .filter(i => i.version !== helmChartInfo?.version)
        .map((i: any) => ({
          label: i.version,
          key: i.version,
        })),
    [helmChartInfo]
  );

  const onDownloadLatestHelmChartHandler = () => {
    setChartVersion(latestVersion);
    setConfirmModalOpen(true);
  };

  const onInstallLatestHelmChartHandler = () => {
    setChartVersion(latestVersion);
    setInstallModalOpen(true);
  };

  return loadingHelmInfo ? (
    <Skeleton active={loadingHelmInfo} />
  ) : (
    <S.Container>
      <S.Content>
        <div>
          <S.Header>
            <S.Logo
              width="100"
              height="100"
              loading="lazy"
              decoding="async"
              src={getHelmRepoLogo(helmChartInfo?.logo_image_id)}
            />
            <S.ChartInfo>
              <S.Label>
                Author<Typography.Text> {helmChartInfo?.repository?.name}</Typography.Text>
              </S.Label>
              <S.Label>
                Repository&nbsp;
                <Typography.Link onClick={() => openUrlInExternalBrowser(helmChartInfo?.repository?.url)}>
                  {helmChartInfo?.repository?.url}
                </Typography.Link>
              </S.Label>
              <S.Label>
                apiVersion<Typography.Text> {helmChartInfo?.data?.apiVersion}</Typography.Text>
              </S.Label>
              <S.Label>
                appVersion
                <Typography.Text> {helmChartInfo?.app_version}</Typography.Text>
              </S.Label>
            </S.ChartInfo>
          </S.Header>
        </div>

        <ReactMarkdown
          components={{
            a({href, children, ...restProps}) {
              return (
                <a onClick={() => openUrlInExternalBrowser(href)} {...restProps}>
                  {children}
                </a>
              );
            },
            h1({children, ...restProps}) {
              return <S.H1 {...restProps}>{children}</S.H1>;
            },
            h2({children, ...restProps}) {
              return <S.H2 {...restProps}>{children}</S.H2>;
            },
          }}
        >
          {helmChartInfo?.readme || ''}
        </ReactMarkdown>
      </S.Content>

      <S.Footer>
        <S.MenuDropdownList
          id="versions"
          style={{minHeight: 0, maxHeight: 300, minWidth: 200, position: 'absolute', backgroundColor: Colors.grey3}}
        />
        <Dropdown.Button
          menu={{
            items,
            onClick: ({key}) => {
              setChartVersion(key);
              setConfirmModalOpen(true);
            },
          }}
          size="large"
          type="primary"
          icon={<DownOutlined />}
          onClick={onDownloadLatestHelmChartHandler}
          getPopupContainer={() => document.getElementById('versions')!}
        >
          <CloudDownloadOutlined />
          Download locally ({latestVersion})
        </Dropdown.Button>
        <Dropdown.Button
          menu={{
            items,
            onClick: ({key}) => {
              setChartVersion(key);
              setInstallModalOpen(true);
            },
          }}
          size="large"
          type="primary"
          icon={<DownOutlined />}
          onClick={onInstallLatestHelmChartHandler}
          getPopupContainer={() => document.getElementById('versions')!}
        >
          <Icon name="cluster-dashboard" />
          Install in cluster ({latestVersion})
        </Dropdown.Button>
      </S.Footer>

      <PullHelmChartModal
        open={confirmModalOpen}
        dismissModal={() => setConfirmModalOpen(false)}
        chartName={chartName}
        chartVersion={chartVersion}
      />

      <HelmChartModalConfirmWithNamespaceSelect
        isVisible={installModalOpen}
        title={`Install the ${chartName} Chart in cluster [${kubeConfigContext}]?`}
        onCancel={() => setInstallModalOpen(false)}
        onOk={selectedNamespace => onClickApplyHelmChart(selectedNamespace)}
      />
    </S.Container>
  );
};

export default HelmInfo;

const getHelmRepoLogo = (logoImageId?: string) => {
  if (logoImageId) {
    return `https://artifacthub.io/image/${logoImageId}`;
  }
  return helmPlaceholder;
};
