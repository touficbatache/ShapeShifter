import { CanvasType } from '../..';
import { AutoAwesome } from '../../scripts/algorithms';
import { PathAnimationBlock } from '../../scripts/animations';
import { Path, PathUtil } from '../../scripts/paths';
import { State } from '../reducer';
import { HoverType, Selection, SelectionType } from '../shapeshifter';
import * as actions from './actions';
import { ActionReducer } from '@ngrx/store';
import * as _ from 'lodash';

export function reducer(state: State, action: actions.Actions): State {
  switch (action.type) {

    // Reverse all currently selected subpaths.
    case actions.REVERSE_SELECTED_SUBPATHS: {
      const selections = getSubPathSelections(state);
      const { source } = selections[0];
      const pathMutator = getActivePath(state, source).mutate();
      for (const { subIdx } of selections) {
        pathMutator.reverseSubPath(subIdx);
      }
      state = updateActivePathBlock(state, source, pathMutator.build());
      state = clearHover(state);
      break;
    }

    // Shift back all currently selected subpaths.
    case actions.SHIFT_BACK_SELECTED_SUBPATHS: {
      const selections = getSubPathSelections(state);
      const { source } = selections[0];
      const pathMutator = getActivePath(state, source).mutate();
      for (const { subIdx } of selections) {
        pathMutator.shiftSubPathBack(subIdx);
      }
      const newActivePath = pathMutator.build();
      state = updateActivePathBlock(state, source, pathMutator.build());
      state = clearHover(state);
      break;
    }

    // Shift forward all currently selected subpaths.
    case actions.SHIFT_FORWARD_SELECTED_SUBPATHS: {
      const selections = getSubPathSelections(state);
      const { source } = selections[0];
      const pathMutator = getActivePath(state, source).mutate();
      for (const { subIdx } of selections) {
        pathMutator.shiftSubPathForward(subIdx);
      }
      const newActivePath = pathMutator.build();
      state = updateActivePathBlock(state, source, pathMutator.build());
      state = clearHover(state);
      break;
    }

    // Delete all currently selected subpaths.
    case actions.DELETE_SELECTED_SUBPATHS: {
      // TODO: implement this
      // TODO: implement this
      // TODO: implement this
      // TODO: implement this
      // TODO: implement this
      // // TODO: support deleting multiple segments at a time?
      // const selections = this.selectionService.getSubPathSelections();
      // if (!selections.length) {
      //   return;
      // }
      // // Preconditions: all selections exist in the same canvas.
      // const { source, subIdx } = selections[0];
      // const activePathLayer = this.stateService.getActivePathLayer(source);
      // this.selectionService.resetAndNotify();
      // this.hoverService.resetAndNotify();
      // const mutator = activePathLayer.pathData.mutate();
      // if (activePathLayer.isStroked()) {
      //   mutator.deleteStrokedSubPath(subIdx);
      // } else if (activePathLayer.isFilled()) {
      //   mutator.deleteFilledSubPath(subIdx);
      // }
      // this.stateService.updateActivePath(source, mutator.build());
      throw new Error('TODO: implement this');
    }

    // Delete all currently selected segments.
    case actions.DELETE_SELECTED_SEGMENTS: {
      // // TODO: support deleting multiple segments at a time?
      const selections = getSegmentSelections(state);
      if (!selections.length) {
        break;
      }
      // Preconditions: all selections exist in the same canvas.
      const { source, subIdx, cmdIdx } = selections[0];
      const mutator = getActivePath(state, source).mutate();
      mutator.deleteFilledSubPathSegment(subIdx, cmdIdx);
      state = updateActivePathBlock(state, source, mutator.build());
      state = clearSelections(state);
      state = clearHover(state);
      break;
    }

    // Delete all currently selected points.
    case actions.DELETE_SELECTED_POINTS: {
      const selections = getPointSelections(state);
      if (!selections.length) {
        break;
      }
      // Preconditions: all selections exist in the same canvas.
      const source = selections[0].source;
      const activePath = getActivePath(state, source);
      const unsplitOpsMap: Map<number, Array<{ subIdx: number, cmdIdx: number }>> = new Map();
      for (const selection of selections) {
        const { subIdx, cmdIdx } = selection;
        if (!activePath.getCommand(subIdx, cmdIdx).isSplitPoint()) {
          continue;
        }
        let subIdxOps = unsplitOpsMap.get(subIdx);
        if (!subIdxOps) {
          subIdxOps = [];
        }
        subIdxOps.push({ subIdx, cmdIdx });
        unsplitOpsMap.set(subIdx, subIdxOps);
      }
      const mutator = activePath.mutate();
      unsplitOpsMap.forEach((ops, idx) => {
        PathUtil.sortPathOps(ops);
        for (const op of ops) {
          mutator.unsplitCommand(op.subIdx, op.cmdIdx);
        }
      });
      state = updateActivePathBlock(state, source, mutator.build());
      state = clearSelections(state);
      state = clearHover(state);
      break;
    }

    // Shift point to the front of its subpath.
    case actions.SHIFT_POINT_TO_FRONT: {
      const { source, subIdx, cmdIdx } = getPointSelections(state)[0];
      const activePath = getActivePath(state, source);
      const pathMutator = activePath.mutate();
      pathMutator.shiftSubPathForward(subIdx, cmdIdx);
      state = updateActivePathBlock(state, source, pathMutator.build());
      // state = clearHover(state);
      break;
    }

    // Show a split command hover for the currently selected point.
    case actions.SPLIT_COMMAND_IN_HALF_HOVER: {
      const { source, subIdx, cmdIdx } = getPointSelections(state)[0];
      state = setHover(state, HoverType.Split, source, subIdx, cmdIdx);
      break;
    }

    // Split the currently selected point.
    case actions.SPLIT_COMMAND_IN_HALF_CLICK: {
      const { source, subIdx, cmdIdx } = getPointSelections(state)[0];
      const activePath = getActivePath(state, source);
      const pathMutator = activePath.mutate();
      pathMutator.splitCommandInHalf(subIdx, cmdIdx);
      state = updateActivePathBlock(state, source, pathMutator.build());
      state = clearSelections(state);
      state = clearHover(state);
      break;
    }

    // Update a path animation block in shape shifter mode.
    case actions.UPDATE_ACTIVE_PATH_BLOCK: {
      const { source, path } = action.payload;
      state = updateActivePathBlock(state, source, path);
      break;
    }

    // Select a subpath in paired subpath shapeshifter mode.
    case actions.SELECT_PAIRED_SUBPATH: {
      const { subIdx, source: canvasType } = action.payload;
      const { unpairedSubPath: currUnpair } = state.shapeshifter;
      if (currUnpair && canvasType !== currUnpair.source) {
        const { source: fromSource, subIdx: fromSubIdx } = currUnpair;
        const toSource = canvasType;
        const toSubIdx = subIdx;
        state = setUnpairedSubPath(state, undefined);
        const selections = state.shapeshifter.selections;
        const fromSelections = selections.filter(s => s.source === fromSource);
        const toSelections = selections.filter(s => s.source === toSource);
        if (fromSelections.length) {
          state = setSelections(state, fromSelections.map(s => {
            const { subIdx: sIdx, cmdIdx, source, type } = s;
            return {
              subIdx: sIdx === fromSubIdx ? 0 : sIdx,
              cmdIdx,
              source,
              type,
            };
          }));
        } else if (toSelections.length) {
          state = setSelections(state, toSelections.map(s => {
            const { subIdx: sIdx, cmdIdx, source, type } = s;
            return {
              subIdx: sIdx === toSubIdx ? 0 : sIdx,
              cmdIdx,
              source,
              type,
            };
          }));
        }
        const pairedSubPaths = new Set();
        state.shapeshifter.pairedSubPaths.forEach(p => pairedSubPaths.add(p));
        if (pairedSubPaths.has(fromSubIdx)) {
          pairedSubPaths.delete(fromSubIdx);
        }
        if (pairedSubPaths.has(toSubIdx)) {
          pairedSubPaths.delete(toSubIdx);
        }
        pairedSubPaths.add(pairedSubPaths.size);
        state = setPairedSubPaths(state, pairedSubPaths)
        state = clearHover(state);
        state = updateActivePathBlock(
          state,
          fromSource,
          getActivePath(state, fromSource).mutate()
            .moveSubPath(fromSubIdx, 0)
            .build());
        state = updateActivePathBlock(
          state,
          toSource,
          getActivePath(state, toSource).mutate()
            .moveSubPath(toSubIdx, 0)
            .build());
      } else {
        state = setUnpairedSubPath(state, { source: canvasType, subIdx });
      }
      break;
    }

    // Set the currently unpaired subpath in pair subpaths mode.
    case actions.SET_UNPAIRED_SUBPATH: {
      const { unpairedSubPath } = action.payload;
      state = setUnpairedSubPath(state, unpairedSubPath);
      break;
    }
  }
  return state;
}

