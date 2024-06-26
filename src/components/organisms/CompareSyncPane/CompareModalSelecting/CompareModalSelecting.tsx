import {useCallback} from 'react';

import {Col, Row} from 'antd';

import {resourceSetRefreshed} from '@redux/compare';
import {useAppDispatch, useAppSelector} from '@redux/hooks';

import CompareDoubleFigure from '@assets/figures/compareDouble.svg';
import CompareSingleFigure from '@assets/figures/compareSingle.svg';
import CrashFigure from '@assets/figures/crash.svg';

import {CompareSide} from '@shared/models/compare';
import {Colors} from '@shared/styles/colors';

import CompareFigure from '../CompareFigure';
import {FigureDescription, FigureTitle} from '../CompareFigure/CompareFigure.styled';
import ResourceList from '../ResourceList';
import * as S from './CompareModalSelecting.styled';
import Loading from './Loading';

const CompareModalSelecting: React.FC = () => {
  const dispatch = useAppDispatch();
  const {left, right} = useAppSelector(state => state.compare.current);
  const leftSuccess = left && !left.loading && !left.error;
  const rightSuccess = right && !right.loading && !right.error;
  const handleRetry = useCallback((side: CompareSide) => dispatch(resourceSetRefreshed({side})), [dispatch]);
  const hasSideSelected = Boolean(left?.resources.length) || Boolean(right?.resources.length);

  if (leftSuccess && rightSuccess) {
    // Invalid state - it should be comparing.
    return null;
  }

  if (left && !rightSuccess) {
    return (
      <>
        <S.ListRow>
          <Col span={10}>
            {left.loading ? (
              <Loading />
            ) : left.error ? (
              <ErrorFigure onRetry={() => handleRetry('left')} />
            ) : (
              <ResourceList data={left} showCheckbox />
            )}
          </Col>
        </S.ListRow>

        <S.FloatingFigure side="right" noEvents={!right?.error}>
          {!right ? (
            <CompareFigure src={CompareSingleFigure}>
              <FigureDescription color={Colors.grey8}>Now, something here</FigureDescription>
            </CompareFigure>
          ) : right.error ? (
            <ErrorFigure onRetry={() => handleRetry('right')} />
          ) : (
            <Loading />
          )}
        </S.FloatingFigure>
      </>
    );
  }

  if (right && !leftSuccess) {
    return (
      <>
        <S.ListRow>
          <Col span={14} />

          <Col span={10}>
            {right.loading ? (
              <div style={{paddingLeft: hasSideSelected ? 6 : 0, height: '100%', overflow: 'hidden'}}>
                <Loading />
              </div>
            ) : right.error ? (
              <ErrorFigure onRetry={() => handleRetry('right')} />
            ) : (
              <div style={{paddingLeft: 6}}>
                <ResourceList data={right} />
              </div>
            )}
          </Col>
        </S.ListRow>

        <S.FloatingFigure side="left" noEvents={!left?.error}>
          {!left ? (
            <CompareFigure src={CompareSingleFigure}>
              <FigureDescription color={Colors.grey8}>Now, something here</FigureDescription>
            </CompareFigure>
          ) : left.error ? (
            <ErrorFigure onRetry={() => handleRetry('left')} />
          ) : (
            <Loading />
          )}
        </S.FloatingFigure>
      </>
    );
  }

  return (
    <Row style={{height: '100%'}}>
      <CompareFigure src={CompareDoubleFigure}>
        <FigureTitle>Compare (almost) anything!</FigureTitle>
        <FigureDescription>
          Choose a local resource, Kustomize / Helm preview or a cluster in any of the sides to start your diff.
        </FigureDescription>
      </CompareFigure>
    </Row>
  );
};

type ErrorFigureProps = {
  onRetry: () => void;
};

function ErrorFigure({onRetry}: ErrorFigureProps) {
  return (
    <CompareFigure src={CrashFigure}>
      <FigureTitle color={Colors.red7}>Cannot retrieve resources</FigureTitle>
      <FigureDescription color={Colors.grey8}>
        <S.RetrySpan onClick={onRetry}>Try again</S.RetrySpan> or select different resources
      </FigureDescription>
    </CompareFigure>
  );
}

export default CompareModalSelecting;
