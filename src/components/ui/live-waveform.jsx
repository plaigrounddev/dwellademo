import React from "react";

const DEFAULT_BARS = Array.from({ length: 28 }, () => 0);

function drawRoundedBar(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    return;
  }

  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.fill();
}

export function LiveWaveform({
  active = false,
  barGap = 1,
  barRadius = 1.5,
  barWidth = 3,
  barColor = "rgba(176, 176, 169, 0.86)",
  className = "",
  fadeEdges = true,
  fadeWidth = 24,
  height = 64,
  historySize = 60,
  inputVolumeRef,
  mode = "static",
  outputVolumeRef,
  processing = false,
  sensitivity = 1,
  waveformBandsRef,
  style,
  ...props
}) {
  const canvasRef = React.useRef(null);
  const smoothedBarsRef = React.useRef([...DEFAULT_BARS]);
  const historyRef = React.useRef([]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;

    let frameId = 0;

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.floor(bounds.width * dpr));
      const height = Math.max(1, Math.floor(bounds.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      const liveBands = Array.isArray(waveformBandsRef?.current) ? waveformBandsRef.current : DEFAULT_BARS;
      const centerY = height / 2;
      const inputVolume = Number(inputVolumeRef?.current) || 0;
      const outputVolume = Number(outputVolumeRef?.current) || 0;
      const volumeLift = Math.max(inputVolume, outputVolume) * 0.28 * sensitivity;
      const restingLevel = processing ? 0.16 : 0.045;
      const gap = Math.max(1, Math.round(barGap * dpr));
      const renderBarWidth = Math.max(1, Math.round(barWidth * dpr));
      const radius = Math.max(0, barRadius * dpr);

      ctx.fillStyle = barColor || getComputedStyle(canvas).color;

      if (mode === "scrolling") {
        const livePeak = active
          ? Math.max(restingLevel, Math.min(1, (liveBands.reduce((total, value) => total + (Number(value) || 0), 0) / Math.max(1, liveBands.length)) * sensitivity + volumeLift))
          : restingLevel;
        historyRef.current = [...historyRef.current.slice(-Math.max(1, historySize - 1)), livePeak];
        const history = historyRef.current;
        const barCount = Math.max(1, Math.min(historySize, Math.floor(width / (renderBarWidth + gap))));
        const visibleHistory = history.slice(-barCount);
        const startX = width - visibleHistory.length * (renderBarWidth + gap);

        visibleHistory.forEach((value, index) => {
          const barHeight = Math.max(3 * dpr, value * height * 0.82);
          const x = startX + index * (renderBarWidth + gap);
          const y = centerY - barHeight / 2;
          ctx.globalAlpha = active ? 0.42 + value * 0.5 : 0.24;
          drawRoundedBar(ctx, x, y, renderBarWidth, barHeight, radius);
        });
        ctx.globalAlpha = 1;
        frameId = window.requestAnimationFrame(draw);
        return;
      }

      const barCount = smoothedBarsRef.current.length;
      const usableWidth = barCount * renderBarWidth + (barCount - 1) * gap;
      const startX = (width - usableWidth) / 2;

      smoothedBarsRef.current = smoothedBarsRef.current.map((previous, index) => {
        const liveBand = Number(liveBands[index]) || 0;
        const target = active ? Math.max(restingLevel, Math.min(1, liveBand * sensitivity + volumeLift)) : restingLevel;
        return previous * 0.7 + target * 0.3;
      });

      for (let index = 0; index < barCount; index += 1) {
        const value = Math.max(0.04, Math.min(1, smoothedBarsRef.current[index]));
        const barHeight = Math.max(3 * dpr, value * height * 0.82);
        const x = startX + index * (renderBarWidth + gap);
        const y = centerY - barHeight / 2;
        ctx.globalAlpha = active ? 0.42 + value * 0.5 : 0.24;
        drawRoundedBar(ctx, x, y, renderBarWidth, barHeight, radius);
      }

      ctx.globalAlpha = 1;
      frameId = window.requestAnimationFrame(draw);
    };

    draw();
    return () => window.cancelAnimationFrame(frameId);
  }, [active, barColor, barGap, barRadius, barWidth, historySize, inputVolumeRef, mode, outputVolumeRef, processing, sensitivity, waveformBandsRef]);

  return (
    <span
      {...props}
      className={className}
      aria-hidden="true"
      data-fade-edges={fadeEdges ? "true" : "false"}
      style={{
        ...style,
        "--live-waveform-height": typeof height === "number" ? `${height}px` : height,
        "--live-waveform-fade-width": `${fadeWidth}px`,
      }}
    >
      <canvas ref={canvasRef} />
    </span>
  );
}
