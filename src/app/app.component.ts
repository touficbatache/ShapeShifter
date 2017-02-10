import {
  Component, OnInit, AfterViewInit, ElementRef,
  ViewChild, OnDestroy, HostListener
} from '@angular/core';
import { environment } from '../environments/environment';
import { Layer, VectorLayer, GroupLayer, PathLayer } from './scripts/layers';
import { VectorLayerLoader } from './scripts/parsers';
import { Point } from './scripts/common';
import { CanvasType } from './CanvasType';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { LayerStateService, Event as LayerStateEvent, MorphabilityStatus } from './services/layerstate.service';
import { DividerDragEvent } from './splitter/splitter.directive';
import { CanvasResizeService } from './services/canvasresize.service';
import { SelectionStateService } from './services/selectionstate.service';
import * as $ from 'jquery';
import * as erd from 'element-resize-detector';

const IS_DEV_MODE = !environment.production;
const ELEMENT_RESIZE_DETECTOR = erd();

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  // TODO: need to warn user about svgs not being structurally identical somehow...
  // TODO: or give the user a way to update the incorrect path id names or something...?
  START_CANVAS = CanvasType.Start;
  PREVIEW_CANVAS = CanvasType.Preview;
  END_CANVAS = CanvasType.End;
  MORPHABILITY_NONE = MorphabilityStatus.None;
  MORPHABILITY_UNMORPHABLE = MorphabilityStatus.Unmorphable;
  MORPHABILITY_MORPHABLE = MorphabilityStatus.Morphable;
  morphabilityStatus = MorphabilityStatus.None;

  private readonly subscriptions: Subscription[] = [];

  private appContainer: JQuery;
  private canvasContainer: JQuery;
  private inspectorContainer: JQuery;
  private currentPaneWidth = 0;
  private currentPaneHeight = 0;

  constructor(
    private layerStateService: LayerStateService,
    private selectionStateService: SelectionStateService,
    private canvasResizeService: CanvasResizeService) { }

  ngOnInit() {
    // TODO: unregister these in ngOnDestroy
    this.initKeyDownListener();
    this.initBeforeOnLoadListener();

    const updateCanvasSizes = () => {
      const numCanvases =
        this.morphabilityStatus === MorphabilityStatus.Morphable ? 3 : 2;
      const width = this.canvasContainer.width() / numCanvases;
      const height = this.canvasContainer.height();
      if (this.currentPaneWidth !== width || this.currentPaneHeight !== height) {
        this.currentPaneWidth = width;
        this.currentPaneHeight = height;
        this.canvasResizeService.setSize(width, height);
      }
    }

    const layerStateListener = (event: LayerStateEvent) => {
      const status = event.morphabilityStatus;
      if (this.morphabilityStatus !== status) {
        this.morphabilityStatus = status;
        updateCanvasSizes();
      }
    };

    [CanvasType.Start, CanvasType.End].forEach(type => {
      this.subscriptions.push(this.layerStateService.addListener(type, layerStateListener));
    });

    ELEMENT_RESIZE_DETECTOR.listenTo(this.canvasContainer.get(0), el => {
      updateCanvasSizes();
    });

    if (IS_DEV_MODE) {
      this.loadDebugVectorLayers();
    }
  }

  ngOnDestroy() {
    ELEMENT_RESIZE_DETECTOR.removeAllListeners(this.canvasContainer.get(0));
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private initKeyDownListener() {
    // Register global key events.
    // TODO: unregister this in ngOnDestroy
    $(window).on('keydown', event => {
      if (document.activeElement.matches('input')) {
        return true;
      }
      if (event.keyCode === 8 || event.keyCode === 46) {
        // In case there's a JS error, never navigate away.
        // TODO: implement and test deleting split points
        // event.preventDefault();
        // this.deleteSelectedSplitPoints();
      } else if (event.metaKey && event.keyCode === 'Z'.charCodeAt(0)) {
        // Undo/redo (Z key).
        // TODO: implement an undo service to keep track of undo/redo state.
        // return false;
      } else if (event.keyCode === 32) {
        // Spacebar.
        // TODO: start the currently displayed animation
        // return false;
      }
      return undefined;
    });
  }

  private initBeforeOnLoadListener() {
    // TODO: we should check to see if there are any dirty changes first
    $(window).on('beforeunload', event => {
      if (!IS_DEV_MODE) {
        return 'You\'ve made changes but haven\'t saved. ' +
          'Are you sure you want to navigate away?';
      }
      return undefined;
    });
  }

  // private deleteSelectedSplitPoints() {
  //   const selections = this.selectionStateService.getSelections();
  //   if (!selections.length) {
  //     return;
  //   }
  //   // We assume all selections belong to the same editor for now.
  //   const canvasType = selections[0].source;
  //   const unsplitOpsMap: Map<PathLayer, Array<{ subIdx: number, cmdIdx: number }>> = new Map();
  //   for (const selection of selections) {
  //     const {pathId, subIdx, cmdIdx} = selection.commandId;
  //     const vectorLayer = this.layerStateService.getVectorLayer(canvasType);
  //     if (!vectorLayer) {
  //       continue;
  //     }
  //     const pathLayer = vectorLayer.findLayerById(pathId) as PathLayer;
  //     if (!pathLayer.pathData.subPathCommands[subIdx].commands[cmdIdx].isSplit) {
  //       continue;
  //     }
  //     let unsplitOpsForPath = unsplitOpsMap.get(pathLayer);
  //     if (!unsplitOpsForPath) {
  //       unsplitOpsForPath = [];
  //     }
  //     unsplitOpsForPath.push({ subIdx, cmdIdx });
  //     unsplitOpsMap.set(pathLayer, unsplitOpsForPath);
  //   }
  //   unsplitOpsMap.forEach((unsplitOps, pathLayer, map) => {
  //     pathLayer.pathData = pathLayer.pathData.unsplitBatch(unsplitOps);
  //   });
  //   this.selectionStateService.clear();
  //   this.layerStateService.notifyChange(canvasType);
  // }

  private loadDebugVectorLayers() {
    this.layerStateService.setVectorLayer(CanvasType.Start, VectorLayerLoader.loadVectorLayerFromSvgString(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path
        stroke="#000"
        stroke-width="0.2"
        fill="none"
        d="M 8.868 7.648 C 8.603 4.784 11.043 3.829 12.475 3.829 C 18.468 3.829 17.407
        12.103 12.475 12.103 C 18.68 12.103 17.832 21.014 12.528 21.014 C 7.648 21.014 7.86 17.832 7.913 17.089">
      </path>
    </svg>`));
    this.layerStateService.setVectorLayer(CanvasType.End, VectorLayerLoader.loadVectorLayerFromSvgString(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path
        stroke="#000"
        stroke-width="0.2"
        fill="none"
        d="M 15.604 20.908 L 15.604 4.572 L 6.481 17.407 L 18.362 17.407">
      </path>
    </svg>`));
    // this.layerStateService.setLayer(CanvasType.Start, VectorLayerLoader.loadVectorLayerFromSvgString(`
    //   <svg xmlns="http://www.w3.org/2000/svg"
    //     width="400px" height="400px"
    //     viewBox="0 0 800 600">
    //    <path id="animal" fill="#cccccc" d="M148.802,244.876c2.737-36.735,16.107-69.079,40.099-97.061
    // c27.038-31.596,60.924-47.386,101.629-47.386c15.481,0,38.483,2.447,69.024,7.287c30.541,4.886,53.533,7.278,69.033,7.278
    // c23.693,0,57.868,8.847,102.526,26.477c7.914,3.009,17.471,11.239,28.701,24.59c6.381,7.886,16.256,19.769,29.616,35.568
    // c3.036,2.139,6.998,5.316,11.865,9.595c4.859,4.223,8.194,6.063,9.997,5.456c0.616-1.84,2.149-4.4,4.578-7.735
    // c1.214-1.225,1.962-1.832,2.261-1.832c0.935,0.607,1.831,1.215,2.747,1.832c0.906,0.616,1.205,2.419,0.906,5.456
    // c-0.616,5.474-0.906,7.138-0.906,4.998c-0.327,3.056-0.757,5.008-1.373,5.952c-3.952,6.671-5.485,11.847-4.55,15.472
    // c0.916,3.325,3.765,8.669,8.642,15.958c4.868,7.287,7.586,12.761,8.193,16.405c-0.299,2.728-0.43,7.119-0.43,13.211l-4.568,11.379
    // c0,8.512,9.865,23.114,29.616,43.78c9.436,4.223,14.117,18.826,14.117,43.714c0,19.47-16.089,29.167-48.273,29.167
    // c-4.26,0-8.81-0.13-13.678-0.467c-3.335-1.196-8.203-2.56-14.575-4.074c-7.586-0.934-12.761-3.494-15.48-7.773
    // c-4.877-6.95-12.781-13.509-23.711-19.581c-1.823-0.878-4.485-4.223-7.979-10.016c-3.503-5.774-6.615-9.418-9.333-10.949
    // c-2.719-1.495-6.68-1.813-11.856-0.878c-8.81,1.494-13.677,2.261-14.574,2.261c-2.139,0-5.25-0.598-9.343-1.831
    // c-4.11-1.215-7.054-1.831-8.893-1.831c-2.112,9.735-2.589,19.152-1.364,28.252c0.298,2.448,1.831,4.428,4.559,5.923
    // c4.27,3.046,6.531,4.709,6.849,5.045c2.718,2.111,5.615,5.605,8.642,10.445c0.616,1.849-0.523,4.952-3.419,9.342
    // c-2.887,4.41-5.223,7.008-7.063,7.736c-1.813,0.785-5.765,1.178-11.847,1.178c-8.82,0-12.295,0.131-10.464,0.43
    // c-12.145-1.831-18.984-2.878-20.516-3.158c-7.587-1.532-14.126-3.943-19.582-7.305c-2.756-1.813-5.913-10.333-9.557-25.524
    // c-3.681-16.406-6.717-26.272-9.137-29.635c-0.598-0.896-1.355-1.326-2.261-1.326c-1.533,0-4.045,1.494-7.53,4.559
    // c-3.494,2.99-5.858,4.652-7.054,5.008c-4.242,17.9-6.4,26.402-6.4,25.468c0,7.007,1.972,12.892,5.924,17.77
    // c3.943,4.858,8.063,9.567,12.323,14.107c5.157,5.774,7.736,10.782,7.736,15.042c0,2.41-0.748,4.521-2.28,6.372
    // c-6.381,7.885-17.022,11.847-31.905,11.847c-16.713,0-27.644-2.28-32.792-6.839c-6.699-5.774-10.949-11.865-12.762-18.199
    // c-0.298-1.533-1.055-6.091-2.28-13.678c-0.607-4.578-1.98-7.287-4.082-8.184c-6.101-0.916-13.687-2.578-22.778-5.007
    // c-1.841-1.215-3.811-4.26-5.942-9.118c-3.933-9.399-6.83-15.789-8.661-19.134c-9.128-4.56-23.702-9.698-43.761-15.453
    // c-0.916,1.831-1.345,4.373-1.345,7.718c3.335,4.26,8.343,10.8,15.032,19.581c5.466,7.288,8.203,14.295,8.203,20.965
    // c0,12.781-8.203,19.134-24.609,19.134c-12.453,0-20.955-0.878-25.523-2.709c-6.671-2.728-12.295-9.136-16.854-19.134
    // c-7.596-16.742-11.847-26.159-12.762-28.27c-4.868-11.231-8.204-21.133-10.006-29.653c-1.233-6.055-3.064-15.35-5.485-27.804
    // c-2.121-10.296-5.456-18.358-10.015-24.132C155.332,279.36,147.578,260.665,148.802,244.876z"/>
    // </svg>`));
    // this.layerStateService.setLayer(CanvasType.End, VectorLayerLoader.loadVectorLayerFromSvgString(`
    //   <svg xmlns="http://www.w3.org/2000/svg"
    //     width="400px" height="400px"
    //     viewBox="0 0 800 600">
    //     <path id="animal" fill="#cccccc" d="M446.47,99.669c12.095,0,23.828,7.003,35.234,20.993c11.378,13.989,17.971,20.993,19.755,20.993
    // h17.116c36.996,0,65.654,18.517,85.956,55.547c5.35,10.365,13.524,25.586,24.584,45.697c11.01,20.144,23.856,35.008,38.464,44.628
    // c16.366,10.694,32.917,16.59,49.644,17.631c7.819,0.361,16.394-1.073,25.657-4.298c8.186-3.58,16.36-7.172,24.54-10.754
    // l5.344,11.859c-26.337,20.215-51.436,30.64-75.297,31.363c-25.619,0.712-53.231-5.514-82.764-18.643
    // c25.263,29.205,47,47.005,65.161,53.385l-4.271,4.304c-32.041-5.7-61.607-22.099-88.655-49.147l-21.365,12.769
    // c0,1.434-1.33,2.94-4.002,4.534c-2.672,1.599-3.85,2.908-3.493,3.981c1.434,4.627,8.743,15.998,21.906,34.062
    // c13.174,18.129,19.755,27.711,19.755,28.751c0,3.197-4.101,6.384-12.286,9.586c-8.18,3.193-12.621,6.746-13.333,10.655
    // c-0.722,3.198,0.329,7.107,3.198,11.707c2.83,4.627,4.264,7.43,4.264,8.53c0,7.08-6.23,11.509-18.67,13.305
    // c-2.163,0.329-8.936,0.526-20.313,0.526c-21.348,0-36.668-4.796-45.927-14.345c-7.468-8.146-13.365-23.046-17.636-44.656
    // c-1.434-7.43-3.909-20.729-7.468-39.898c-36.307,9.253-73.698,13.886-112.166,13.886c-23.505,0-48.96-1.764-76.38-5.344
    // c4.637,11.76,11.223,31.357,19.798,58.766c-17.806-2.502-39.186-6.055-64.093-10.688c-11.055,16.721-20.506,24.742-28.329,24.026
    // c-13.886-1.046-33.837-7.989-59.818-20.795c-6.416-3.198-9.614-8.021-9.614-14.438c0-6.395,4.993-18.161,14.959-35.245
    // c9.949-17.077,15.293-29.008,16.009-35.786c0.718-6.072-1.035-14.405-5.311-25.103c-5.344-13.891-8.378-22.941-9.09-27.245h2.146
    // l-4.276-12.818c-16.393,17.8-31.351,30.804-44.88,38.989c-15.682,9.61-34.199,15.868-55.548,18.671
    // c-4.27-4.238-7.106-6.379-8.541-6.379c26.341-11.41,52.355-29.375,77.973-53.959c1.079-1.073,7.825-5.858,20.314-14.438
    // c7.101-4.621,11.371-10.101,12.811-16.518c8.887-35.595,27.048-60.732,54.463-75.335c22.427-11.739,53.953-17.603,94.53-17.603
    // c18.518,0,36.154,1.238,52.876,3.717c7.829,2.146,20.307,4.66,37.391,7.491c1.434-14.17,6.422-26.752,14.963-37.741
    // C421.377,106.059,432.947,99.669,446.47,99.669z"/>
    // </svg>`));
  }
}
