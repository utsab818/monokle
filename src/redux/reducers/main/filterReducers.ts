import {Draft, PayloadAction} from '@reduxjs/toolkit';

import {isEqual} from 'lodash';

import {AppState, ResourceFilterType} from '@shared/models/appState';
import electronStore from '@shared/utils/electronStore';
import {createSliceReducers} from '@shared/utils/redux';

export const filterReducers = createSliceReducers('main', {
  setFiltersToBeChanged: (state: Draft<AppState>, action: PayloadAction<ResourceFilterType | undefined>) => {
    state.filtersToBeChanged = action.payload;
  },
  setApplyingResource: (state: Draft<AppState>, action: PayloadAction<boolean>) => {
    state.isApplyingResource = action.payload;
  },
  resetResourceFilter: (state: Draft<AppState>) => {
    state.resourceFilter = {labels: {}, annotations: {}};
  },
  updateResourceFilter: (state: Draft<AppState>, action: PayloadAction<ResourceFilterType>) => {
    if (state.checkedResourceIds.length && !state.filtersToBeChanged) {
      state.filtersToBeChanged = action.payload;
      return;
    }

    if (state.filtersToBeChanged) {
      state.filtersToBeChanged = undefined;
    }

    state.resourceFilter = action.payload;
  },
  extendResourceFilter: (state: Draft<AppState>, action: PayloadAction<ResourceFilterType>) => {
    const filter = action.payload;

    if (state.checkedResourceIds.length && !state.filtersToBeChanged) {
      state.filtersToBeChanged = filter;
      return;
    }

    if (state.filtersToBeChanged) {
      state.filtersToBeChanged = undefined;
    }

    // construct new filter
    let newFilter: ResourceFilterType = {
      names: filter.names
        ? isEqual(filter.names, state.resourceFilter.names)
          ? undefined
          : filter.names
        : state.resourceFilter.names,
      namespace: filter.namespace
        ? filter.namespace === state.resourceFilter.namespace
          ? undefined
          : filter.namespace
        : state.resourceFilter.namespace,
      kinds: filter.kinds
        ? isEqual(filter.kinds, state.resourceFilter.kinds)
          ? undefined
          : filter.kinds
        : state.resourceFilter.kinds,
      fileOrFolderContainedIn: filter.fileOrFolderContainedIn
        ? filter.fileOrFolderContainedIn === state.resourceFilter.fileOrFolderContainedIn
          ? undefined
          : filter.fileOrFolderContainedIn
        : state.resourceFilter.fileOrFolderContainedIn,
      labels: state.resourceFilter.labels,
      annotations: state.resourceFilter.annotations,
    };

    Object.keys(filter.labels).forEach(key => {
      if (newFilter.labels[key] === filter.labels[key]) {
        delete newFilter.labels[key];
      } else {
        newFilter.labels[key] = filter.labels[key];
      }
    });
    Object.keys(filter.annotations).forEach(key => {
      if (newFilter.annotations[key] === filter.annotations[key]) {
        delete newFilter.annotations[key];
      } else {
        newFilter.annotations[key] = filter.annotations[key];
      }
    });
    state.resourceFilter = newFilter;
  },
  deleteFilterPreset: (state: Draft<AppState>, action: PayloadAction<string>) => {
    delete state.filtersPresets[action.payload];
    electronStore.set('main.filtersPresets', state.filtersPresets);
  },
  loadFilterPreset: (state: Draft<AppState>, action: PayloadAction<string>) => {
    state.resourceFilter = state.filtersPresets[action.payload];
  },
  saveFilterPreset: (state: Draft<AppState>, action: PayloadAction<string>) => {
    state.filtersPresets[action.payload] = state.resourceFilter;
    electronStore.set('main.filtersPresets', state.filtersPresets);
  },
});
