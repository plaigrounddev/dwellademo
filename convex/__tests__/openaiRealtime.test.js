import assert from "node:assert/strict";
import test from "node:test";
import {
  OPENAI_REALTIME_MODEL,
  buildDwellaRealtimeSessionConfig,
  buildRealtimeTranscriptionConfig,
} from "../openaiRealtime.js";

test("realtime session uses patient voice turn detection and auto language detection", () => {
  const config = buildDwellaRealtimeSessionConfig({
    instructions: "Be concise.",
    tools: [],
  });

  assert.equal(config.model, OPENAI_REALTIME_MODEL);
  assert.equal(config.audio.input.turn_detection.type, "semantic_vad");
  assert.equal(config.audio.input.turn_detection.eagerness, "low");
  assert.equal(config.audio.input.turn_detection.create_response, true);
  assert.equal(config.audio.input.turn_detection.interrupt_response, true);
  assert.equal(config.audio.input.noise_reduction.type, "far_field");
  assert.equal(config.audio.input.transcription.language, undefined);
  assert.equal(config.audio.input.transcription.prompt, undefined);
  assert.equal(config.audio.output.voice, "marin");
});

test("realtime transcription can still accept an explicit language hint", () => {
  const config = buildRealtimeTranscriptionConfig({
    model: "gpt-4o-transcribe",
    language: "es",
    prompt: "Conversacion sobre construccion de viviendas.",
  });

  assert.equal(config.language, "es");
  assert.equal(config.prompt, "Conversacion sobre construccion de viviendas.");
});

test("realtime transcription prompt is omitted for unsupported transcription models", () => {
  assert.equal(
    buildRealtimeTranscriptionConfig({ model: "gpt-realtime-whisper", prompt: "Vocabulary hint." }).prompt,
    undefined
  );
  assert.equal(
    buildRealtimeTranscriptionConfig({ model: "gpt-4o-transcribe-diarize", prompt: "Vocabulary hint." }).prompt,
    undefined
  );
});
