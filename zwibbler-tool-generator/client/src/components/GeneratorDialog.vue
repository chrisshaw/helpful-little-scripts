<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="$emit('close')">
      <div class="generator-dialog">
        <div class="generator-header">
          <h2>Generate an Academic Tool</h2>
          <button class="generator-close" @click="$emit('close')">&times;</button>
        </div>

        <div class="generator-body">
          <label>Describe the tool you need:</label>
          <textarea
            ref="promptInput"
            v-model="prompt"
            rows="4"
            placeholder="e.g., A simple calculator with basic arithmetic, a periodic table of elements, a unit converter for physics, an interactive number line..."
          ></textarea>

          <div class="category-hints">
            <span
              v-for="hint in hints"
              :key="hint"
              class="hint-chip"
              @click="prompt = hint"
            >
              {{ hint }}
            </span>
          </div>

          <div class="generator-options">
            <label>
              <span>Size:</span>
              <select v-model="size">
                <option value="small">Small (300x200)</option>
                <option value="medium">Medium (450x350)</option>
                <option value="large">Large (600x500)</option>
              </select>
            </label>
          </div>

          <button
            class="btn-do-generate"
            :disabled="generating || !prompt.trim()"
            @click="doGenerate"
          >
            Generate Tool
          </button>

          <div v-if="generating" class="generator-status">
            <div class="spinner"></div>
            <span>{{ statusText }}</span>
          </div>

          <div v-if="error" class="generator-error">
            {{ error }}
          </div>

          <div v-if="previewTool" class="generator-preview">
            <h3>Preview</h3>
            <div class="preview-frame-wrapper">
              <iframe
                ref="previewFrame"
                sandbox="allow-scripts"
              ></iframe>
            </div>
            <div class="preview-actions">
              <button @click="accept">Place on Canvas</button>
              <button @click="doGenerate">Regenerate</button>
              <button @click="$emit('close')">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { generateTool } from "../api/generator";
import { renderPreview } from "../utils/sandbox";
import type { GeneratedTool, ToolSizeKey } from "../types/tool";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  accept: [tool: GeneratedTool];
}>();

const prompt = ref("");
const size = ref<ToolSizeKey>("medium");
const generating = ref(false);
const statusText = ref("Generating your tool...");
const error = ref("");
const previewTool = ref<GeneratedTool | null>(null);
const promptInput = ref<HTMLTextAreaElement | null>(null);
const previewFrame = ref<HTMLIFrameElement | null>(null);

const hints = [
  "Calculator",
  "Graph paper",
  "Periodic table",
  "Unit converter",
  "Number line",
  "Multiplication table",
  "Fraction visualizer",
  "Protractor",
  "Coordinate plane",
  "Timer / Stopwatch",
];

async function doGenerate() {
  if (!prompt.value.trim() || generating.value) return;

  generating.value = true;
  statusText.value = "Generating your tool...";
  error.value = "";
  previewTool.value = null;

  try {
    const tool = await generateTool(prompt.value.trim(), size.value);
    previewTool.value = tool;

    await nextTick();
    if (previewFrame.value) {
      renderPreview(previewFrame.value, tool);
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : String(err);
    console.error("Tool generation failed:", err);
  } finally {
    generating.value = false;
  }
}

function accept() {
  if (!previewTool.value) return;
  emit("accept", previewTool.value);
  previewTool.value = null;
  prompt.value = "";
  error.value = "";
}

// Auto-focus the prompt input when dialog opens
watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return;
    await nextTick();
    promptInput.value?.focus();
  },
);
</script>
