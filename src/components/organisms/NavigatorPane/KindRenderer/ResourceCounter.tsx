import styled from 'styled-components';

import {useAppSelector} from '@redux/hooks';
import {navigatorResourcesCountSelector} from '@redux/selectors/resourceSelectors';

import {Colors, FontColors} from '@shared/styles';

type Props = {
  kind: string;
  isSelected: boolean;
  onClick: () => void;
};

function ResourceCounter({kind, isSelected, onClick}: Props) {
  const isCollapsed = useAppSelector(state => state.ui.navigator.collapsedResourceKinds.includes(kind));
  const navigatorResourcesCount = useAppSelector(navigatorResourcesCountSelector);

  return (
    <Counter selected={isSelected && isCollapsed} onClick={onClick}>
      {navigatorResourcesCount}
    </Counter>
  );
}

export default ResourceCounter;

const Counter = styled.span<{selected: boolean}>`
  margin-left: 8px;
  font-size: 14px;
  cursor: pointer;
  ${props => (props.selected ? `color: ${Colors.blackPure};` : `color: ${FontColors.grey};`)}
`;