function getActivePathBlock(state: State) {
  const { blockId } = state.shapeshifter;
  const { timeline } = state;
  const animations = timeline.animations.slice();
  const { activeAnimationId } = timeline;
  const activeAnimationIndex = _.findIndex(animations, a => a.id === activeAnimationId);
  const activeAnimation = animations[activeAnimationIndex];
  const activeAnimationBlocks = activeAnimation.blocks.slice();
  const blockIndex = _.findIndex(activeAnimationBlocks, b => b.id === blockId);
  return activeAnimationBlocks[blockIndex] as PathAnimationBlock;
}

function getActivePath(state: State, source: CanvasType) {
  const block = getActivePathBlock(state);
  return source === CanvasType.Start ? block.fromValue : block.toValue;
}

function getSubPathSelections(state: State) {
  return state.shapeshifter.selections.filter(s => s.type === SelectionType.SubPath);
}

function getSegmentSelections(state: State) {
  return state.shapeshifter.selections.filter(s => s.type === SelectionType.Segment);
}

function getPointSelections(state: State) {
  return state.shapeshifter.selections.filter(s => s.type === SelectionType.Point);
}

function updateActivePathBlock(state: State, source: CanvasType, path: Path) {
  const { blockId } = state.shapeshifter;
  const { timeline } = state;
  const animations = timeline.animations.slice();
  const { activeAnimationId } = timeline;
  const activeAnimationIndex = _.findIndex(animations, a => a.id === activeAnimationId);
  let activeAnimation = animations[activeAnimationIndex];
  const activeAnimationBlocks = activeAnimation.blocks.slice();
  const blockIndex = _.findIndex(activeAnimationBlocks, b => b.id === blockId);
  let block = activeAnimationBlocks[blockIndex];

  // Remove any existing conversions and collapsing sub paths from the path.
  const pathMutator = path.mutate();
  path.getSubPaths().forEach((_, subIdx) => {
    pathMutator.unconvertSubPath(subIdx);
  });
  path = pathMutator.deleteCollapsingSubPaths().build();

  const getBlockPathFn = (t: CanvasType) => {
    return t === CanvasType.Start ? block.fromValue : block.toValue;
  };
  const setBlockPathFn = (t: CanvasType, p: Path) => {
    block = block.clone();
    if (t === CanvasType.Start) {
      block.fromValue = p;
    } else {
      block.toValue = p;
    }
  };

  const oppSource = source === CanvasType.Start ? CanvasType.End : CanvasType.Start;
  let oppPath = getBlockPathFn(oppSource);
  if (oppPath) {
    oppPath = oppPath.mutate().deleteCollapsingSubPaths().build();
    const numSubPaths = path.getSubPaths().length;
    const numOppSubPaths = oppPath.getSubPaths().length;
    if (numSubPaths !== numOppSubPaths) {
      const pathToChange = numSubPaths < numOppSubPaths ? path : oppPath;
      const oppPathToChange = numSubPaths < numOppSubPaths ? oppPath : path;
      const minIdx = Math.min(numSubPaths, numOppSubPaths);
      const maxIdx = Math.max(numSubPaths, numOppSubPaths);
      const mutator = pathToChange.mutate();
      for (let i = minIdx; i < maxIdx; i++) {
        // TODO: allow the user to specify the location of collapsing paths?
        const pole = oppPathToChange.getPoleOfInaccessibility(i);
        mutator.addCollapsingSubPath(
          pole, oppPathToChange.getSubPath(i).getCommands().length);
      }
      if (numSubPaths < numOppSubPaths) {
        path = mutator.build();
      } else {
        oppPath = mutator.build();
      }
    }
    for (let subIdx = 0; subIdx < Math.max(numSubPaths, numOppSubPaths); subIdx++) {
      const numCmds = path.getSubPath(subIdx).getCommands().length;
      const numOppCommands = oppPath.getSubPath(subIdx).getCommands().length;
      if (numCmds === numOppCommands) {
        // Only auto convert when the number of commands in both canvases
        // are equal. Otherwise we'll wait for the user to add more points.
        const autoConvertResults = AutoAwesome.autoConvert(
          subIdx,
          path,
          oppPath.mutate().unconvertSubPath(subIdx).build(),
        );
        path = autoConvertResults.from;

        // This is the one case where a change in one canvas type's vector layer
        // will cause corresponding changes to be made in the opposite canvas type's
        // vector layer.
        oppPath = autoConvertResults.to;
      }
    }
  }
  setBlockPathFn(source, path);
  setBlockPathFn(oppSource, oppPath);

  activeAnimationBlocks[blockIndex] = block;
  activeAnimation = activeAnimation.clone();
  activeAnimation.blocks = activeAnimationBlocks;
  animations[activeAnimationIndex] = activeAnimation;
  return { ...state, timeline: { ...timeline, animations } };
}

function setSelections(state: State, selections: ReadonlyArray<Selection>): State {
  const { shapeshifter } = state;
  return { ...state, shapeshifter: { ...shapeshifter, selections } };
}

function clearSelections(state: State) {
  return setSelections(state, []);
}

function setHover(state: State, type: HoverType, source: CanvasType, subIdx: number, cmdIdx: number) {
  const { shapeshifter } = state;
  const hover = { source, subIdx, cmdIdx, type };
  return { ...state, shapeshifter: { ...shapeshifter, hover } };
}

function clearHover(state: State) {
  const { shapeshifter } = state;
  return { ...state, shapeshifter: { ...shapeshifter, hover: undefined } };
}

function setPairedSubPaths(state: State, pairedSubPaths: Set<number>) {
  const { shapeshifter } = state;
  const newState = { ...state, shapeshifter: { ...shapeshifter, pairedSubPaths } };
  console.info('setting paired subpaths: ', state, newState, 'subIdxs', Array.from(pairedSubPaths).toString());
  return newState;
}

function setUnpairedSubPath(
  state: State,
  unpairedSubPath: { source: CanvasType, subIdx: number },
) {
  const { shapeshifter } = state;
  return { ...state, shapeshifter: { ...shapeshifter, unpairedSubPath } };
}