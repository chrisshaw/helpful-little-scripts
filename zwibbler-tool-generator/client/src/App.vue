<template>
  <div class="app-root">
    <TopBar
      :can-undo="canUndo"
      :can-redo="canRedo"
      @undo="undo"
      @redo="redo"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
    />

    <div class="main-layout">
      <Toolbar
        :current-tool="currentTool"
        :generated-tools="generatedTools"
        @use-tool="useTool"
        @open-generator="showGenerator = true"
        @place-tool="placeOnCanvas"
      />

      <CanvasArea ref="canvasArea" />
    </div>

    <GeneratorDialog
      :visible="showGenerator"
      @close="showGenerator = false"
      @accept="onAcceptTool"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import TopBar from "./components/TopBar.vue";
import Toolbar from "./components/Toolbar.vue";
import CanvasArea from "./components/CanvasArea.vue";
import GeneratorDialog from "./components/GeneratorDialog.vue";
import { useZwibbler } from "./composables/useZwibbler";
import type { GeneratedTool, RegisteredToolMeta } from "./types/tool";

type CanvasAreaExpose = {
  canvasEl: HTMLDivElement | null;
};

const canvasArea = ref<CanvasAreaExpose | null>(null);
const showGenerator = ref(false);
const generatedTools = ref<RegisteredToolMeta[]>([]);

// We need to wait for the CanvasArea component to mount before initializing Zwibbler.
// useZwibbler expects a ref to the actual DOM element, so we pass a computed-like ref
// that resolves after mounting.
const canvasElRef = ref<Element | null>(null);

const {
  currentTool,
  canUndo,
  canRedo,
  useTool,
  undo,
  redo,
  zoomIn,
  zoomOut,
  registerComponent,
  placeOnCanvas,
} = useZwibbler(canvasElRef);

onMounted(() => {
  // CanvasArea exposes its canvasEl via defineExpose
  if (canvasArea.value?.canvasEl) {
    canvasElRef.value = canvasArea.value.canvasEl;
  }
});

function onAcceptTool(tool: GeneratedTool): void {
  const registered = registerComponent(tool);
  placeOnCanvas(registered);
  generatedTools.value = [...generatedTools.value, registered];
  showGenerator.value = false;
}
</script>
